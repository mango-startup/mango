import { configAtual } from './configPublica'

interface CapturedPhoto {
  blob: Blob
  width: number
  height: number
}

/** Foto pronta para enviar: original comprimida e miniatura para a folha de contato. */
export interface FotoParaEnvio extends CapturedPhoto {
  miniatura: Blob
}

const MINIATURA_MAX = 320
const MINIATURA_QUALIDADE = 0.7

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

function paraJpeg(canvas: HTMLCanvasElement, qualidade: number): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Falha ao gerar a imagem comprimida'))), 'image/jpeg', qualidade),
  )
}

/** Desenha a fonte num canvas novo do tamanho pedido (sem metadados do original). */
function desenhar(fonte: CanvasImageSource, sx: number, sy: number, sw: number, sh: number, largura: number, altura: number) {
  const canvas = document.createElement('canvas')
  canvas.width = largura
  canvas.height = altura
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Não foi possível criar o contexto 2D do canvas')
  ctx.drawImage(fonte, sx, sy, sw, sh, 0, 0, largura, altura)
  return canvas
}

async function comMiniatura(fonte: CanvasImageSource, sx: number, sy: number, sw: number, sh: number): Promise<FotoParaEnvio> {
  const { foto_dimensao_max_px: maxDimensao, foto_qualidade_jpeg: qualidade } = configAtual()
  const escala = Math.min(1, maxDimensao / Math.max(sw, sh))
  const width = Math.round(sw * escala)
  const height = Math.round(sh * escala)
  const blob = await paraJpeg(desenhar(fonte, sx, sy, sw, sh, width, height), qualidade)
  const escalaMini = Math.min(1, MINIATURA_MAX / Math.max(sw, sh))
  const miniatura = await paraJpeg(
    desenhar(fonte, sx, sy, sw, sh, Math.round(sw * escalaMini), Math.round(sh * escalaMini)),
    MINIATURA_QUALIDADE,
  )
  return { blob, width, height, miniatura }
}

/** Captura do vídeo, com o mesmo recorte do preview, mais a miniatura. */
export function capturarParaEnvio(video: HTMLVideoElement): Promise<FotoParaEnvio> {
  const { sx, sy, sw, sh } = visibleRegion(video)
  return comMiniatura(video, sx, sy, sw, sh)
}

/**
 * Foto vinda da câmera do sistema (input de arquivo). Redesenhar num canvas tira EXIF e GPS;
 * `imageOrientation: 'from-image'` corrige a rotação que o celular grava no EXIF.
 */
export async function comprimirArquivo(arquivo: File): Promise<FotoParaEnvio> {
  const imagem = await createImageBitmap(arquivo, { imageOrientation: 'from-image' })
  try {
    return await comMiniatura(imagem, 0, 0, imagem.width, imagem.height)
  } finally {
    imagem.close()
  }
}
