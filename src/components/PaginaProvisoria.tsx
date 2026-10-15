import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { MangoLogo } from './MangoLogo'

interface LinkProvisorio {
  para: string
  rotulo: string
}

interface PaginaProvisoriaProps {
  titulo: string
  descricao: string
  /** Issue que vai construir a tela de verdade. */
  issue: number
  links?: LinkProvisorio[]
  children?: ReactNode
}

// Casca das telas que ainda não existem: diz o que vai ter ali e deixa navegar pelo fluxo.
export function PaginaProvisoria({ titulo, descricao, issue, links = [], children }: PaginaProvisoriaProps) {
  return (
    <div className="min-h-svh bg-base px-5 pb-12 pt-5 text-paper">
      <header className="mx-auto flex max-w-[520px] items-center">
        <Link to="/" className="flex min-h-11 items-center gap-2 font-display text-[22px] leading-none">
          <MangoLogo className="h-[21px] w-4" />
          <span className="pb-0.5">mango</span>
        </Link>
      </header>

      <main className="mx-auto mt-12 max-w-[520px]">
        <h1 className="font-display text-[40px] leading-none [text-wrap:balance]">{titulo}</h1>
        <p className="mt-4 text-[15px] leading-normal text-muted">{descricao}</p>
        <p className="mt-3 text-sm text-muted">Tela provisória · issue #{issue}</p>
        {children}
        {links.length > 0 && (
          <nav aria-label="Navegar pelo fluxo" className="mt-10 border-t border-line">
            {links.map((link) => (
              <Link
                key={link.para}
                to={link.para}
                className="flex min-h-12 items-center border-b border-line text-[15px] font-semibold transition hover:text-muted"
              >
                {link.rotulo}
              </Link>
            ))}
          </nav>
        )}
      </main>
    </div>
  )
}
