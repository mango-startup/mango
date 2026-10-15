import type { ComponentProps, ReactNode } from 'react'
import { Link } from 'react-router-dom'

export type VarianteBotao = 'primario' | 'escuro' | 'secundario' | 'destrutivo' | 'discreto'

// primario: creme sobre a base · escuro: base sobre o creme · secundario: contorno ·
// destrutivo: apagar/excluir · discreto: ação de apoio, só texto
const VARIANTES: Record<VarianteBotao, string> = {
  primario: 'bg-paper text-base hover:bg-white',
  escuro: 'bg-base text-paper hover:bg-surface',
  secundario: 'border border-line text-paper hover:bg-surface',
  destrutivo: 'bg-danger text-paper hover:brightness-110',
  discreto: 'text-muted hover:text-paper',
}

const BASE =
  'inline-flex min-h-12 items-center justify-center gap-2 rounded-[14px] px-6 text-[15px] font-semibold ' +
  'transition-[background-color,color,transform,filter] duration-150 active:scale-[0.98] ' +
  'disabled:pointer-events-none disabled:opacity-40'

function classesDoBotao(variante: VarianteBotao = 'primario', extra = '') {
  return `${BASE} ${VARIANTES[variante]} ${extra}`.trim()
}

// ComponentProps<'button'> já inclui `ref` (React 19)
interface BotaoProps extends ComponentProps<'button'> {
  variante?: VarianteBotao
  /** Com `para`, vira um link de navegação com a mesma aparência. */
  para?: string
  children: ReactNode
}

export function Botao({ variante = 'primario', para, className = '', type = 'button', children, ...resto }: BotaoProps) {
  const classes = classesDoBotao(variante, className)
  if (para) {
    return (
      <Link to={para} className={classes}>
        {children}
      </Link>
    )
  }
  return (
    <button type={type} className={classes} {...resto}>
      {children}
    </button>
  )
}
