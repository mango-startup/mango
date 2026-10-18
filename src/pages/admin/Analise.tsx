import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ErroApi } from '../../lib/api/tipos.ts'
import { admin, formatarBytes, formatarReais, type Analise as Dados } from '../../lib/admin.ts'
import { Indicador } from './Indicador'
import { Aviso, Cartao, Titulo, Carregando, EstadoVazio } from './ui'
import { campoTexto, decimal, porcento } from './util'

const ETAPAS = [
  { chave: 'criados', rotulo: 'Criaram o evento' },
  { chave: 'ativados', rotulo: 'Evento liberado (grátis ou pago)' },
  { chave: 'com_fotos', rotulo: 'Receberam fotos' },
  { chave: 'revelados', rotulo: 'Reveladas' },
] as const

export function Analise() {
  const [dias, setDias] = useState(30)
  const [dados, setDados] = useState<Dados | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    let ativo = true
    admin
      .analise(dias)
      .then((r) => ativo && (setDados(r), setErro(null)))
      .catch((e: unknown) => ativo && setErro(e instanceof ErroApi ? e.message : 'Sem conexão com o servidor.'))
    return () => {
      ativo = false
    }
  }, [dias])

  return (
    <>
      <Titulo detalhe="O período escolhido contra o período anterior de mesmo tamanho, o caminho dos eventos até a revelação e o que cada pacote entrega.">Análise</Titulo>
      <select aria-label="Período" value={dias} onChange={(e) => setDias(Number(e.target.value))} className={`${campoTexto} mb-6 sm:max-w-[240px]`}>
        <option value={7}>Últimos 7 dias</option>
        <option value={30}>Últimos 30 dias</option>
        <option value={90}>Últimos 90 dias</option>
        <option value={365}>Último ano</option>
      </select>
      {erro && <Aviso tipo="erro">{erro}</Aviso>}
      {!dados && !erro && <Carregando />}
      {dados && (
        <div className="flex flex-col gap-8">
          <section aria-label="Período" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Indicador rotulo="Receita" valor={formatarReais(dados.periodo.receita_centavos.atual)} dupla={dados.periodo.receita_centavos} />
            <Indicador rotulo="Pagamentos aprovados" valor={dados.periodo.pagamentos_aprovados.atual} dupla={dados.periodo.pagamentos_aprovados} />
            <Indicador rotulo="Ticket médio" valor={formatarReais(dados.periodo.ticket_medio_centavos.atual)} dupla={dados.periodo.ticket_medio_centavos} />
            <Indicador rotulo="Eventos criados" valor={dados.periodo.eventos.atual} dupla={dados.periodo.eventos} />
            <Indicador rotulo="Convidados" valor={dados.periodo.convidados.atual} dupla={dados.periodo.convidados} />
            <Indicador rotulo="Fotos" valor={dados.periodo.fotos.atual} dupla={dados.periodo.fotos} />
          </section>

          <div className="grid gap-4 lg:grid-cols-2">
            <Cartao>
              <h2 className="text-sm font-semibold">Do evento criado até a revelação</h2>
              <p className="mt-1 text-[13px] text-muted">Só eventos criados nos últimos {dados.dias} dias.</p>
              <ul className="mt-4 flex flex-col gap-3">
                {ETAPAS.map((e) => {
                  const n = dados.funil[e.chave]
                  const base = Math.max(1, dados.funil.criados)
                  return (
                    <li key={e.chave}>
                      <div className="flex justify-between text-[15px]">
                        <span>{e.rotulo}</span>
                        <span className="tabular-nums text-muted">
                          {n} <span className="text-[13px]">({porcento(dados.funil.criados ? n / base : null)})</span>
                        </span>
                      </div>
                      <div className="mt-1.5 h-2 rounded-full bg-base">
                        <div className="h-full rounded-full bg-paper" style={{ width: `${(n / base) * 100}%` }} />
                      </div>
                    </li>
                  )
                })}
              </ul>
              <p className="mt-4 border-t border-line pt-3 text-[14px] text-muted">
                Conversão de pacotes pagos: <strong className="tabular-nums text-paper">{porcento(dados.funil.conversao_paga)}</strong> ({dados.funil.pagos_ativados} de {dados.funil.pagos_criados} pagaram)
              </p>
            </Cartao>

            <Cartao>
              <h2 className="mb-3 text-sm font-semibold">Como as pessoas usam</h2>
              <dl className="divide-y divide-line text-[15px]">
                {[
                  ['Fotos por evento', decimal(dados.medias.fotos_por_evento)],
                  ['Convidados por evento', decimal(dados.medias.convidados_por_evento)],
                  ['Fotos por convidado', decimal(dados.medias.fotos_por_convidado)],
                  ['Vagas preenchidas', porcento(dados.medias.ocupacao_das_vagas)],
                  ['Câmeras abertas agora', String(dados.medias.eventos_capturando_agora)],
                ].map(([r, v]) => (
                  <div key={r} className="flex justify-between py-2.5">
                    <dt className="text-muted">{r}</dt>
                    <dd className="tabular-nums">{v}</dd>
                  </div>
                ))}
              </dl>
            </Cartao>
          </div>

          <Cartao className="overflow-x-auto p-0">
            <h2 className="px-5 pt-5 text-sm font-semibold">Desempenho por pacote</h2>
            <table className="tabela-cards mt-3 w-full sm:min-w-[720px] text-left text-[14px]">
              <thead className="border-y border-line text-muted">
                <tr>
                  <th className="px-5 py-3 font-semibold">Pacote</th>
                  <th className="px-4 py-3 text-right font-semibold">Preço</th>
                  <th className="px-4 py-3 text-right font-semibold">Eventos no período</th>
                  <th className="px-4 py-3 text-right font-semibold">Receita no período</th>
                  <th className="px-4 py-3 text-right font-semibold">Fotos</th>
                  <th className="px-5 py-3 text-right font-semibold">Armazenamento</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line [&_tr:hover]:bg-surface/70">
                {dados.pacotes.map((p) => (
                  <tr key={p.id}>
                    <td className="px-5 py-3">{p.nome}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-muted">{p.preco_centavos === 0 ? 'Grátis' : formatarReais(p.preco_centavos)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{p.eventos_no_periodo}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{formatarReais(p.receita_no_periodo_centavos)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{p.fotos}</td>
                    <td className="px-5 py-3 text-right tabular-nums">{formatarBytes(p.armazenamento_bytes)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Cartao>

          <Cartao className="overflow-x-auto p-0">
            <h2 className="px-5 pt-5 text-sm font-semibold">Maiores eventos em armazenamento</h2>
            {dados.maiores_eventos.length === 0 ? (
              <EstadoVazio>Nenhum evento ainda.</EstadoVazio>
            ) : (
              <table className="tabela-cards mt-3 w-full sm:min-w-[720px] text-left text-[14px]">
                <thead className="border-y border-line text-muted">
                  <tr>
                    <th className="px-5 py-3 font-semibold">Evento</th>
                    <th className="px-4 py-3 font-semibold">Anfitrião</th>
                    <th className="px-4 py-3 text-right font-semibold">Convidados</th>
                    <th className="px-4 py-3 text-right font-semibold">Fotos</th>
                    <th className="px-5 py-3 text-right font-semibold">Armazenamento</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line [&_tr:hover]:bg-surface/70">
                  {dados.maiores_eventos.map((e) => (
                    <tr key={e.id}>
                      <td className="px-5 py-3">
                        <Link to={`/admin/eventos/${e.id}`} className="underline underline-offset-4 hover:text-muted">
                          {e.nome}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-muted">{e.anfitriao_email}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{e.convidados}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{e.fotos}</td>
                      <td className="px-5 py-3 text-right tabular-nums">{formatarBytes(e.armazenamento_bytes)}</td>
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
