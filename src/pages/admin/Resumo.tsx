import { useEffect, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ErroApi } from '../../lib/api/tipos.ts'
import { admin, formatarBytes, formatarReais, type Analise, type Crescimento, type PaginaAuditoria, type Resumo as DadosResumo, type SaudeAdmin } from '../../lib/admin.ts'
import { Barras, Colunas, Tendencia } from './Grafico'
import { Variacao } from './Indicador'
import { Aviso, Cartao, Carregando, EstadoVazio, Titulo } from './ui'
import { ACOES_AUDITORIA, dataHora, ESTADOS_EVENTO, linkToque } from './util'

interface Dados {
  resumo: DadosResumo
  analise: Analise
  crescimento: Crescimento
  saude: SaudeAdmin | null
  auditoria: PaginaAuditoria | null
}

function Kpi({ rotulo, valor, rodape, tendencia }: { rotulo: string; valor: string | number; rodape: ReactNode; tendencia: number[] }) {
  return (
    <Cartao className="flex flex-col gap-1">
      <p className="text-sm text-muted">{rotulo}</p>
      <p className="font-display text-[38px] leading-none tabular-nums">{valor}</p>
      <Tendencia valores={tendencia} />
      <p className="text-[13px]">{rodape}</p>
    </Cartao>
  )
}

interface Alerta {
  texto: string
  para: string
}

// Só o que pede ação de alguém; vazio significa tudo em ordem.
function alertas(d: Dados): Alerta[] {
  const l: Alerta[] = []
  const { resumo, saude } = d
  if (resumo.pedidos_de_remocao_pendentes > 0) l.push({ texto: `${resumo.pedidos_de_remocao_pendentes} pedido(s) de remoção de foto pendente(s)`, para: '/admin/moderacao' })
  if (saude) {
    if (!saude.banco.ok) l.push({ texto: 'Banco de dados fora do ar', para: '/admin/saude' })
    if (saude.pagamentos_aprovados_sem_evento > 0) l.push({ texto: `${saude.pagamentos_aprovados_sem_evento} pagamento(s) aprovado(s) sem evento: estornar à mão`, para: '/admin/pagamentos' })
    if (saude.fotos_aguardando_limpeza_ha_mais_de_2_dias > 0) l.push({ texto: `${saude.fotos_aguardando_limpeza_ha_mais_de_2_dias} foto(s) na fila de limpeza há mais de 2 dias`, para: '/admin/saude' })
    if (saude.pedidos_de_remocao_pendentes_ha_mais_de_2_dias > 0) l.push({ texto: `${saude.pedidos_de_remocao_pendentes_ha_mais_de_2_dias} pedido(s) de remoção parado(s) há mais de 2 dias`, para: '/admin/moderacao' })
  }
  return l
}

