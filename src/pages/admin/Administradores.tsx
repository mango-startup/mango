import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { CampoCopiavel } from '../../components/CampoCopiavel'
import { Confirmacao } from '../../components/Confirmacao'
import { ErroApi } from '../../lib/api/tipos.ts'
import { admin, type Administrador } from '../../lib/admin.ts'
import { useAdmin } from './useAdmin'
import { Aviso, Cartao, Titulo, Carregando } from './ui'
import { dataHora } from './util'

export function Administradores() {
  const { admin: eu } = useAdmin()
  const [lista, setLista] = useState<Administrador[] | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [alvo, setAlvo] = useState<Administrador | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [temporaria, setTemporaria] = useState<{ usuario: string; senha: string } | null>(null)

  const [versao, setVersao] = useState(0)

  useEffect(() => {
    let ativo = true
    admin
      .administradores()
      .then((l) => ativo && (setLista(l), setErro(null)))
      .catch((e: unknown) => ativo && setErro(e instanceof ErroApi ? e.message : 'Sem conexão com o servidor.'))
    return () => {
      ativo = false
    }
  }, [versao])

  async function redefinir() {
    if (!alvo) return
    setEnviando(true)
    try {
      const r = await admin.redefinirSenha(alvo.id)
      setTemporaria({ usuario: r.usuario, senha: r.senha_temporaria })
      setAlvo(null)
      setVersao((v) => v + 1)
    } catch (e) {
      setErro(e instanceof ErroApi ? e.message : 'Sem conexão com o servidor.')
      setAlvo(null)
    } finally {
      setEnviando(false)
    }
  }

  return (
    <>
      <Titulo detalhe="Quem pode entrar neste admin. Se alguém esquecer a senha, o outro gera uma temporária; a pessoa é obrigada a trocá-la no primeiro acesso.">Administradores</Titulo>
      {erro && <Aviso tipo="erro">{erro}</Aviso>}
      {temporaria && (
        <Cartao className="mb-6">
          <h2 className="mb-1 text-[18px] font-semibold">Senha temporária de {temporaria.usuario}</h2>
          <p className="mb-4 text-sm text-muted">Mostrada só agora. Passe para a pessoa por um canal seguro; as sessões dela foram encerradas e ela precisa trocar a senha ao entrar.</p>
          <CampoCopiavel rotulo="Senha temporária" valor={temporaria.senha} />
          <Button variant="ghost" onClick={() => setTemporaria(null)} className="mt-3">
            Já anotei
          </Button>
        </Cartao>
      )}
      {!lista && !erro && <Carregando />}
      <div className="flex flex-col gap-4">
        {lista?.map((a) => (
          <Cartao key={a.id}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="flex flex-wrap items-center gap-2 text-[18px] font-semibold">
                  {a.nome}
                  <code className="rounded-md bg-base px-2 py-0.5 text-xs font-normal text-muted">{a.usuario}</code>
                  {a.usuario === eu.usuario && <span className="rounded-full border border-line px-2 py-0.5 text-xs font-normal text-muted">você</span>}
                  {a.trocar_senha && <span className="rounded-full border border-line px-2 py-0.5 text-xs font-normal text-muted">precisa trocar a senha</span>}
                </h2>
                <p className="mt-1 text-[15px] text-muted">Último acesso: {dataHora(a.ultimo_login_em)}</p>
              </div>
              {a.usuario !== eu.usuario && !alvo && (
                <Button variant="outline" onClick={() => setAlvo(a)}>
                  Redefinir senha
                </Button>
              )}
            </div>
            {alvo?.id === a.id && (
              <Confirmacao
                className="mt-5 border-t border-line pt-5"
                pergunta={`Redefinir a senha de ${a.nome}?`}
                detalhe="Gera uma senha temporária, encerra as sessões dele(a) e exige trocar a senha no próximo acesso."
                rotuloConfirmar="Redefinir"
                rotuloCarregando="Redefinindo..."
                carregando={enviando}
                destrutiva
                onConfirmar={() => void redefinir()}
                onCancelar={() => setAlvo(null)}
              />
            )}
          </Cartao>
        ))}
      </div>
      <p className="mt-6 text-sm text-muted">
        Para trocar a sua própria senha, use o seu nome no topo da página.
      </p>
    </>
  )
}
