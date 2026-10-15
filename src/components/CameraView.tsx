import { useEffect, useRef, useState } from 'react'

interface CameraViewProps {
  onCapture: (video: HTMLVideoElement) => void
  disabled?: boolean
  caption?: string
}

type Facing = 'environment' | 'user'

export function CameraView({ onCapture, disabled, caption }: CameraViewProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [ready, setReady] = useState(false)
  const [facing, setFacing] = useState<Facing>('environment')
  const [canSwitch, setCanSwitch] = useState(false)
  // Muda a cada pedido de nova tentativa e refaz o stream
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let stream: MediaStream | null = null
    let cancelled = false

    async function startCamera() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: facing },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
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
        const devices = await navigator.mediaDevices.enumerateDevices()
        if (!cancelled) setCanSwitch(devices.filter((d) => d.kind === 'videoinput').length > 1)
      } catch (err) {
        if (!cancelled) setError(describeCameraError(err))
      }
    }

    // Bloquear a tela ou trocar de app pode encerrar o stream (comum no iOS):
    // ao voltar, refaz o stream se a track morreu ou retoma o vídeo parado.
    function handleVisibility() {
      if (document.visibilityState !== 'visible' || !stream) return
      const dead = stream.getTracks().some((track) => track.readyState === 'ended')
      if (dead) {
        setReady(false)
        setAttempt((n) => n + 1)
      }
      else videoRef.current?.play().catch(() => {})
    }

    startCamera()
    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', handleVisibility)
      stream?.getTracks().forEach((track) => track.stop())
    }
  }, [facing, attempt])

  if (error) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
        <p className="font-display text-xl">Não foi possível acessar a câmera</p>
        <p className="max-w-[320px] text-sm text-muted">{error}</p>
        <button
          type="button"
          onClick={() => {
            setError(null)
            setReady(false)
            setAttempt((n) => n + 1)
          }}
          className="mt-2 flex h-12 items-center rounded-[14px] bg-paper px-6 text-base font-semibold text-base"
        >
          Tentar de novo
        </button>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      <div className="relative mx-3.5 flex-1 overflow-hidden rounded-3xl bg-surface">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="h-full w-full object-cover"
          // A câmera frontal aparece espelhada no preview; a foto salva não é espelhada
          style={{ transform: facing === 'user' ? 'scaleX(-1)' : undefined }}
        />
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
        {canSwitch && (
          <button
            type="button"
            onClick={() => {
              setReady(false)
              setFacing((f) => (f === 'environment' ? 'user' : 'environment'))
            }}
            aria-label="Trocar câmera"
            className="absolute bottom-[42px] right-8 flex h-12 w-12 items-center justify-center rounded-full border border-line text-paper transition hover:bg-surface active:scale-95"
          >
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M20 7h-9a5 5 0 0 0-5 5v1" />
              <path d="m17 4 3 3-3 3" />
              <path d="M4 17h9a5 5 0 0 0 5-5v-1" />
              <path d="m7 20-3-3 3-3" />
            </svg>
          </button>
        )}
      </div>
    </div>
  )
}

function describeCameraError(err: unknown): string {
  if (err instanceof DOMException) {
    if (err.name === 'NotAllowedError') {
      return 'Permissão de câmera negada. No iPhone: Ajustes > Safari > Câmera. No Android: toque no cadeado ao lado do endereço > Permissões. Depois toque em tentar de novo.'
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
