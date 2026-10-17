import { useCallback, useEffect, useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { BlocoEstado } from '../../components/BlocoEstado'
import { Botao } from '../../components/Botao'
import { MangoLogo } from '../../components/MangoLogo'
import { ErroApi } from '../../lib/api/tipos.ts'
import { admin, type AdminEu } from '../../lib/admin.ts'
import { Contexto } from './contexto'
import { Entrar } from './Entrar'
import { TrocarSenha } from './TrocarSenha'

type Estado = { tipo: 'carregando' } | { tipo: 'entrar' } | { tipo: 'erro'; mensagem: string } | { tipo: 'ok'; admin: AdminEu }

const ABAS = [
  { para: '/admin', rotulo: 'Resumo', fim: true },
  { para: '/admin/eventos', rotulo: 'Eventos' },
  { para: '/admin/pagamentos', rotulo: 'Pagamentos' },
  { para: '/admin/pacotes', rotulo: 'Pacotes' },
  { para: '/admin/configuracoes', rotulo: 'Configurações' },
  { para: '/admin/auditoria', rotulo: 'Auditoria' },
  { para: '/admin/administradores', rotulo: 'Administradores' },
]

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
        <BlocoEstado titulo="Não deu para abrir o admin" texto={estado.mensagem} acao={<Botao onClick={recarregar}>Tentar de novo</Botao>} className="min-h-dvh" />
      </div>
    )
  }
  if (estado.tipo === 'entrar') return <Entrar aoEntrar={(a) => setEstado({ tipo: 'ok', admin: a })} />
  if (estado.admin.trocar_senha) return <TrocarSenha obrigatoria admin={estado.admin} aoTrocar={recarregar} aoSair={() => void sair()} />

  return (
    <Contexto.Provider value={{ admin: estado.admin, sair }}>
      <div className="min-h-dvh bg-base pb-16 text-paper">
        <header className="border-b border-line">
          <div className="mx-auto flex max-w-[1100px] flex-wrap items-center justify-between gap-3 px-5 py-4">
            <span className="flex items-center gap-2 font-display text-[22px] leading-none">
              <MangoLogo className="h-[21px] w-4" />
              <span className="pb-0.5">mango</span>
              <span className="ml-2 rounded-full border border-line px-2.5 py-1 font-sans text-xs font-semibold text-muted">admin</span>
            </span>
            <div className="flex items-center gap-3 text-sm">
              <NavLink to="/admin/senha" className="text-muted hover:text-paper">
                {estado.admin.nome}
              </NavLink>
              <button type="button" onClick={() => void sair()} className="min-h-11 rounded-[10px] border border-line px-4 font-semibold text-muted transition hover:bg-surface hover:text-paper">
                Sair
              </button>
            </div>
          </div>
          <nav aria-label="Seções do admin" className="mx-auto flex max-w-[1100px] gap-1 overflow-x-auto px-3">
            {ABAS.map((aba) => (
              <NavLink
                key={aba.para}
                to={aba.para}
                end={aba.fim}
                className={({ isActive }) =>
                  `flex min-h-11 shrink-0 items-center border-b-2 px-3 text-[15px] font-semibold transition ${isActive ? 'border-paper text-paper' : 'border-transparent text-muted hover:text-paper'}`
                }
              >
                {aba.rotulo}
              </NavLink>
            ))}
          </nav>
        </header>
        <main className="mx-auto max-w-[1100px] px-5 pt-8">
          <Outlet />
        </main>
      </div>
    </Contexto.Provider>
  )
}
