import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ErroApi } from '../../lib/api/tipos.ts'
import { admin, formatarReais, urlCsv, type PaginaPagamentos } from '../../lib/admin.ts'
import { useNomesPacotes } from './usePacotes'
import { Paginacao } from './Paginacao'
import { ExportarCsv, Aviso, Cartao, Titulo, Carregando, EstadoVazio } from './ui'
import { campoTexto, dataHora } from './util'
import { useFiltrosUrl } from './useFiltrosUrl'

const STATUS: Record<string, string> = {
  pendente: 'Pendente',
  aprovado: 'Aprovado',
  recusado: 'Recusado',
  expirado: 'Expirado',
  estornado: 'Estornado',
  aprovado_orfao: 'Aprovado sem evento',
}

export function Pagamentos() {
  const nomePacote = useNomesPacotes()
  const { valores: f, definir, limpar, ativos } = useFiltrosUrl({ status: '', de: '', ate: '', limite: '25', pagina: '1' })
  const [dados, setDados] = useState<PaginaPagamentos | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    let ativo = true
    admin
      .pagamentos({ status: f.status, de: f.de, ate: f.ate, limite: f.limite }, Number(f.pagina) || 1)
      .then((r) => ativo && (setDados(r), setErro(null)))
      .catch((e: unknown) => ativo && setErro(e instanceof ErroApi ? e.message : 'Sem conexão com o servidor.'))
    return () => {
      ativo = false
    }
  }, [f.status, f.de, f.ate, f.limite, f.pagina])

  return (
    <>
      <Titulo detalhe="Receita e situação dos pagamentos do Stripe. Os valores são os que o servidor cobrou de cada evento.">Pagamentos</Titulo>
      {erro && <Aviso tipo="erro">{erro}</Aviso>}
      {!dados && !erro && <Carregando />}
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
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <select aria-label="Status" value={f.status} onChange={(e) => definir({ status: e.target.value })} className={`${campoTexto} sm:max-w-[220px]`}>
                <option value="">Todos os status</option>
                {Object.entries(STATUS).map(([id, rotulo]) => (
                  <option key={id} value={id}>
                    {rotulo}
                  </option>
                ))}
              </select>
              <label className="flex items-center gap-2 text-sm text-muted">
                De
                <Input type="date" value={f.de} onChange={(e) => definir({ de: e.target.value })} />
              </label>
              <label className="flex items-center gap-2 text-sm text-muted">
                Até
                <Input type="date" value={f.ate} onChange={(e) => definir({ ate: e.target.value })} />
              </label>
              <select aria-label="Itens por página" value={f.limite} onChange={(e) => definir({ limite: e.target.value })} className={`${campoTexto} sm:max-w-[170px]`}>
                {['25', '50', '100'].map((n) => (
                  <option key={n} value={n}>
                    {n} por página
                  </option>
                ))}
              </select>
              {ativos > 0 && (
                <Button type="button" variant="ghost" onClick={limpar}>
                  Limpar filtros
                </Button>
              )}
            </div>
            <ExportarCsv href={urlCsv('pagamentos', { status: f.status, de: f.de, ate: f.ate })} />
            </div>
            <Cartao className="overflow-x-auto p-0">
              {dados.pagamentos.length === 0 ? (
                <EstadoVazio>Nenhum pagamento{ativos > 0 ? ' com esses filtros' : ' ainda'}.</EstadoVazio>
              ) : (
                <table className="tabela-cards w-full sm:min-w-[640px] text-left text-[14px]">
                  <thead className="sticky top-0 border-b border-line bg-surface text-muted">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Quando</th>
                      <th className="px-4 py-3 font-semibold">Evento</th>
                      <th className="px-4 py-3 font-semibold">Pacote</th>
                      <th className="px-4 py-3 font-semibold">Status</th>
                      <th className="px-4 py-3 text-right font-semibold">Valor</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line [&_tr:hover]:bg-surface/70">
                    {dados.pagamentos.map((p) => (
                      <tr key={p.id}>
                        <td className="whitespace-nowrap px-4 py-3 text-muted">{dataHora(p.criado_em)}</td>
                        <td className="px-4 py-3">{p.evento_nome}</td>
                        <td className="px-4 py-3 text-muted">{nomePacote(p.pacote)}</td>
                        <td className="px-4 py-3">{STATUS[p.status] ?? p.status}</td>
                        <td className="px-4 py-3 text-right tabular-nums">{formatarReais(p.valor_centavos)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Cartao>
            <Paginacao pagina={dados.pagina} limite={dados.limite} total={dados.total} aoMudar={(n) => definir({ pagina: String(n) })} />
          </div>
        </div>
      )}
    </>
  )
}