export function Resumo() {
  const [dados, setDados] = useState<Dados | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    let ativo = true
    // Resumo, análise e crescimento são o essencial; saúde e auditoria enfeitam e não derrubam a tela.
    Promise.all([admin.resumo(), admin.analise(30), admin.crescimento(30), admin.saude().catch(() => null), admin.auditoria(1, 6).catch(() => null)])
      .then(([resumo, analise, crescimento, saude, auditoria]) => ativo && setDados({ resumo, analise, crescimento, saude, auditoria }))
      .catch((e: unknown) => ativo && setErro(e instanceof ErroApi ? e.message : 'Sem conexão com o servidor.'))
    return () => {
      ativo = false
    }
  }, [])

  const lista = dados ? alertas(dados) : []
  const totalEventos = dados ? Object.values(dados.resumo.eventos_por_estado).reduce((a, b) => a + b, 0) : 0

  return (
    <>
      <Titulo detalhe="Como o Mango está agora, comparado aos 30 dias anteriores. Preços, planos e limites ficam nas telas Pacotes e Configurações e valem na hora, sem deploy.">Resumo</Titulo>
      {erro && <Aviso tipo="erro">{erro}</Aviso>}
      {!dados && !erro && <Carregando />}
      {dados && (
        <div className="flex flex-col gap-6">
          <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
            <Kpi rotulo="Receita (30 dias)" valor={formatarReais(dados.analise.periodo.receita_centavos.atual)} tendencia={dados.crescimento.serie.map((s) => s.receita_centavos)} rodape={<Variacao dupla={dados.analise.periodo.receita_centavos} />} />
            <Kpi rotulo="Eventos criados (30 dias)" valor={dados.analise.periodo.eventos.atual} tendencia={dados.crescimento.serie.map((s) => s.eventos)} rodape={<Variacao dupla={dados.analise.periodo.eventos} />} />
            <Kpi rotulo="Fotos (30 dias)" valor={dados.analise.periodo.fotos.atual} tendencia={dados.crescimento.serie.map((s) => s.fotos)} rodape={<Variacao dupla={dados.analise.periodo.fotos} />} />
            <Kpi rotulo="Convidados (30 dias)" valor={dados.analise.periodo.convidados.atual} tendencia={dados.crescimento.serie.map((s) => s.convidados)} rodape={<Variacao dupla={dados.analise.periodo.convidados} />} />
          </div>

          <div className="grid gap-4 xl:grid-cols-3">
            <Cartao className="xl:col-span-2">
              <div className="mb-3 flex items-baseline justify-between gap-3">
                <h2 className="text-sm font-semibold">Receita por dia</h2>
                <Link to="/admin/crescimento" className={`text-sm text-muted ${linkToque}`}>
                  Ver crescimento
                </Link>
              </div>
              <Colunas itens={dados.crescimento.serie.map((s) => ({ rotulo: new Date(s.dia).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }), valor: s.receita_centavos }))} formatar={formatarReais} />
            </Cartao>
            <Cartao>
              <h2 className="mb-3 text-sm font-semibold">Precisa de atenção</h2>
              {lista.length === 0 ? (
                <p className="text-[15px] text-muted">Tudo em ordem: nenhum pedido parado nem sinal fora do esperado.</p>
              ) : (
                <ul className="flex flex-col gap-2 text-[15px]">
                  {lista.map((a) => (
                    <li key={a.texto}>
                      <Link to={a.para} className="block rounded-[12px] border border-danger/60 bg-danger/10 px-3 py-2 text-danger-ink hover:bg-danger/20">
                        {a.texto}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
              <p className="mt-4 text-[13px] text-muted">
                <Link to="/admin/configuracoes" className="underline underline-offset-4 hover:text-paper">
                  Pausar a criação de eventos
                </Link>{' '}
                em caso de manutenção.
              </p>
            </Cartao>
          </div>

          <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
            <Cartao>
              <h2 className="mb-3 text-sm font-semibold">Eventos por estado ({totalEventos})</h2>
              {totalEventos === 0 ? <EstadoVazio>Nenhum evento ainda.</EstadoVazio> : <Barras itens={Object.entries(dados.resumo.eventos_por_estado).map(([e, n]) => ({ rotulo: ESTADOS_EVENTO[e] ?? e, valor: n }))} />}
            </Cartao>
            <Cartao>
              <h2 className="mb-3 text-sm font-semibold">Agora</h2>
              <dl className="divide-y divide-line text-[15px]">
                <Linha rotulo="Eventos com a câmera aberta">{dados.analise.medias.eventos_capturando_agora}</Linha>
                <Linha rotulo="Fotos nas últimas 24 horas">{dados.resumo.fotos_ultimas_24_horas}</Linha>
                <Linha rotulo="Eventos nos últimos 7 dias">{dados.resumo.eventos_ultimos_7_dias}</Linha>
                <Linha rotulo="Total de convidados">{dados.resumo.convidados}</Linha>
                <Linha rotulo="Total de fotos">{dados.resumo.fotos}</Linha>
                <Linha rotulo="Armazenamento">{formatarBytes(dados.resumo.armazenamento_bytes)}</Linha>
              </dl>
            </Cartao>
            <Cartao>
              <div className="mb-3 flex items-baseline justify-between gap-3">
                <h2 className="text-sm font-semibold">Atividade recente</h2>
                <Link to="/admin/auditoria" className={`text-sm text-muted ${linkToque}`}>
                  Ver tudo
                </Link>
              </div>
              {!dados.auditoria || dados.auditoria.registros.length === 0 ? (
                <EstadoVazio>Nenhuma alteração registrada.</EstadoVazio>
              ) : (
                <ul className="divide-y divide-line text-[14px]">
                  {dados.auditoria.registros.map((r) => (
                    <li key={r.id} className="py-2">
                      <p>
                        <strong className="font-semibold">{r.usuario}</strong> <span className="text-muted">{ACOES_AUDITORIA[r.acao] ?? r.acao}</span>
                      </p>
                      <p className="text-[12px] text-muted">{dataHora(r.criado_em)}</p>
                    </li>
                  ))}
                </ul>
              )}
            </Cartao>
          </div>
        </div>
      )}
    </>
  )
}

function Linha({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-2">
      <dt className="text-muted">{rotulo}</dt>
      <dd className="tabular-nums">{children}</dd>
    </div>
  )
}
