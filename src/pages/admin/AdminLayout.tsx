import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Sidebar, SidebarContent, SidebarFooter, SidebarHeader, SidebarInset, SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar'
import { NavLink, Outlet } from 'react-router-dom'
import { BlocoEstado } from '../../components/BlocoEstado'
import { MangoLogo } from '../../components/MangoLogo'
import { ErroApi } from '../../lib/api/tipos.ts'
import { admin, type AdminEu } from '../../lib/admin.ts'
import { Contexto } from './contexto'
import { Entrar } from './Entrar'
import { Menu } from './Menu'
import { TrocarSenha } from './TrocarSenha'

type Estado = { tipo: 'carregando' } | { tipo: 'entrar' } | { tipo: 'erro'; mensagem: string } | { tipo: 'ok'; admin: AdminEu }

// /admin — só para os donos do Mango. Fora da navegação do site e fora dos buscadores. Sem sessão mostra o login;
// com a senha inicial só deixa trocar a senha; depois libera as abas.
export function AdminLayout() {
  const [estado, setEstado] = useState<Estado>({ tipo: 'carregando' })

  useEffect(() => {
    const meta = document.createElement('meta')
    meta.name = 'robots'
    meta.content = 'noindex, nofollow'
    document.head.appendChild(meta)
    const titulo = document.title
    document.title = 'Admin · Mango'
    return () => {
      meta.remove()
      document.title = titulo
    }
  }, [])

  // Mudar `versao` pergunta de novo ao servidor quem está logado (tentar de novo, depois de trocar a senha).
  const [versao, setVersao] = useState(0)

  useEffect(() => {
    let ativo = true
    admin
      .eu()
      .then((a) => ativo && setEstado({ tipo: 'ok', admin: a }))
      .catch((e: unknown) => {
        if (!ativo) return
        if (e instanceof ErroApi && e.status === 401) setEstado({ tipo: 'entrar' })
        else setEstado({ tipo: 'erro', mensagem: e instanceof ErroApi ? e.message : 'Sem conexão com o servidor.' })
      })
    return () => {
      ativo = false
    }
  }, [versao])

  const recarregar = useCallback(() => {
    setEstado({ tipo: 'carregando' })
    setVersao((v) => v + 1)
  }, [])

  const sair = useCallback(async () => {
    try {
      await admin.sair()
    } finally {
      setEstado({ tipo: 'entrar' })
    }
  }, [])

  if (estado.tipo === 'carregando') return <p className="p-8 text-center text-muted">Carregando...</p>
  if (estado.tipo === 'erro') {
    return (
      <div className="min-h-dvh bg-base text-paper">
        <BlocoEstado titulo="Não deu para abrir o admin" texto={estado.mensagem} acao={<Button onClick={recarregar}>Tentar de novo</Button>} className="min-h-dvh" />
      </div>
    )
  }
  if (estado.tipo === 'entrar') return <Entrar aoEntrar={(a) => setEstado({ tipo: 'ok', admin: a })} />
  if (estado.admin.trocar_senha) return <TrocarSenha obrigatoria admin={estado.admin} aoTrocar={recarregar} aoSair={() => void sair()} />

  const marca = (
    <span className="flex items-center gap-2 font-display text-[22px] leading-none">
      <MangoLogo className="h-[21px] w-4" />
      <span className="pb-0.5">mango</span>
      <span className="ml-1 rounded-full border border-line px-2.5 py-1 font-sans text-xs font-semibold text-muted">admin</span>
    </span>
  )

  return (
    <Contexto.Provider value={{ admin: estado.admin, sair }}>
      <SidebarProvider className="bg-base text-paper">
        <Sidebar>
          <SidebarHeader className="px-4 pt-5">{marca}</SidebarHeader>
          <SidebarContent>
            <Menu />
          </SidebarContent>
          <SidebarFooter>
            <div className="flex items-center justify-between gap-2 border-t border-line pt-3">
              <NavLink to="/admin/senha" title="Trocar a senha" className="min-w-0 flex-1 truncate rounded-[10px] px-3 py-2.5 text-sm text-muted transition-colors hover:bg-surface hover:text-paper">
                {estado.admin.nome}
              </NavLink>
              <Button type="button" variant="ghost" onClick={() => void sair()} className="h-11 text-muted">
                Sair
              </Button>
            </div>
          </SidebarFooter>
        </Sidebar>

        <SidebarInset className="bg-base">
          {/* Celular: barra no topo; o botão abre a gaveta (Sheet) com foco preso e Esc. */}
          <header className="sticky top-0 z-20 flex items-center justify-between border-b border-line bg-base px-4 py-2 md:hidden">
            {marca}
            <SidebarTrigger aria-label="Abrir o menu" className="size-11" />
          </header>
          <main className="min-w-0 flex-1 px-5 pb-16 pt-8 lg:px-10 lg:pt-10">
            <div className="mx-auto max-w-[1100px]">
              <Outlet />
            </div>
          </main>
        </SidebarInset>
      </SidebarProvider>
    </Contexto.Provider>
  )
}
