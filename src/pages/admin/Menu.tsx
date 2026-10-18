import { NavLink, useLocation } from 'react-router-dom'
import { SidebarGroup, SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar } from '@/components/ui/sidebar'
import { useEffect, useState, type ReactNode } from 'react'
import { admin } from '../../lib/admin.ts'

// Ícones de traço simples (24x24), no mesmo peso do texto. Sem dependência nova.
const ICONES: Record<string, ReactNode> = {
  analise: <path d="M5 20V10M12 20V4M19 20v-7" />,
  resumo: <path d="M4 5h7v7H4zM13 5h7v4h-7zM13 11h7v8h-7zM4 14h7v5H4z" />,
  crescimento: <path d="M4 19V5M4 19h16M8 15l3-4 3 2 5-7" />,
  aovivo: <path d="M12 12m-2 0a2 2 0 1 0 4 0 2 2 0 1 0-4 0M7.5 7.5a6 6 0 0 0 0 9M16.5 7.5a6 6 0 0 1 0 9" />,
  uso: <path d="M4 6c0-1.1 3.6-2 8-2s8 .9 8 2-3.6 2-8 2-8-.9-8-2zM4 6v6c0 1.1 3.6 2 8 2s8-.9 8-2V6M4 12v6c0 1.1 3.6 2 8 2s8-.9 8-2v-6" />,
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
      { para: '/admin/uso', rotulo: 'Uso e retenção', icone: 'uso' },
    ],
  },
  {
    nome: 'Operação',
    itens: [
      { para: '/admin/ao-vivo', rotulo: 'Ao vivo', icone: 'aovivo' },
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

export function Icone({ nome, className = 'size-[18px]' }: { nome: keyof typeof ICONES; className?: string }) {
  const desenho = ICONES[nome]
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      {desenho}
    </svg>
  )
}

export function Menu() {
  const { pathname } = useLocation()
  const { setOpenMobile } = useSidebar()
  // Contador no menu: pedidos de remoção esperando alguém. Falhar aqui não atrapalha a navegação.
  const [pendentes, setPendentes] = useState(0)
  useEffect(() => {
    admin.resumo().then((r) => setPendentes(r.pedidos_de_remocao_pendentes)).catch(() => {})
  }, [pathname])
  return (
    <>
      {GRUPOS.map((g) => (
        <SidebarGroup key={g.nome}>
          <SidebarGroupLabel>{g.nome}</SidebarGroupLabel>
          <SidebarMenu>
            {g.itens.map((i) => (
              <SidebarMenuItem key={i.para}>
                <SidebarMenuButton asChild tooltip={i.rotulo} className="h-10 group-data-[collapsible=icon]:mx-auto group-data-[collapsible=icon]:size-11! group-data-[collapsible=icon]:justify-center" isActive={i.fim ? pathname === i.para : pathname.startsWith(i.para)}>
                  <NavLink to={i.para} end={i.fim} onClick={() => setOpenMobile(false)}>
                    <Icone nome={i.icone} />
                    {i.rotulo}
                    {i.icone === 'moderacao' && pendentes > 0 && <span className="ml-auto rounded-full group-data-[collapsible=icon]:hidden bg-danger/20 px-2 py-0.5 text-xs font-semibold text-danger-ink">{pendentes}</span>}
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroup>
      ))}
    </>
  )
}
