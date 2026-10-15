import { JPEG_QUALITY, MAX_DIMENSION } from './constants'

interface CapturedPhoto {
  blob: Blob
  width: number
  height: number
}

// Região do frame que o usuário realmente vê no preview. O <video> usa
// object-fit: cover, que recorta o centro do frame; a foto precisa do mesmo recorte.
function visibleRegion(video: HTMLVideoElement) {
  const vw = video.videoWidth
  const vh = video.videoHeight
  const cw = video.clientWidth
  const ch = video.clientHeight
  if (!cw || !ch) return { sx: 0, sy: 0, sw: vw, sh: vh }
  const zoom = Math.max(cw / vw, ch / vh)
  const sw = cw / zoom
  const sh = ch / zoom
  return { sx: (vw - sw) / 2, sy: (vh - sh) / 2, sw, sh }
}

// Captura o frame atual do vídeo, recorta como o preview, redimensiona para no máximo MAX_DIMENSION
// no lado maior e exporta como JPEG. Como o frame é desenhado do zero num
// canvas novo (nunca lido de um arquivo), o resultado não carrega EXIF/GPS —
// o canvas não preserva metadados do arquivo original.
export async function captureAndCompress(video: HTMLVideoElement): Promise<CapturedPhoto> {
  const { sx, sy, sw, sh } = visibleRegion(video)
  const scale = Math.min(1, MAX_DIMENSION / Math.max(sw, sh))
  const width = Math.round(sw * scale)
  const height = Math.round(sh * scale)

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height

  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Não foi possível criar o contexto 2D do canvas')

  ctx.drawImage(video, sx, sy, sw, sh, 0, 0, width, height)

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY),
  )
  if (!blob) throw new Error('Falha ao gerar a imagem comprimida')

  return { blob, width, height }
}
