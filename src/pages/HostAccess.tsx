import { useEffect, useId, useState, type FormEvent, type ReactNode } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { BlocoEstado } from '../components/BlocoEstado'
import { Botao } from '../components/Botao'
import { MangoLogo } from '../components/MangoLogo'
import { ErroApi, api } from '../lib/api'

/** Aceita o link inteiro (…/anfitriao#TOKEN) ou só o token. */
function tokenDe(texto: string): string {
  const limpo = texto.trim()
  const hash = limpo.indexOf('#')
  return (hash >= 0 ? limpo.slice(hash + 1) : limpo).trim()
}

const mensagemDeFalha = (e: unknown) =>
  e instanceof ErroApi && e.erro === 'nao_autorizado'
    ? 'Este link não abre nenhum evento. Confira se copiou o link inteiro de anfitrião (não o dos convidados).'
    : 'Não deu para abrir o link agora. Confira sua conexão e tente de novo.'

function Casca({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-base px-5 pb-12 pt-[env(safe-area-inset-top)] text-paper">
      <header className="mx-auto flex min-h-16 max-w-[480px] items-center">
        <Link to="/" className="flex min-h-11 items-center gap-2 font-display text-[22px] leading-none">
          <MangoLogo className="h-[21px] w-4" />
          <span className="pb-0.5">mango</span>
        </Link>
      </header>
      <main className="mx-auto mt-8 max-w-[480px]">{children}</main>
    </div>
  )
}

// /entrar — no piloto não há login: quem tem o link de anfitrião (criado junto com o evento) administra o evento.
export function HostSignInPage() {
  const navigate = useNavigate()
  const idCampo = useId()
  const [link, setLink] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [abrindo, setAbrindo] = useState(false)
  const temEventos = api.anfitriaoNesteAparelho()

  async function abrir(e: FormEvent) {
    e.preventDefault()
    const token = tokenDe(link)
    if (!token) return setErro('Cole o link de anfitrião que você recebeu ao criar o evento.')
    setAbrindo(true)
    setErro(null)
    try {
      const evento = await api.entrarComoAnfitriao(token)
      navigate(`/eventos/${evento.id}`, { replace: true })
    } catch (err) {
      setErro(mensagemDeFalha(err))
      setAbrindo(false)
    }
  }

  return (
    <Casca>
      <h1 className="font-display text-[44px] leading-none [text-wrap:balance]">Acesso do anfitrião</h1>
      <p className="mt-4 text-[15px] leading-normal text-muted">
        Ao criar o evento, você recebeu um link de anfitrião. Abra esse link neste aparelho, ou cole aqui, para administrar o evento.
      </p>

      <form onSubmit={abrir} noValidate className="mt-8 flex flex-col gap-3">
        <label htmlFor={idCampo} className="text-sm font-semibold">
          Link de anfitrião
        </label>
        <input
          id={idCampo}
          value={link}
          onChange={(e) => {
            setLink(e.target.value)
            setErro(null)
          }}
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          placeholder="https://…/anfitriao#…"
          className="min-h-12 rounded-[14px] border border-line bg-surface px-4 text-base text-paper placeholder:text-muted/60"
        />
        {erro && (
          <p role="alert" className="text-sm text-danger-ink">
            {erro}
          </p>
        )}
        <Botao type="submit" disabled={abrindo} className="mt-2 w-full">
          {abrindo ? 'Abrindo...' : 'Abrir o evento'}
        </Botao>
      </form>

      <div className="mt-10 flex flex-col gap-3 border-t border-line pt-6 text-[15px] leading-normal text-muted">
        <p>
          <strong className="font-semibold text-paper">Perdeu o link?</strong> Ele fica salvo no aparelho em que você criou o evento: abra{' '}
          <Link to="/eventos" className="text-paper underline underline-offset-2">
            Meus eventos
          </Link>{' '}
          por lá e copie no painel.
        </p>
        <p>Quem tiver esse link controla o evento. Não mande para os convidados.</p>
      </div>

      <div className="mt-8 flex flex-col gap-2">
        {temEventos && (
          <Botao para="/eventos" variante="secundario" className="w-full">
            Meus eventos
          </Botao>
        )}
        <Botao para="/criar" variante="discreto" className="w-full">
          Criar uma câmera
        </Botao>
      </div>
    </Casca>
  )
}

// /anfitriao#<token>: guarda o acesso neste aparelho e leva ao painel do evento.
export function HostLinkPage() {
  const { hash } = useLocation()
  const navigate = useNavigate()
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    const token = tokenDe(hash)
    if (!token) {
      navigate('/entrar', { replace: true })
      return
    }
    let ativo = true
    api.entrarComoAnfitriao(token).then(
      (evento) => ativo && navigate(`/eventos/${evento.id}`, { replace: true }),
      (e: unknown) => ativo && setErro(mensagemDeFalha(e)),
    )
    return () => {
      ativo = false
    }
  }, [hash, navigate])

  return (
    <Casca>
      {erro ? (
        <BlocoEstado className="py-12" titulo="Link inválido" texto={erro} acao={<Botao para="/entrar">Tentar outro link</Botao>} />
      ) : (
        <p role="status" className="py-16 text-center text-[15px] text-muted">
          Abrindo o evento...
        </p>
      )}
    </Casca>
  )
}
