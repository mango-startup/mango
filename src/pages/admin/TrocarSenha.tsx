import { useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import { ErroApi } from '../../lib/api/tipos.ts'
import { admin, type AdminEu } from '../../lib/admin.ts'
import { useAdminOpcional } from './useAdminOpcional'
import {Aviso, Campo, Cartao, Titulo} from './ui'
import { Input } from '@/components/ui/input'

interface Props {
  /** Primeiro acesso: tela sozinha, sem abas, até trocar. */
  obrigatoria?: boolean
  admin?: AdminEu
  aoTrocar?: () => void
  aoSair?: () => void
}

export function TrocarSenha({ obrigatoria = false, admin: adminProp, aoTrocar, aoSair }: Props) {
  const logado = useAdminOpcional()
  const eu = adminProp ?? logado?.admin
  const [atual, setAtual] = useState('')
  const [nova, setNova] = useState('')
  const [confirmacao, setConfirmacao] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [ok, setOk] = useState(false)

  async function enviar(e: FormEvent) {
    e.preventDefault()
    setOk(false)
    if (nova !== confirmacao) return setErro('A confirmação não bate com a senha nova.')
    setEnviando(true)
    setErro(null)
    try {
      await admin.trocarSenha(atual, nova)
      setAtual('')
      setNova('')
      setConfirmacao('')
      setOk(true)
      aoTrocar?.()
    } catch (err) {
      setErro(err instanceof ErroApi ? err.message : 'Sem conexão com o servidor. Tente de novo.')
    } finally {
      setEnviando(false)
    }
  }

  const formulario = (
    <form onSubmit={enviar} className="flex max-w-[420px] flex-col gap-5">
      {/* O navegador usa este campo para associar a senha nova ao usuário certo no gerenciador de senhas. */}
      <input type="text" name="username" value={eu?.usuario ?? ''} autoComplete="username" readOnly hidden />
      <Campo rotulo={obrigatoria ? 'Senha inicial' : 'Senha atual'}>
        {(id) => <Input id={id} type="password" value={atual} onChange={(e) => setAtual(e.target.value)} autoComplete="current-password" autoFocus />}
      </Campo>
      <Campo rotulo="Senha nova" ajuda="Pelo menos 10 caracteres, com letras e números, diferente da atual e sem o seu usuário.">
        {(id) => <Input id={id} type="password" value={nova} onChange={(e) => setNova(e.target.value)} autoComplete="new-password" />}
      </Campo>
      <Campo rotulo="Repita a senha nova">
        {(id) => <Input id={id} type="password" value={confirmacao} onChange={(e) => setConfirmacao(e.target.value)} autoComplete="new-password" />}
      </Campo>
      {erro && <Aviso tipo="erro">{erro}</Aviso>}
      {ok && !obrigatoria && <Aviso tipo="ok">Senha trocada. As suas outras sessões foram encerradas.</Aviso>}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={enviando || !atual || !nova || !confirmacao}>
          {enviando ? 'Salvando...' : 'Trocar senha'}
        </Button>
        {obrigatoria && aoSair && (
          <Button variant="ghost" onClick={aoSair}>
            Sair
          </Button>
        )}
      </div>
    </form>
  )

  if (obrigatoria) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-base px-5 py-10 text-paper">
        <div className="w-full max-w-[460px]">
          <h1 className="font-display text-[34px] leading-none">Defina a sua senha</h1>
          <p className="mb-6 mt-3 text-[15px] leading-normal text-muted">
            {eu ? `Olá, ${eu.nome}. ` : ''}Esta é a senha inicial. Por segurança, troque agora por uma só sua: até lá o admin fica bloqueado.
          </p>
          {formulario}
        </div>
      </div>
    )
  }
  return (
    <>
      <Titulo>Minha senha</Titulo>
      <Cartao className="max-w-[480px]">{formulario}</Cartao>
    </>
  )
}
