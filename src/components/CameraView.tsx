import { useEffect, useRef, useState } from 'react'

interface CameraViewProps {
  onCapture: (video: HTMLVideoElement) => void
  disabled?: boolean
  caption?: string
}

export function CameraView({ onCapture, disabled, caption }: CameraViewProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let stream: MediaStream | null = null
    let cancelled = false

    async function startCamera() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
          audio: false,
        })
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop())
          return
        }
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          setReady(true)
        }
      } catch (err) {
        if (!cancelled) setError(describeCameraError(err))
      }
    }

    startCamera()

    return () => {
      cancelled = true
      stream?.getTracks().forEach((track) => track.stop())
    }
  }, [])

  if (error) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
        <p className="font-display text-xl">Não foi possível acessar a câmera</p>
        <p className="text-sm text-muted">{error}</p>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      <div className="relative mx-3.5 flex-1 overflow-hidden rounded-3xl bg-surface">
        <video ref={videoRef} autoPlay playsInline muted className="h-full w-full object-cover" />
        <i className="absolute left-3.5 top-3.5 h-5 w-5 border-l-[1.5px] border-t-[1.5px] border-paper/90" />
        <i className="absolute right-3.5 top-3.5 h-5 w-5 border-r-[1.5px] border-t-[1.5px] border-paper/90" />
        <i className="absolute bottom-3.5 left-3.5 h-5 w-5 border-b-[1.5px] border-l-[1.5px] border-paper/90" />
        <i className="absolute bottom-3.5 right-3.5 h-5 w-5 border-b-[1.5px] border-r-[1.5px] border-paper/90" />
      </div>
      <div className="relative h-[168px] shrink-0">
        {caption && (
          <p className="absolute inset-x-0 top-5 text-center text-[15px] text-muted">{caption}</p>
        )}
        <button
          type="button"
          disabled={!ready || disabled}
          onClick={() => videoRef.current && onCapture(videoRef.current)}
          aria-label="Tirar foto"
          className="absolute bottom-8 left-1/2 flex h-[72px] w-[72px] -translate-x-1/2 items-center justify-center rounded-full border-2 border-paper transition active:scale-95 disabled:opacity-30"
        >
          <span className="h-14 w-14 rounded-full bg-paper" />
        </button>
      </div>
    </div>
  )
}

function describeCameraError(err: unknown): string {
  if (err instanceof DOMException) {
    if (err.name === 'NotAllowedError') {
      return 'Permissão de câmera negada. Habilite o acesso à câmera nas configurações do navegador.'
    }
    if (err.name === 'NotFoundError') {
      return 'Nenhuma câmera foi encontrada neste dispositivo.'
    }
    if (err.name === 'NotReadableError') {
      return 'A câmera está sendo usada por outro aplicativo.'
    }
  }
  return 'Verifique as permissões do navegador e tente novamente.'
}
