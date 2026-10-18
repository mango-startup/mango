import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ErroApi } from '../../lib/api/tipos.ts'
import { admin, errosDeCampo, type EmailEnviado } from '../../lib/admin.ts'
import { Aviso, Campo, Cartao } from './ui'
import { campoTexto, dataHora } from './util'

export function EmailAnfitriao({ eventoId, para }: { eventoId: string; para: string | null }) {
  const [dados, setDados] = useState<{ configurado: boolean; emails: EmailEnviado[] } | null>(null)
  const [assunto, setAssunto] = useState('')
  const [texto, setTexto] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [aviso, setAviso] = useState<{ tipo: 'erro' | 'ok'; texto: string } | null>(null)
  const [erros, setErros] = useState<Record<string, string>>({})
  const [versao, setVersao] = useState(0)

  useEffect(() => {
    let ativo = true
    admin
      .emails(eventoId)
      .then((r) => ativo && setDados(r))
      .catch(() => {})
    return () => {
      ativo = false
    }
  }, [eventoId, versao])

  const enviar = async (ev: React.FormEvent) => {
    ev.preventDefault()
    setEnviando(true)
    setAviso(null)
    setErros({})
    try {
      const r = await admin.enviarEmail(eventoId, assunto, texto)
      setAviso({ tipo: 'ok', texto: `E-mail enviado para ${r.destinatario}.` })
      setAssunto('')
      setTexto('')
    } catch (e) {
      setErros(errosDeCampo(e))
      setAviso({ tipo: 'erro', texto: e instanceof ErroApi ? e.message : 'Sem conexão com o servidor.' })
    } finally {
      setEnviando(false)
      setVersao((v) => v + 1)
    }
  }

  return (
    <Cartao>
      <h2 className="text-sm font-semibold">E-mail ao anfitrião</h2>
      {dados && !dados.configurado ? (
        <p className="mt-2 text-sm text-muted">O envio ainda não está configurado no servidor (falta RESEND_API_KEY). O histórico aparece aqui quando estiver.</p>
      ) : !para ? (
        <p className="mt-2 text-sm text-muted">Este evento não tem e-mail de anfitrião cadastrado.</p>
      ) : (
        <form onSubmit={(ev) => void enviar(ev)} className="mt-3 flex max-w-[640px] flex-col gap-4">
          <p className="text-sm text-muted">Para: {para}. A mensagem sai em texto simples e fica registrada na auditoria.</p>
          <Campo rotulo="Assunto" erro={erros.assunto}>
            {(id) => <Input id={id} value={assunto} maxLength={150} onChange={(e) => setAssunto(e.target.value)} />}
          </Campo>
          <Campo rotulo="Mensagem" erro={erros.texto}>
            {(id) => <textarea id={id} value={texto} maxLength={5000} rows={6} onChange={(e) => setTexto(e.target.value)} className={`${campoTexto} py-3`} />}
          </Campo>
          {aviso && <Aviso tipo={aviso.tipo}>{aviso.texto}</Aviso>}
          <div>
            <Button type="submit" disabled={enviando}>
              {enviando ? 'Enviando...' : 'Enviar e-mail'}
            </Button>
          </div>
        </form>
      )}
      {dados && dados.emails.length > 0 && (
        <ul className="mt-5 divide-y divide-line border-t border-line text-[14px]">
          {dados.emails.map((m) => (
            <li key={m.id} className="py-3">
              <p className="flex flex-wrap justify-between gap-x-4">
                <span className="font-semibold">{m.assunto}</span>
                <span className="text-muted">
                  {m.status === 'enviado' ? 'enviado' : 'falhou'} · {m.usuario} · {dataHora(m.criado_em)}
                </span>
              </p>
              <p className="mt-1 whitespace-pre-wrap text-muted">{m.corpo}</p>
              {m.erro && <p className="mt-1 text-danger-ink">{m.erro}</p>}
            </li>
          ))}
        </ul>
      )}
    </Cartao>
  )
}
