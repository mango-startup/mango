import { useEffect, useState } from 'react'
import { ErroApi } from '../../lib/api/tipos.ts'
import { admin, formatarReais, type Financeiro as Dados } from '../../lib/admin.ts'
import { Barras } from './Grafico'
import { Indicador } from './Indicador'
import { Aviso, Cartao, Carregando, EstadoVazio, Titulo } from './ui'
import { campoTexto, porcento } from './util'

const PERIODOS = [
  [7, 'Últimos 7 dias'],
  [30, 'Últimos 30 dias'],
  [90, 'Últimos 90 dias'],
  [365, 'Último ano'],
] as const

export function Financeiro() {
  const [dias, setDias] = useState(30)
  const [dados, setDados] = useState<Dados | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    let ativo = true
    admin
      .financeiro(dias)
      .then((r) => ativo && (setDados(r), setErro(null)))
      .catch((e: unknown) => ativo && setErro(e instanceof ErroApi ? e.message : 'Sem conexão com o servidor.'))
    return () => {
      ativo = false
    }
  }, [dias])

  const meta = dados?.mes.meta_centavos ?? null
  const progresso = dados && meta ? Math.min(100, (dados.mes.bruta_centavos / meta) * 100) : 0

  return (
    <>
      <Titulo detalhe="Quanto entrou, quanto sobra depois da taxa do Stripe e onde as pessoas desistem. A receita líquida é uma estimativa pela taxa configurada em Configurações, seção Financeiro.">Financeiro</Titulo>
      <div className="mb-4">
        <select aria-label="Período" value={dias} onChange={(e) => setDias(Number(e.target.value))} className={`${campoTexto} sm:max-w-[240px]`}>
          {PERIODOS.map(([n, rotulo]) => (
            <option key={n} value={n}>
              {rotulo}
            </option>
          ))}
        </select>
      </div>
      {erro && <Aviso tipo="erro">{erro}</Aviso>}
      {!dados && !erro && <Carregando />}
      {dados && (
        <div className="flex flex-col gap-6">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Indicador rotulo="Receita bruta" valor={formatarReais(dados.atual.bruta_centavos)} dupla={{ atual: dados.atual.bruta_centavos, anterior: dados.anterior.bruta_centavos }} />
            <Indicador rotulo="Receita líquida (estimada)" valor={formatarReais(dados.atual.liquida_centavos)} dupla={{ atual: dados.atual.liquida_centavos, anterior: dados.anterior.liquida_centavos }} />
            <Indicador rotulo="Taxas do Stripe (estimadas)" valor={formatarReais(dados.atual.taxas_centavos)} detalhe={`${String(dados.taxa.percentual).replace('.', ',')}% + ${formatarReais(dados.taxa.fixa_centavos)} por pagamento`} />
            <Indicador rotulo="Ticket médio" valor={formatarReais(dados.atual.ticket_medio_centavos)} dupla={{ atual: dados.atual.ticket_medio_centavos, anterior: dados.anterior.ticket_medio_centavos }} />
          </div>

          {meta ? (
            <Cartao>
              <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-sm font-semibold">Meta do mês</h2>
                <span className="text-sm tabular-nums text-muted">
                  {formatarReais(dados.mes.bruta_centavos)} de {formatarReais(meta)} ({porcento(dados.mes.bruta_centavos / meta)})
                </span>
              </div>
              <div className="h-2 rounded-full bg-line" role="progressbar" aria-valuenow={Math.round(progresso)} aria-valuemin={0} aria-valuemax={100} aria-label="Progresso da meta do mês">
                <div className="h-full rounded-full bg-paper/80" style={{ width: `${progresso}%` }} />
              </div>
            </Cartao>
          ) : (
            <p className="text-sm text-muted">Defina a meta do mês em Configurações, seção Financeiro para acompanhar o progresso aqui.</p>
          )}

          <div className="grid gap-4 xl:grid-cols-2">
            {dados.pacotes.map((p) => (
              <Cartao key={p.id}>
                <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
                  <h2 className="text-[18px] font-semibold">{p.nome}</h2>
                  <span className="text-sm text-muted">{p.preco_centavos > 0 ? formatarReais(p.preco_centavos) : 'grátis'}</span>
                </div>
                {p.eventos === 0 && p.checkouts === 0 ? (
                  <EstadoVazio>Nenhum evento neste pacote no período.</EstadoVazio>
                ) : (
                  <>
                    <Barras
                      itens={[
                        { rotulo: 'Eventos criados', valor: p.eventos },
                        ...(p.preco_centavos > 0 ? [{ rotulo: 'Iniciaram o pagamento', valor: p.checkouts }, { rotulo: 'Pagaram', valor: p.pagos }] : []),
                        { rotulo: 'Receberam fotos', valor: p.com_fotos },
                        { rotulo: 'Reveladas', valor: p.revelados },
                      ]}
                    />
                    {p.preco_centavos > 0 && (
                      <dl className="mt-4 divide-y divide-line border-t border-line text-[14px]">
                        <Linha rotulo="Abandonaram o pagamento">{p.abandonados}</Linha>
                        <Linha rotulo="Conversão do pagamento">{porcento(p.conversao)}</Linha>
                        <Linha rotulo="Receita bruta">{formatarReais(p.bruta_centavos)}</Linha>
                        <Linha rotulo="Receita líquida (estimada)">{formatarReais(p.liquida_centavos)}</Linha>
                      </dl>
                    )}
                  </>
                )}
              </Cartao>
            ))}
          </div>
        </div>
      )}
    </>
  )
}

function Linha({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-2">
      <dt className="text-muted">{rotulo}</dt>
      <dd className="tabular-nums">{children}</dd>
    </div>
  )
}
