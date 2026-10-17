import { useCallback, useEffect, useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { BlocoEstado } from '../../components/BlocoEstado'
import { Botao } from '../../components/Botao'
import { MangoLogo } from '../../components/MangoLogo'
import { ErroApi } from '../../lib/api/tipos.ts'
import { admin, type AdminEu } from '../../lib/admin.ts'
import { Contexto } from './contexto'
import { Entrar } from './Entrar'
import { Icone, Menu } from './Menu'
import { TrocarSenha } from './TrocarSenha'

type Estado = { tipo: 'carregando' } | { tipo: 'entrar' } | { tipo: 'erro'; mensagem: string } | { tipo: 'ok'; admin: AdminEu }

// /admin — só para os donos do Mango. Fora da navegação do site e fora dos buscadores. Sem sessão mostra o login;
// com a senha inicial só deixa trocar a senha; depois libera as abas.
export function AdminLayout() {
  const [estado, setEstado] = useState<Estado>({ tipo: 'carregando' })
  const [menuAberto, setMenuAberto] = useState(false)

  // Esc fecha o menu do celular; escolher uma seção também (aoNavegar).
  useEffect(() => {
    if (!menuAberto) return
    const aoTeclar = (e: KeyboardEvent) => e.key === 'Escape' && setMenuAberto(false)
    window.addEventListener('keydown', aoTeclar)
    return () => window.removeEventListener('keydown', aoTeclar)
  }, [menuAberto])

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
        <BlocoEstado titulo="Não deu para abrir o admin" texto={estado.mensagem} acao={<Botao onClick={recarregar}>Tentar de novo</Botao>} className="min-h-dvh" />
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
  const usuario = (
    <div className="flex items-center justify-between gap-2 border-t border-line pt-3">
      <NavLink to="/admin/senha" title="Trocar a senha" className="min-w-0 flex-1 truncate rounded-[10px] px-3 py-2.5 text-sm text-muted transition-colors hover:bg-surface/60 hover:text-paper">
        {estado.admin.nome}
      </NavLink>
      <button type="button" onClick={() => void sair()} className="min-h-11 shrink-0 rounded-[10px] px-3 text-sm font-semibold text-muted transition-colors hover:bg-surface/60 hover:text-paper">
        Sair
      </button>
    </div>
  )

  return (
    <Contexto.Provider value={{ admin: estado.admin, sair }}>
      <div className="min-h-dvh bg-base text-paper lg:flex">
        {/* Desktop: sidebar fixa à esquerda, do mesmo tom do fundo, separada por uma linha. */}
        <aside className="sticky top-0 hidden h-dvh w-[248px] shrink-0 flex-col justify-between border-r border-line px-3 py-5 lg:flex">
          <div className="flex flex-col gap-7 overflow-y-auto">
            <div className="px-3">{marca}</div>
            <Menu />
          </div>
          {usuario}
        </aside>

        {/* Celular: barra no topo com o botão do menu. */}
        <header className="sticky top-0 z-20 flex items-center justify-between border-b border-line bg-base px-4 py-2 lg:hidden">
          {marca}
          <button type="button" aria-label="Abrir o menu" aria-expanded={menuAberto} onClick={() => setMenuAberto(true)} className="grid min-h-11 min-w-11 place-items-center rounded-[10px] text-muted hover:bg-surface/60 hover:text-paper">
            <Icone nome="menu" className="h-5 w-5" />
          </button>
        </header>
        {menuAberto && (
          <div className="fixed inset-0 z-30 lg:hidden">
            <button type="button" aria-label="Fechar o menu" onClick={() => setMenuAberto(false)} className="absolute inset-0 bg-black/60" />
            <div role="dialog" aria-modal="true" aria-label="Menu do admin" className="absolute inset-y-0 left-0 flex w-[280px] max-w-[85vw] flex-col justify-between gap-6 overflow-y-auto border-r border-line bg-base px-3 py-4">
              <div className="flex flex-col gap-6">
                <div className="flex items-center justify-between pl-3">
                  {marca}
                  <button type="button" aria-label="Fechar o menu" onClick={() => setMenuAberto(false)} className="grid min-h-11 min-w-11 place-items-center rounded-[10px] text-muted hover:text-paper">
                    <Icone nome="fechar" className="h-5 w-5" />
                  </button>
                </div>
                <Menu aoNavegar={() => setMenuAberto(false)} />
              </div>
              {usuario}
            </div>
          </div>
        )}

        <main className="min-w-0 flex-1 px-5 pb-16 pt-8 lg:px-10 lg:pt-10">
          <div className="mx-auto max-w-[1100px]">
            <Outlet />
          </div>
        </main>
      </div>
    </Contexto.Provider>
  )
}
