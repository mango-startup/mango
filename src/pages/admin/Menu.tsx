import { NavLink } from 'react-router-dom'
import type { ReactNode } from 'react'

// Ícones de traço simples (24x24), no mesmo peso do texto. Sem dependência nova.
const ICONES: Record<string, ReactNode> = {
  analise: <path d="M5 20V10M12 20V4M19 20v-7" />,
  resumo: <path d="M4 5h7v7H4zM13 5h7v4h-7zM13 11h7v8h-7zM4 14h7v5H4z" />,
  crescimento: <path d="M4 19V5M4 19h16M8 15l3-4 3 2 5-7" />,
  eventos: <path d="M7 3v3M17 3v3M4 8h16M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z" />,
  anfitrioes: <path d="M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM3 20c0-3.3 2.7-6 6-6s6 2.7 6 6M16 4.5a3.5 3.5 0 0 1 0 6.5M18 14.5c1.9.8 3 2.6 3 5.5" />,
  moderacao: <path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6zM9 12l2 2 4-4" />,
  pagamentos: <path d="M3 7h18v10H3zM3 11h18M7 15h3" />,
  pacotes: <path d="M12 3l8 4v10l-8 4-8-4V7zM4 7l8 4 8-4M12 11v10" />,
  configuracoes: <path d="M4 7h10M18 7h2M4 17h2M10 17h10M16 4v6M8 14v6" />,
  saude: <path d="M3 12h4l2-5 4 10 2-5h6" />,
  auditoria: <path d="M7 3h8l4 4v14H7zM15 3v4h4M10 12h6M10 16h6" />,
  administradores: <path d="M12 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM5 21c0-3.9 3.1-7 7-7s7 3.1 7 7M17 3l1 1.5L20 4" />,
}

interface Item {
  para: string
  rotulo: string
  icone: keyof typeof ICONES
  fim?: boolean
}

// Agrupado pelo que a pessoa vai fazer: olhar números, operar o dia a dia, mexer em dinheiro, cuidar do sistema.
const GRUPOS: { nome: string; itens: Item[] }[] = [
  {
    nome: 'Visão geral',
    itens: [
      { para: '/admin', rotulo: 'Resumo', icone: 'resumo', fim: true },
      { para: '/admin/analise', rotulo: 'Análise', icone: 'analise' },
      { para: '/admin/crescimento', rotulo: 'Crescimento', icone: 'crescimento' },
    ],
  },
  {
    nome: 'Operação',
    itens: [
      { para: '/admin/eventos', rotulo: 'Eventos', icone: 'eventos' },
      { para: '/admin/anfitrioes', rotulo: 'Anfitriões', icone: 'anfitrioes' },
      { para: '/admin/moderacao', rotulo: 'Moderação', icone: 'moderacao' },
    ],
  },
  {
    nome: 'Financeiro',
    itens: [
      { para: '/admin/pagamentos', rotulo: 'Pagamentos', icone: 'pagamentos' },
      { para: '/admin/pacotes', rotulo: 'Pacotes', icone: 'pacotes' },
    ],
  },
  {
    nome: 'Sistema',
    itens: [
      { para: '/admin/configuracoes', rotulo: 'Configurações', icone: 'configuracoes' },
      { para: '/admin/saude', rotulo: 'Saúde', icone: 'saude' },
      { para: '/admin/auditoria', rotulo: 'Auditoria', icone: 'auditoria' },
      { para: '/admin/administradores', rotulo: 'Administradores', icone: 'administradores' },
    ],
  },
]

export function Icone({ nome, className = 'h-[18px] w-[18px]' }: { nome: keyof typeof ICONES | 'menu' | 'fechar'; className?: string }) {
  const desenho = nome === 'menu' ? <path d="M4 7h16M4 12h16M4 17h16" /> : nome === 'fechar' ? <path d="M6 6l12 12M18 6L6 18" /> : ICONES[nome]
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      {desenho}
    </svg>
  )
}

export function Menu({ aoNavegar }: { aoNavegar?: () => void }) {
  return (
    <nav aria-label="Seções do admin" className="flex flex-col gap-5">
      {GRUPOS.map((g) => (
        <div key={g.nome}>
          <p className="mb-1.5 px-3 text-xs font-semibold text-muted/80">{g.nome}</p>
          <ul className="flex flex-col gap-0.5">
            {g.itens.map((i) => (
              <li key={i.para}>
                <NavLink
                  to={i.para}
                  end={i.fim}
                  onClick={aoNavegar}
                  className={({ isActive }) =>
                    `flex min-h-11 items-center gap-3 rounded-[10px] px-3 text-[15px] transition-colors ${isActive ? 'bg-surface font-semibold text-paper' : 'text-muted hover:bg-surface/60 hover:text-paper'}`
                  }
                >
                  <Icone nome={i.icone} />
                  {i.rotulo}
                </NavLink>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  )
}
