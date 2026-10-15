import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Confirmacao } from '../components/Confirmacao'
import { Icone } from '../components/Icone'
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
    <div className="min-h-svh bg-base pb-[env(safe-area-inset-bottom)] pt-[env(safe-area-inset-top)] text-paper">
      <header className="flex items-center justify-between px-5 py-5">
        <Link to="/camera" className="-ml-2 flex min-h-11 items-center px-2 text-[15px] font-semibold text-muted transition hover:text-paper">
          Câmera
        </Link>
        <span className="font-display text-2xl leading-none">
          {photos.length} {photos.length === 1 ? 'foto' : 'fotos'}
        </span>
      </header>

      {loading && <p className="p-6 text-center text-sm text-muted">Carregando...</p>}
      {error && <p className="p-6 text-center text-sm text-danger-ink">{error}</p>}
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
              <div className="absolute inset-0 flex items-center bg-base/90 p-3 backdrop-blur-sm">
                <Confirmacao
                  pergunta="Excluir para sempre?"
                  rotuloConfirmar="Excluir"
                  rotuloCarregando="Excluindo..."
                  carregando={deletingId === photo.id}
                  destrutiva
                  onConfirmar={() => handleDelete(photo.id)}
                  onCancelar={() => setConfirmingId(null)}
                />
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmingId(photo.id)}
                aria-label="Excluir foto"
                className="absolute right-1 top-1 flex h-11 w-11 items-center justify-center rounded-full bg-base/60 backdrop-blur-sm transition hover:bg-base/80"
              >
                <Icone nome="lixeira" className="h-5 w-5" />
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
