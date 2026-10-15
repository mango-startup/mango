import { useState, type FormEvent } from 'react'
import { Botao } from '../../components/Botao'
import { MangoLogo } from '../../components/MangoLogo'
import { ErroApi } from '../../lib/api/tipos.ts'
import { admin, type AdminEu } from '../../lib/admin.ts'
import {Aviso, Campo} from './ui'
import { campoTexto } from './util'

function mensagemDe(e: unknown): string {
  if (e instanceof ErroApi) {
    if (e.erro === 'conta_bloqueada') {
      const min = Math.max(1, Math.ceil(Number(e.extra.retry_em_segundos ?? 900) / 60))
      return `Muitas tentativas. Tente de novo em cerca de ${min} minuto${min > 1 ? 's' : ''}.`
    }
    return e.message
  }
  return 'Sem conexão com o servidor. Tente de novo.'
}

export function Entrar({ aoEntrar }: { aoEntrar: (a: AdminEu) => void }) {
  const [usuario, setUsuario] = useState('')
  const [senha, setSenha] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  async function enviar(e: FormEvent) {
    e.preventDefault()
    if (!usuario.trim() || !senha) return setErro('Informe o usuário e a senha.')
    setEnviando(true)
    setErro(null)
    try {
      aoEntrar(await admin.entrar(usuario, senha))
    } catch (err) {
      setErro(mensagemDe(err))
      setSenha('')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-base px-5 text-paper">
      <form onSubmit={enviar} className="flex w-full max-w-[380px] flex-col gap-5">
        <span className="flex items-center gap-2 font-display text-[28px] leading-none">
          <MangoLogo className="h-[26px] w-5" />
          <span className="pb-1">mango</span>
          <span className="ml-2 rounded-full border border-line px-2.5 py-1 font-sans text-xs font-semibold text-muted">admin</span>
        </span>
        <h1 className="font-display text-[34px] leading-none">Entrar</h1>
        <Campo rotulo="Usuário">
          {(id) => <input id={id} value={usuario} onChange={(e) => setUsuario(e.target.value)} autoComplete="username" autoCapitalize="none" autoFocus className={campoTexto} />}
        </Campo>
        <Campo rotulo="Senha" ajuda="No primeiro acesso, use a senha inicial que você recebeu. O sistema pede para trocá-la na hora.">
          {(id) => <input id={id} type="password" value={senha} onChange={(e) => setSenha(e.target.value)} autoComplete="current-password" className={campoTexto} />}
        </Campo>
        {erro && <Aviso tipo="erro">{erro}</Aviso>}
        <Botao type="submit" disabled={enviando}>
          {enviando ? 'Entrando...' : 'Entrar'}
        </Botao>
      </form>
    </div>
  )
}
