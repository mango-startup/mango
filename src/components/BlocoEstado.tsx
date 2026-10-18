import type { ReactNode } from 'react'

interface BlocoEstadoProps {
  titulo: string
  texto?: ReactNode
  /** A próxima ação: normalmente um <Botao>. */
  acao?: ReactNode
  className?: string
}

// Mensagem de estado (vazio, fim do rolo, erro, antes do início...) sempre com a próxima ação.
export function BlocoEstado({ titulo, texto, acao, className = '' }: BlocoEstadoProps) {
  return (
    <div className={`anim-in flex flex-col items-center justify-center gap-4 p-6 text-center ${className}`}>
      <h2 className="font-display text-[32px] leading-none [text-wrap:balance]">{titulo}</h2>
      {texto && <p className="max-w-[320px] text-[15px] leading-normal text-muted [text-wrap:pretty]">{texto}</p>}
      {acao && <div className="mt-2">{acao}</div>}
    </div>
  )
}
