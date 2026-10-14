import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { deletePhoto, listPhotos } from '../lib/storage'
import type { Photo } from '../types'

export function GalleryPage() {
  const [photos, setPhotos] = useState<Photo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [confirmingId, setConfirmingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  useEffect(() => {
    listPhotos()
      .then(setPhotos)
      .catch(() => setError('Não foi possível carregar as fotos.'))
      .finally(() => setLoading(false))
  }, [])

  async function handleDelete(id: string) {
    setDeletingId(id)
    setError(null)
    try {
      await deletePhoto(id)
      setPhotos((prev) => prev.filter((photo) => photo.id !== id))
    } catch {
      setError('Não foi possível excluir a foto. Tente novamente.')
    } finally {
      setDeletingId(null)
      setConfirmingId(null)
    }
  }

  return (
    <div className="min-h-svh bg-base text-paper">
      <header className="flex items-center justify-between px-5 py-5">
        <Link to="/camera" className="text-[15px] font-semibold text-muted transition hover:text-paper">
          Câmera
        </Link>
        <span className="font-display text-2xl leading-none">
          {photos.length} {photos.length === 1 ? 'foto' : 'fotos'}
        </span>
      </header>

      {loading && <p className="p-6 text-center text-sm text-muted">Carregando...</p>}
      {error && <p className="p-6 text-center text-sm text-red-400">{error}</p>}
      {!loading && !error && photos.length === 0 && (
        <p className="p-6 text-center text-[15px] text-muted">
          Nenhuma foto ainda. Abra a câmera e tire a primeira.
        </p>
      )}

      <div className="grid grid-cols-2 gap-2 px-2 pb-2">
        {photos.map((photo) => (
          <div key={photo.id} className="relative aspect-[3/4] overflow-hidden rounded-[14px] bg-surface">
            <a href={photo.url} download className="block h-full w-full">
              <img src={photo.url} alt="" className="h-full w-full object-cover" loading="lazy" />
            </a>

            {confirmingId === photo.id ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-base/90 p-3 text-center backdrop-blur-sm">
                <p className="text-sm font-semibold">Excluir para sempre?</p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={deletingId === photo.id}
                    onClick={() => handleDelete(photo.id)}
                    className="rounded-[10px] bg-red-600 px-3.5 py-2 text-sm font-semibold disabled:opacity-50"
                  >
                    {deletingId === photo.id ? 'Excluindo...' : 'Excluir'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmingId(null)}
                    className="rounded-[10px] bg-paper/15 px-3.5 py-2 text-sm font-semibold"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmingId(photo.id)}
                aria-label="Excluir foto"
                className="absolute right-2 top-2 flex h-9 w-9 items-center justify-center rounded-full bg-base/60 text-sm leading-none backdrop-blur-sm"
              >
                🗑
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
