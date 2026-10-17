import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ErroApi } from '../../lib/api/tipos.ts'
import { admin, formatarBytes, formatarReais, type EventoDetalhe as Dados } from '../../lib/admin.ts'
import { Aviso, Cartao, Titulo } from './ui'
import { dataHora, ESTADOS_EVENTO } from './util'

const STATUS_PAGAMENTO: Record<string, string> = { pendente: 'Pendente', aprovado: 'Aprovado', recusado: 'Recusado', expirado: 'Expirado', estornado: 'Estornado', aprovado_orfao: 'Aprovado sem evento' }
const RESOLUCAO: Record<string, string> = { removida: 'Foto removida', mantida: 'Foto mantida' }

function Linha({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-2.5">
      <dt className="text-muted">{rotulo}</dt>
      <dd className="text-right tabular-nums">{children}</dd>
    </div>
  )
}

export function EventoDetalhe() {
  const { id = '' } = useParams()
  const [dados, setDados] = useState<Dados | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    let ativo = true
    admin
      .evento(id)
      .then((r) => ativo && (setDados(r), setErro(null)))
      .catch((e: unknown) => ativo && setErro(e instanceof ErroApi ? e.message : 'Sem conexão com o servidor.'))
    return () => {
      ativo = false
    }
  }, [id])

  const e = dados?.evento
  return (
    <>
      <Link to="/admin/eventos" className="mb-4 inline-flex min-h-11 items-center text-sm text-muted underline-offset-4 hover:text-paper hover:underline">
        Voltar para os eventos
      </Link>
      {erro && <Aviso tipo="erro">{erro}</Aviso>}
      {!dados && !erro && <p className="text-muted">Carregando...</p>}
      {dados && e && (
        <div className="flex flex-col gap-6">
          <Titulo detalhe={`${e.anfitriao_email} · ${ESTADOS_EVENTO[e.estado] ?? e.estado}${e.excluido_em ? ' · apagado' : ''}`}>{e.nome}</Titulo>
          <div className="grid gap-4 lg:grid-cols-2">
            <Cartao>
              <h2 className="text-sm font-semibold">Evento</h2>
              <dl className="mt-2 divide-y divide-line text-[15px]">
                <Linha rotulo="Pacote">{e.pacote_nome ?? e.pacote}</Linha>
                <Linha rotulo="Link do convite">
                  <code className="rounded-md bg-base px-1.5 py-0.5 text-xs text-muted">/c/{e.codigo}</code>
                </Linha>
                <Linha rotulo="Criado em">{dataHora(e.criado_em)}</Linha>
                <Linha rotulo="Câmera abre">{dataHora(e.captura_inicio)}</Linha>
                <Linha rotulo="Câmera fecha">{dataHora(e.captura_fim)}</Linha>
                <Linha rotulo="Revelação">{e.revelado_em ? `revelado em ${dataHora(e.revelado_em)}` : dataHora(e.revelacao_em)}</Linha>
                <Linha rotulo="Álbum some em">{dataHora(e.expira_em)}</Linha>
                <Linha rotulo="Álbum privado">{e.album_privado ? 'Sim' : 'Não'}</Linha>
              </dl>
            </Cartao>
            <Cartao>
              <h2 className="text-sm font-semibold">Uso</h2>
              <dl className="mt-2 divide-y divide-line text-[15px]">
                <Linha rotulo="Convidados">
                  {dados.convidados.length} <span className="text-muted">/ {e.limite_convidados}</span>
                </Linha>
                <Linha rotulo="Fotos">{dados.fotos.total}</Linha>
                <Linha rotulo="Fotos removidas">{dados.fotos.removidas}</Linha>
                <Linha rotulo="Poses por convidado">{e.poses_por_convidado}</Linha>
                <Linha rotulo="Armazenamento">{formatarBytes(dados.fotos.armazenamento_bytes)}</Linha>
                <Linha rotulo="Primeira foto">{dataHora(dados.fotos.primeira_em)}</Linha>
                <Linha rotulo="Última foto">{dataHora(dados.fotos.ultima_em)}</Linha>
              </dl>
            </Cartao>
          </div>

          <Cartao className="overflow-x-auto p-0">
            <h2 className="px-5 pt-5 text-sm font-semibold">Pagamentos</h2>
            {dados.pagamentos.length === 0 ? (
              <p className="p-5 text-muted">Nenhum pagamento neste evento.</p>
            ) : (
              <table className="mt-3 w-full min-w-[480px] text-left text-[14px]">
                <tbody className="divide-y divide-line border-t border-line">
                  {dados.pagamentos.map((p) => (
                    <tr key={p.id}>
                      <td className="whitespace-nowrap px-5 py-3 text-muted">{dataHora(p.criado_em)}</td>
                      <td className="px-4 py-3">{STATUS_PAGAMENTO[p.status] ?? p.status}</td>
                      <td className="px-5 py-3 text-right tabular-nums">{formatarReais(p.valor_centavos)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Cartao>

          <Cartao className="overflow-x-auto p-0">
            <h2 className="px-5 pt-5 text-sm font-semibold">Pedidos de remoção</h2>
            {dados.pedidos_de_remocao.length === 0 ? (
              <p className="p-5 text-muted">Nenhum pedido neste evento.</p>
            ) : (
              <table className="mt-3 w-full min-w-[560px] text-left text-[14px]">
                <tbody className="divide-y divide-line border-t border-line">
                  {dados.pedidos_de_remocao.map((p) => (
                    <tr key={p.id} className="align-top">
                      <td className="whitespace-nowrap px-5 py-3 text-muted">{dataHora(p.criado_em)}</td>
                      <td className="px-4 py-3 text-muted">{p.motivo || '—'}</td>
                      <td className="px-5 py-3 text-right">{p.resolucao ? (RESOLUCAO[p.resolucao] ?? p.resolucao) : 'Pendente'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Cartao>

          <Cartao className="overflow-x-auto p-0">
            <h2 className="px-5 pt-5 text-sm font-semibold">Convidados ({dados.convidados.length})</h2>
            {dados.convidados.length === 0 ? (
              <p className="p-5 text-muted">Ninguém entrou ainda.</p>
            ) : (
              <table className="mt-3 w-full min-w-[480px] text-left text-[14px]">
                <thead className="border-y border-line text-muted">
                  <tr>
                    <th className="px-5 py-3 font-semibold">Apelido</th>
                    <th className="px-4 py-3 font-semibold">Entrou em</th>
                    <th className="px-5 py-3 text-right font-semibold">Fotos</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {dados.convidados.map((c) => (
                    <tr key={c.id}>
                      <td className="px-5 py-3">{c.apelido || <span className="text-muted">sem apelido</span>}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-muted">{dataHora(c.criado_em)}</td>
                      <td className="px-5 py-3 text-right tabular-nums">{c.fotos}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Cartao>
        </div>
      )}
    </>
  )
}
