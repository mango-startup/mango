import { useEffect, useMemo, useRef, useState } from 'react'
import { gerarQr } from '../lib/qr'
import { Botao } from './Botao'
import { Icone } from './Icone'

const MARGEM = 4 // módulos de margem clara, como o padrão do QR pede
const LADO_MINIMO_PX = 1024

interface QrConviteProps {
  /** O que o QR abre (o link dos convidados). */
  valor: string
  /** Nome do arquivo baixado, sem extensão. */
  arquivo: string
}

// QR do link dos convidados: aparece no painel e baixa em PNG grande, pronto para imprimir.
// Desenhado no próprio aparelho: funciona offline depois que a página carregou.
export function QrConvite({ valor, arquivo }: QrConviteProps) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const [falha, setFalha] = useState(false)
  const matriz = useMemo(() => {
    try {
      return gerarQr(valor)
    } catch {
      return null
    }
  }, [valor])

  useEffect(() => {
    const c = canvas.current
    if (!c || !matriz) return
    const n = matriz.length
    const modulo = Math.ceil(LADO_MINIMO_PX / (n + MARGEM * 2))
    c.width = c.height = (n + MARGEM * 2) * modulo
    const ctx = c.getContext('2d')
    if (!ctx) return
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, c.width, c.height)
    ctx.fillStyle = '#151513'
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) if (matriz[i][j]) ctx.fillRect((j + MARGEM) * modulo, (i + MARGEM) * modulo, modulo, modulo)
    }
  }, [matriz])

  function baixar() {
    canvas.current?.toBlob((blob) => {
      if (!blob) return setFalha(true)
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `${arquivo}.png`
      link.click()
      setTimeout(() => URL.revokeObjectURL(url), 10_000)
    }, 'image/png')
  }

  if (!matriz) return <p className="text-sm text-muted">Não foi possível gerar o QR para este link.</p>

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm font-semibold">QR para imprimir</p>
      <canvas
        ref={canvas}
        role="img"
        aria-label="QR do link dos convidados"
        className="h-44 w-44 rounded-[14px] border border-line"
        style={{ imageRendering: 'pixelated' }}
      />
      <div className="flex flex-col items-start gap-1">
        <Botao variante="secundario" className="min-h-11 px-4" onClick={baixar}>
          <Icone nome="baixar" className="h-5 w-5" />
          Baixar o QR (PNG)
        </Botao>
        {falha && <p className="text-sm text-danger-ink">Não foi possível baixar. Tente de novo.</p>}
        <p className="text-sm text-muted">Imprima com pelo menos 4 cm de lado. A imagem já tem margem clara.</p>
      </div>
    </div>
  )
}
