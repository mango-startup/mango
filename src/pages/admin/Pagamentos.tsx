import { useEffect, useState } from 'react'
import { ErroApi } from '../../lib/api/tipos.ts'
import { admin, formatarReais, type PaginaPagamentos } from '../../lib/admin.ts'
import { Paginacao } from './Paginacao'
import { Aviso, Cartao, Titulo } from './ui'
import { campoTexto, dataHora } from './util'

const STATUS: Record<string, string> = {
  pendente: 'Pendente',
  aprovado: 'Aprovado',
  recusado: 'Recusado',
  expirado: 'Expirado',
  estornado: 'Estornado',
  aprovado_orfao: 'Aprovado sem evento',
}

export function Pagamentos() {
  const [status, setStatus] = useState('')
  const [pagina, setPagina] = useState(1)
  const [dados, setDados] = useState<PaginaPagamentos | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    let ativo = true
    admin
      .pagamentos(status, pagina)
      .then((r) => ativo && (setDados(r), setErro(null)))
      .catch((e: unknown) => ativo && setErro(e instanceof ErroApi ? e.message : 'Sem conexão com o servidor.'))
    return () => {
      ativo = false
    }
  }, [status, pagina])

  return (
    <>
      <Titulo detalhe="Receita e situação dos pagamentos do Stripe. Os valores são os que o servidor cobrou de cada evento.">Pagamentos</Titulo>
      {erro && <Aviso tipo="erro">{erro}</Aviso>}
      {!dados && !erro && <p className="text-muted">Carregando...</p>}
      {dados && (
        <div className="flex flex-col gap-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Cartao>
              <p className="text-sm text-muted">Receita aprovada</p>
              <p className="mt-1 font-display text-[38px] leading-none tabular-nums">{formatarReais(dados.receita_centavos)}</p>
              <p className="mt-2 text-[13px] text-muted">{dados.por_status.aprovado?.pagamentos ?? 0} pagamentos</p>
            </Cartao>
            {['pendente', 'recusado', 'estornado'].map((s) => (
              <Cartao key={s}>
                <p className="text-sm text-muted">{STATUS[s]}</p>
                <p className="mt-1 font-display text-[38px] leading-none tabular-nums">{dados.por_status[s]?.pagamentos ?? 0}</p>
                <p className="mt-2 text-[13px] text-muted">{formatarReais(dados.por_status[s]?.valor_centavos ?? 0)}</p>
              </Cartao>
            ))}
          </div>
          <div>
            <select
              aria-label="Status"
              value={status}
              onChange={(e) => {
                setStatus(e.target.value)
                setPagina(1)
              }}
              className={`${campoTexto} mb-4 sm:max-w-[260px]`}
            >
              <option value="">Todos os status</option>
              {Object.entries(STATUS).map(([id, rotulo]) => (
                <option key={id} value={id}>
                  {rotulo}
                </option>
              ))}
            </select>
            <Cartao className="overflow-x-auto p-0">
              {dados.pagamentos.length === 0 ? (
                <p className="p-5 text-muted">Nenhum pagamento{status ? ' com esse status' : ' ainda'}.</p>
              ) : (
                <table className="w-full min-w-[640px] text-left text-[14px]">
                  <thead className="border-b border-line text-muted">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Quando</th>
                      <th className="px-4 py-3 font-semibold">Evento</th>
                      <th className="px-4 py-3 font-semibold">Pacote</th>
                      <th className="px-4 py-3 font-semibold">Status</th>
                      <th className="px-4 py-3 text-right font-semibold">Valor</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {dados.pagamentos.map((p) => (
                      <tr key={p.id}>
                        <td className="whitespace-nowrap px-4 py-3 text-muted">{dataHora(p.criado_em)}</td>
                        <td className="px-4 py-3">{p.evento_nome}</td>
                        <td className="px-4 py-3 text-muted">{p.pacote}</td>
                        <td className="px-4 py-3">{STATUS[p.status] ?? p.status}</td>
                        <td className="px-4 py-3 text-right tabular-nums">{formatarReais(p.valor_centavos)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Cartao>
            <Paginacao pagina={dados.pagina} limite={dados.limite} total={dados.total} aoMudar={setPagina} />
          </div>
        </div>
      )}
    </>
  )
}
