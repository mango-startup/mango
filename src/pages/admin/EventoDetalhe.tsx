import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ErroApi } from '../../lib/api/tipos.ts'
import { admin, formatarBytes, formatarReais, type EventoDetalhe as Dados } from '../../lib/admin.ts'
import { Button } from '@/components/ui/button'
import { EmailAnfitriao } from './EmailAnfitriao'
import { Aviso, Cartao, Titulo, Carregando, EstadoVazio } from './ui'
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

  const [estendendo, setEstendendo] = useState(false)
  const [aviso, setAviso] = useState<{ tipo: 'erro' | 'ok'; texto: string } | null>(null)

  const estender = async (minutos: number) => {
    setEstendendo(true)
    setAviso(null)
    try {
      const r = await admin.estenderCamera(id, minutos)
      setDados((d) => (d ? { ...d, evento: { ...d.evento, captura_fim: r.captura_fim, revelacao_em: r.revelacao_em } } : d))
      setAviso({ tipo: 'ok', texto: `Câmera estendida em ${minutos} minutos.` })
    } catch (err) {
      setAviso({ tipo: 'erro', texto: err instanceof ErroApi ? err.message : 'Sem conexão com o servidor.' })
    } finally {
      setEstendendo(false)
    }
  }

  const e = dados?.evento
  const podeEstender = !!e && !e.excluido_em && (e.estado === 'pronto' || e.estado === 'captura_aberta')
  return (
    <>
      <Link to="/admin/eventos" className="mb-4 inline-flex min-h-11 items-center text-sm text-muted underline-offset-4 hover:text-paper hover:underline">
        Voltar para os eventos
      </Link>
      {erro && <Aviso tipo="erro">{erro}</Aviso>}
      {!dados && !erro && <Carregando />}
      {dados && e && (
        <div className="flex flex-col gap-6">
          <Titulo detalhe={`${e.anfitriao_email} · ${ESTADOS_EVENTO[e.estado] ?? e.estado}${e.excluido_em ? ' · apagado' : ''}`}>{e.nome}</Titulo>
          <div className="flex flex-wrap gap-2">
            <Link to={`/admin/eventos/${e.id}/anfitriao`} className="inline-flex min-h-11 items-center rounded-[12px] border border-line px-4 text-sm font-semibold hover:bg-surface">
              Ver como o anfitrião (leitura)
            </Link>
          </div>
          {podeEstender && (
            <Cartao>
              <h2 className="text-sm font-semibold">Estender a câmera</h2>
              <p className="mt-1 text-sm text-muted">Soma tempo ao fim da captura (a revelação é adiada se cair antes). Fica registrado na auditoria.</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {[30, 60, 180, 720].map((m) => (
                  <Button key={m} type="button" variant="outline" disabled={estendendo} onClick={() => void estender(m)}>
                    +{m >= 60 ? `${m / 60} h` : `${m} min`}
                  </Button>
                ))}
              </div>
              {aviso && <div className="mt-3"><Aviso tipo={aviso.tipo}>{aviso.texto}</Aviso></div>}
            </Cartao>
          )}
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
                <Linha rotulo="Fotos por convidado">{e.poses_por_convidado}</Linha>
                <Linha rotulo="Armazenamento">{formatarBytes(dados.fotos.armazenamento_bytes)}</Linha>
                <Linha rotulo="Primeira foto">{dataHora(dados.fotos.primeira_em)}</Linha>
                <Linha rotulo="Última foto">{dataHora(dados.fotos.ultima_em)}</Linha>
              </dl>
            </Cartao>
          </div>

          <Cartao>
            <h2 className="mb-3 text-sm font-semibold">Linha do tempo</h2>
            <ol className="flex flex-col gap-3 border-l border-line pl-4 text-[15px]">
              {[
                ['Evento criado', e.criado_em],
                ...dados.pagamentos.map((p): [string, string | null] => [`Pagamento ${p.status}`, p.criado_em]),
                ['Câmera abre', e.captura_inicio],
                ['Primeira foto', dados.fotos.primeira_em],
                ['Última foto', dados.fotos.ultima_em],
                ['Câmera fecha', e.captura_fim],
                [e.revelado_em ? 'Revelado' : 'Revelação prevista', e.revelado_em ?? e.revelacao_em],
                ['Álbum some', e.expira_em],
                ['Apagado', e.excluido_em],
              ]
                .filter((x): x is [string, string] => !!x[1])
                .sort((a, b) => a[1].localeCompare(b[1]))
                .map(([rotulo, quando]) => (
                  <li key={rotulo + quando} className="flex flex-wrap justify-between gap-x-4">
                    <span>{rotulo}</span>
                    <span className="text-muted">{dataHora(quando)}</span>
                  </li>
                ))}
            </ol>
          </Cartao>

          <EmailAnfitriao eventoId={e.id} para={e.anfitriao_email || null} />

          <Cartao className="overflow-x-auto p-0">
            <h2 className="px-5 pt-5 text-sm font-semibold">Pagamentos</h2>
            {dados.pagamentos.length === 0 ? (
              <EstadoVazio>Nenhum pagamento neste evento.</EstadoVazio>
            ) : (
              <table className="tabela-cards mt-3 w-full sm:min-w-[480px] text-left text-[14px]">
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
              <EstadoVazio>Nenhum pedido neste evento.</EstadoVazio>
            ) : (
              <table className="tabela-cards mt-3 w-full sm:min-w-[560px] text-left text-[14px]">
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
              <table className="tabela-cards mt-3 w-full sm:min-w-[480px] text-left text-[14px]">
                <thead className="border-y border-line text-muted">
                  <tr>
                    <th className="px-5 py-3 font-semibold">Apelido</th>
                    <th className="px-4 py-3 font-semibold">Entrou em</th>
                    <th className="px-5 py-3 text-right font-semibold">Fotos</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line [&_tr:hover]:bg-surface/70">
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
