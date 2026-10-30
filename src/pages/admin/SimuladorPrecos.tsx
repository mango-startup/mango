import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { admin, centavosParaCampo, formatarReais, reaisParaCentavos, type PacoteAdmin } from '../../lib/admin.ts'
import { ONCE_USD, PARAMS_PADRAO, calcularPreco, type ParamsPreco } from '../../lib/simuladorPreco.ts'
import { Aviso, Campo, Cartao, Titulo } from './ui'

// Os campos guardam o texto digitado; só viram número ao calcular.
interface Formulario {
  gratis: string
  fotosTeste: string
  fotosLimitadas: string
  ate1: string
  preco1: string
  ate2: string
  preco2: string
  preco3: string
  ilimitadas: string
  participantes: string
  cotacao: string
}

const CHAVE = 'mango-simulador-precos'

const doPadrao = (): Formulario => {
  const [d1, d2, d3] = PARAMS_PADRAO.degraus
  return {
    gratis: String(PARAMS_PADRAO.gratis),
    fotosTeste: String(PARAMS_PADRAO.fotosTeste),
    fotosLimitadas: String(PARAMS_PADRAO.fotosLimitadas),
    ate1: String(d1.ate),
    preco1: centavosParaCampo(d1.centavos),
    ate2: String(d2.ate),
    preco2: centavosParaCampo(d2.centavos),
    preco3: centavosParaCampo(d3.centavos),
    ilimitadas: centavosParaCampo(PARAMS_PADRAO.ilimitadasCentavos),
    participantes: '30',
    cotacao: '5,50',
  }
}

function lerGuardado(): Formulario {
  try {
    const bruto = localStorage.getItem(CHAVE)
    if (bruto) return { ...doPadrao(), ...(JSON.parse(bruto) as Partial<Formulario>) }
  } catch {
    // sem armazenamento: vale o padrão
  }
  return doPadrao()
}

const inteiro = (t: string): number | null => (/^\d+$/.test(t.trim()) ? Number(t.trim()) : null)

function ler(f: Formulario): { params: ParamsPreco | null; participantes: number | null; cotacao: number | null; erro: string | null } {
  const gratis = inteiro(f.gratis)
  const fotosTeste = inteiro(f.fotosTeste)
  const fotosLimitadas = inteiro(f.fotosLimitadas)
  const ate1 = inteiro(f.ate1)
  const ate2 = inteiro(f.ate2)
  const p1 = reaisParaCentavos(f.preco1)
  const p2 = reaisParaCentavos(f.preco2)
  const p3 = reaisParaCentavos(f.preco3)
  const ilim = reaisParaCentavos(f.ilimitadas)
  const participantes = inteiro(f.participantes)
  const cotacao = reaisParaCentavos(f.cotacao)
  const nulos = [gratis, fotosTeste, fotosLimitadas, ate1, ate2, p1, p2, p3, ilim].some((v) => v === null)
  const base = { participantes, cotacao: cotacao === null ? null : cotacao / 100 }
  if (nulos) return { ...base, params: null, erro: 'Há campo com valor inválido: use números inteiros e valores em reais, como 1,50.' }
  if (ate1! <= gratis! || ate2! <= ate1!) return { ...base, params: null, erro: 'Os degraus precisam crescer: grátis < fim do 1º degrau < fim do 2º degrau.' }
  return {
    ...base,
    erro: null,
    params: {
      gratis: gratis!,
      fotosTeste: fotosTeste!,
      fotosLimitadas: fotosLimitadas!,
      degraus: [
        { ate: ate1, centavos: p1! },
        { ate: ate2, centavos: p2! },
        { ate: null, centavos: p3! },
      ],
      ilimitadasCentavos: ilim!,
    },
  }
}

const reais = formatarReais

