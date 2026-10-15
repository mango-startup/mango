import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { MangoLogo } from '../../components/MangoLogo'

interface CascaConviteProps {
  /** Nome do evento no topo, ao lado da marca. */
  evento?: string
  /** Canto direito do topo (ex.: contador de poses). */
  acessorio?: ReactNode
  children: ReactNode
  /** Ocupa a altura da tela sem rolagem (câmera). */
  telaCheia?: boolean
}

// Moldura comum das vistas do convidado: marca e nome do evento no topo, respeitando as áreas seguras do celular.
export function CascaConvite({ evento, acessorio, children, telaCheia = false }: CascaConviteProps) {
  return (
    <div
      className={`flex flex-col bg-base pb-[env(safe-area-inset-bottom)] pt-[env(safe-area-inset-top)] text-paper ${
        telaCheia ? 'h-dvh' : 'min-h-dvh'
      }`}
    >
      <header className="flex min-h-16 items-center justify-between gap-4 px-5">
        <Link to="/" className="flex min-h-11 shrink-0 items-center gap-2 font-display text-[20px] leading-none" aria-label="Mango, página inicial">
          <MangoLogo className="h-[19px] w-[15px]" />
          {!evento && <span className="pb-0.5">mango</span>}
        </Link>
        {evento && <p className="min-w-0 flex-1 truncate text-sm font-semibold text-muted">{evento}</p>}
        {acessorio}
      </header>
      <main className="flex min-h-0 flex-1 flex-col">{children}</main>
    </div>
  )
}
