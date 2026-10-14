import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { CameraView } from '../components/CameraView'
import { MangoLogo } from '../components/MangoLogo'
import { listPhotos, savePhoto } from '../lib/storage'
import { MAX_PHOTOS } from '../lib/constants'
import { captureAndCompress } from '../lib/compress'

type Status = 'idle' | 'uploading' | 'error'

export function CameraPage() {
  const [photosTaken, setPhotosTaken] = useState(0)
  const [status, setStatus] = useState<Status>('idle')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    listPhotos().then((photos) => setPhotosTaken(photos.length))
  }, [])

  const filmeEsgotado = photosTaken >= MAX_PHOTOS
  const restantes = MAX_PHOTOS - photosTaken

  async function handleCapture(video: HTMLVideoElement) {
    setStatus('uploading')
    setErrorMessage(null)
    try {
      const { blob, width, height } = await captureAndCompress(video)
      await savePhoto(blob, width, height)
      setPhotosTaken((n) => n + 1)
      setStatus('idle')
    } catch (err) {
      console.error('Falha ao salvar foto:', err)
      setErrorMessage('Não foi possível salvar a foto. Tente novamente.')
      setStatus('error')
    }
  }

  return (
    <div className="flex h-svh flex-col bg-base text-paper">
      <header className="flex items-center justify-between px-5 pb-3 pt-5">
        <Link to="/" className="flex items-center gap-2 font-display text-[22px] leading-none">
          <MangoLogo className="h-[21px] w-4" />
          <span className="pb-0.5">mango</span>
        </Link>
        <span className="text-base font-bold tabular-nums">
          {photosTaken} / {MAX_PHOTOS}
        </span>
      </header>

      <div className="relative min-h-0 flex-1">
        {filmeEsgotado ? (
          <div className="flex h-full flex-col items-center justify-center gap-4 p-6 text-center">
            <p className="font-display text-[32px] leading-none">Acabou o filme!</p>
            <p className="text-[15px] text-muted">
              Você já tirou as {MAX_PHOTOS} fotos do rolo.
            </p>
            <Link
              to="/galeria"
              className="flex h-[52px] items-center rounded-[14px] bg-paper px-6 text-base font-semibold text-base"
            >
              Ver as fotos
            </Link>
          </div>
        ) : (
          <CameraView
            onCapture={handleCapture}
            disabled={status === 'uploading'}
            caption={status === 'uploading' ? 'Salvando...' : `${restantes} fotos restantes`}
          />
        )}
      </div>

      {errorMessage && (
        <div className="bg-red-900/60 px-4 py-2 text-center text-sm text-red-200">
          {errorMessage}
        </div>
      )}

      <Link
        to="/galeria"
        className="border-t border-line px-4 py-3.5 text-center text-[15px] font-semibold text-muted transition hover:text-paper"
      >
        Galeria
      </Link>
    </div>
  )
}