export function SimuladorPrecos() {
  const [f, setF] = useState<Formulario>(lerGuardado)
  const [reais_, setReais] = useState<PacoteAdmin[] | null>(null)
  const [erroPacotes, setErroPacotes] = useState(false)
  const mudar = (p: Partial<Formulario>) =>
    setF((atual) => {
      const novo = { ...atual, ...p }
      try {
        localStorage.setItem(CHAVE, JSON.stringify(novo))
      } catch {
        // sem armazenamento: só não guarda
      }
      return novo
    })

  const { params, participantes, cotacao, erro } = useMemo(() => ler(f), [f])
  const resultado = params && participantes !== null ? calcularPreco(participantes, params) : null

  const carregarReais = () => {
    setErroPacotes(false)
    admin.pacotes().then(setReais, () => setErroPacotes(true))
  }

  const tamanhos = useMemo(() => {
    const lista = new Set<number>([5, 10, 25, 50, 100, 150, 200])
    if (participantes) lista.add(participantes)
    return [...lista].sort((a, b) => a - b)
  }, [participantes])

  const campo = (rotulo: string, chave: keyof Formulario, ajuda?: string, modo: 'numeric' | 'decimal' = 'numeric') => (
    <Campo rotulo={rotulo} ajuda={ajuda}>
      {(id) => <Input id={id} inputMode={modo} value={f[chave]} onChange={(e) => mudar({ [chave]: e.target.value })} />}
    </Campo>
  )

  return (
    <div className="mx-auto max-w-[1040px]">
      <Titulo detalhe="Simula a cobrança por participante (#169) e compara com os pacotes de hoje e com a Once. Os números ficam só neste navegador: aplicar no real ainda depende do backend aceitar esse modelo.">
        Simulador de preços
      </Titulo>

      <div className="grid gap-5 lg:grid-cols-[1fr_1fr]">
        <Cartao>
          <h2 className="font-display text-[24px] leading-none">Parâmetros</h2>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            {campo('Participantes grátis', 'gratis', 'O teste: todo evento até aqui não paga.')}
            {campo('Fotos por pessoa no teste', 'fotosTeste')}
            {campo('Fotos por pessoa (limitado)', 'fotosLimitadas', 'O padrão nos pacotes pagos.')}
            {campo('Extra de fotos ilimitadas (R$ por participante)', 'ilimitadas', undefined, 'decimal')}
          </div>
          <h3 className="mt-6 text-[15px] font-semibold">Preço por participante (R$)</h3>
          <div className="mt-3 grid gap-4 sm:grid-cols-3">
            {campo('Até o participante nº', 'ate1')}
            {campo('Preço', 'preco1', undefined, 'decimal')}
            <span className="hidden sm:block" />
            {campo('Até o participante nº', 'ate2')}
            {campo('Preço', 'preco2', undefined, 'decimal')}
            <span className="hidden sm:block" />
            <p className="flex min-h-11 items-center text-[15px] text-muted sm:pt-6">Acima disso</p>
            {campo('Preço', 'preco3', undefined, 'decimal')}
          </div>
          <div className="mt-6">
            <Button type="button" variant="outline" onClick={() => setF(doPadrao())}>
              Voltar aos valores propostos
            </Button>
          </div>
        </Cartao>

        <Cartao>
          <h2 className="font-display text-[24px] leading-none">Quanto fica</h2>
          <div className="mt-5">{campo('Número de participantes', 'participantes', 'Qualquer número, sem faixa.')}</div>
          {erro && <div className="mt-4"><Aviso tipo="erro">{erro}</Aviso></div>}
          {resultado && participantes !== null && (
            <dl className="mt-5 grid gap-3 sm:grid-cols-2">
              <div className="rounded-[14px] border border-line p-4">
                <dt className="text-sm text-muted">Fotos limitadas ({params!.fotosLimitadas} por pessoa)</dt>
                <dd className="mt-1 font-display text-[34px] leading-none tabular-nums">{resultado.limitado === 0 ? 'Grátis' : reais(resultado.limitado)}</dd>
                <dd className="mt-2 text-sm text-muted tabular-nums">{participantes > 0 && resultado.limitado > 0 ? `${reais(Math.round(resultado.limitado / participantes))} por participante` : `${resultado.pagos} participantes pagos`}</dd>
              </div>
              <div className="rounded-[14px] border border-line p-4">
                <dt className="text-sm text-muted">Fotos ilimitadas</dt>
                <dd className="mt-1 font-display text-[34px] leading-none tabular-nums">{resultado.ilimitado === 0 ? 'Grátis' : reais(resultado.ilimitado)}</dd>
                <dd className="mt-2 text-sm text-muted tabular-nums">{resultado.pagos > 0 ? `+${reais(resultado.ilimitado - resultado.limitado)} pelo extra` : 'Dentro do teste'}</dd>
              </div>
            </dl>
          )}
        </Cartao>
      </div>

      <Cartao className="mt-5">
        <h2 className="font-display text-[24px] leading-none">Tabela por tamanho</h2>
        <div className="mt-4 w-full max-w-[220px]">{campo('Cotação do dólar (R$)', 'cotacao', undefined, 'decimal')}</div>
        {params && (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[520px] text-left text-[15px] tabular-nums">
              <thead className="text-sm text-muted">
                <tr className="border-b border-line">
                  <th className="py-2 pr-3 font-medium">Participantes</th>
                  <th className="py-2 pr-3 font-medium">Mango limitado</th>
                  <th className="py-2 pr-3 font-medium">Mango ilimitado</th>
                  <th className="py-2 font-medium">Once (aprox.)</th>
                </tr>
              </thead>
              <tbody>
                {tamanhos.map((n) => {
                  const r = calcularPreco(n, params)
                  const once = ONCE_USD.find((o) => o.convidados === n)
                  return (
                    <tr key={n} className={`border-b border-line/60 ${n === participantes ? 'bg-surface' : ''}`}>
                      <td className="py-2.5 pr-3">{n}</td>
                      <td className="py-2.5 pr-3">{r.limitado === 0 ? 'Grátis' : reais(r.limitado)}</td>
                      <td className="py-2.5 pr-3">{r.ilimitado === 0 ? 'Grátis' : reais(r.ilimitado)}</td>
                      <td className="py-2.5">{once ? (once.centavos === 0 ? 'Grátis' : cotacao ? reais(Math.round(once.centavos * cotacao)) : '—') : '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-3 text-sm text-muted">Once: tabela de once.film/pricing consultada em 29/10/2026, em dólares, convertida pela cotação acima. Eles cobram à parte US$ 9,99 pelo extra de fotos ilimitadas.</p>
      </Cartao>

      <Cartao className="mt-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-[24px] leading-none">Contra os pacotes de hoje</h2>
          <Button type="button" variant="outline" onClick={carregarReais}>
            {reais_ ? 'Atualizar pacotes reais' : 'Carregar pacotes reais'}
          </Button>
        </div>
        {erroPacotes && <div className="mt-4"><Aviso tipo="erro">Não consegui carregar os pacotes. Tente de novo.</Aviso></div>}
        {!reais_ && !erroPacotes && <p className="mt-3 text-[15px] text-muted">Traz os pacotes cadastrados em Pacotes e mostra quanto cada um custaria no novo modelo, com o mesmo número de convidados.</p>}
        {reais_ && params && (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-[15px] tabular-nums">
              <thead className="text-sm text-muted">
                <tr className="border-b border-line">
                  <th className="py-2 pr-3 font-medium">Pacote</th>
                  <th className="py-2 pr-3 font-medium">Convidados</th>
                  <th className="py-2 pr-3 font-medium">Preço hoje</th>
                  <th className="py-2 pr-3 font-medium">No novo modelo</th>
                  <th className="py-2 font-medium">Diferença</th>
                </tr>
              </thead>
              <tbody>
                {reais_.map((p) => {
                  const novo = calcularPreco(p.convidados, params).limitado
                  const dif = novo - p.preco_centavos
                  return (
                    <tr key={p.id} className="border-b border-line/60">
                      <td className="py-2.5 pr-3">{p.nome}{!p.ativo && <span className="text-muted"> (inativo)</span>}</td>
                      <td className="py-2.5 pr-3">{p.convidados}</td>
                      <td className="py-2.5 pr-3">{p.gratis ? 'Grátis' : reais(p.preco_centavos)}</td>
                      <td className="py-2.5 pr-3">{novo === 0 ? 'Grátis' : reais(novo)}</td>
                      <td className="py-2.5">{dif === 0 ? '—' : `${dif > 0 ? '+' : '−'}${reais(Math.abs(dif))}`}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Cartao>
    </div>
  )
}
