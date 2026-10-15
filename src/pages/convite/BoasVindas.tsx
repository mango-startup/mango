import { useId, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Botao } from '../../components/Botao'
import { ErroApi, api, type Entrada, type EventoPublico } from '../../lib/api'
import { quando } from '../../lib/datas'

interface BoasVindasProps {
  codigo: string
  evento: EventoPublico
  onEntrou: (entrada: Entrada) => void
  /** O estado do evento mudou enquanto a pessoa lia (fechou, lotou): recarregar. */
  onMudou: () => void
}

// Primeira tela do convidado: o que é, as regras em três linhas e um nome opcional.
export function BoasVindas({ codigo, evento, onEntrou, onMudou }: BoasVindasProps) {
  const idNome = useId()
  const [apelido, setApelido] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  async function entrar(e: FormEvent) {
    e.preventDefault()
    setEnviando(true)
    setErro(null)
    try {
      onEntrou(await api.entrar(codigo, apelido))
    } catch (err) {
      if (err instanceof ErroApi && (err.erro === 'lotado' || err.erro === 'captura_fechada')) {
        onMudou()
        return
      }
      setErro('Não foi possível entrar agora. Confira sua conexão e tente de novo.')
      setEnviando(false)
    }
  }

  return (
    <form onSubmit={entrar} className="mx-auto flex w-full max-w-[440px] flex-1 flex-col px-5 pb-6">
      <div className="mt-6">
        <h1 className="font-display text-[44px] leading-[1.02] [text-wrap:balance]">{evento.nome}</h1>
        {evento.captura_fim && (
          <p className="mt-3 text-[15px] text-muted">Câmera aberta até {quando(evento.captura_fim)}</p>
        )}
      </div>

      <div className="mt-10 flex items-center gap-5 border-y border-line py-5">
        <span className="flex flex-col items-center leading-none">
          <span className="font-display text-[56px] tabular-nums">{evento.poses_por_convidado}</span>
          <span className="mt-1 text-xs text-muted">poses</span>
        </span>
        <ul className="flex flex-col gap-1.5 text-[15px] leading-snug">
          <li>Você tem {evento.poses_por_convidado} fotos no seu rolo.</li>
          <li>Ninguém vê as fotos até a revelação.</li>
          <li>
            {evento.revelacao_manual || !evento.revelacao_em
              ? 'A revelação acontece quando o anfitrião decidir.'
              : `Revelação ${quando(evento.revelacao_em)}.`}
          </li>
        </ul>
      </div>

      <div className="mt-8 flex flex-col gap-2">
        <label htmlFor={idNome} className="text-sm font-semibold">
          Seu nome no álbum <span className="font-normal text-muted">(opcional)</span>
        </label>
        <input
          id={idNome}
          value={apelido}
          onChange={(e) => setApelido(e.target.value)}
          maxLength={40}
          autoComplete="given-name"
          enterKeyHint="go"
          placeholder="Marina"
          className="min-h-12 rounded-[14px] border border-line bg-surface px-4 text-base text-paper placeholder:text-muted/60"
        />
      </div>

      {erro && (
        <p role="alert" className="mt-4 text-sm text-danger-ink">
          {erro}
        </p>
      )}

      <div className="mt-auto pt-8">
        <Botao type="submit" disabled={enviando} className="w-full">
          {enviando ? 'Abrindo...' : 'Abrir a câmera'}
        </Botao>
        <p className="mt-3 text-center text-xs leading-relaxed text-muted">
          Ao entrar, você concorda com os{' '}
          <Link to="/termos" className="underline underline-offset-2">
            termos
          </Link>{' '}
          e a{' '}
          <Link to="/privacidade" className="underline underline-offset-2">
            política de privacidade
          </Link>
          .
        </p>
      </div>
    </form>
  )
}
