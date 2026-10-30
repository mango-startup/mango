import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Confirmacao } from '../../components/Confirmacao'
import { ErroApi } from '../../lib/api/tipos.ts'
import { admin, centavosParaCampo, formatarReais, reaisParaCentavos, type PrecoPublicado } from '../../lib/admin.ts'
import { ONCE_USD, OPCOES_FOTOS, PARAMS_PADRAO, calcularPreco, participantesPagos, type ParamsPreco } from '../../lib/simuladorPreco.ts'
import { Aviso, Campo, Cartao, Interruptor, Titulo } from './ui'
import { dataHora } from './util'

// Os campos guardam o texto digitado; só viram número ao calcular.
interface Formulario {
  gratis: string
  cobrarTodos: boolean
  fotosTeste: string
  fotosSugeridas: string
  fotosBase: string
  fotoExtra: string
  ilimitado: string
  teto: string
  ate1: string
  preco1: string
  ate2: string
  preco2: string
  preco3: string
  piso: string
  arredondar90: boolean
  participantes: string
  cotacao: string
}

const CHAVE = 'mango-simulador-precos-v2'
const ATALHOS = [6, 20, 50, 100, 200]

const doParams = (p: ParamsPreco): Omit<Formulario, 'participantes' | 'cotacao'> => ({
  gratis: String(p.gratis),
  cobrarTodos: p.cobrarTodos,
  fotosTeste: String(p.fotosTeste),
  fotosSugeridas: String(p.fotosLimitadas),
  fotosBase: String(p.fotosBase),
  fotoExtra: centavosParaCampo(p.fotoExtraCentavos),
  ilimitado: centavosParaCampo(p.ilimitadoCentavos),
  teto: String(p.tetoIlimitado),
  ate1: String(p.degraus[0]?.ate ?? ''),
  preco1: centavosParaCampo(p.degraus[0]?.centavos ?? 0),
  ate2: String(p.degraus[1]?.ate ?? ''),
  preco2: centavosParaCampo(p.degraus[1]?.centavos ?? 0),
  preco3: centavosParaCampo(p.degraus[2]?.centavos ?? 0),
  piso: centavosParaCampo(p.pisoCentavos),
  arredondar90: p.arredondar90,
})

const padrao = (): Formulario => ({ ...doParams(PARAMS_PADRAO), participantes: '30', cotacao: '5,50' })

function lerGuardado(): Formulario {
  try {
    const bruto = localStorage.getItem(CHAVE)
    if (bruto) return { ...padrao(), ...(JSON.parse(bruto) as Partial<Formulario>) }
  } catch {
    // sem armazenamento: vale o padrão
  }
  return padrao()
}

const inteiro = (t: string): number | null => (/^\d+$/.test(t.trim()) ? Number(t.trim()) : null)

function ler(f: Formulario): { params: ParamsPreco | null; participantes: number | null; cotacao: number | null; erro: string | null } {
  const n = {
    gratis: inteiro(f.gratis),
    fotosTeste: inteiro(f.fotosTeste),
    fotosSugeridas: inteiro(f.fotosSugeridas),
    fotosBase: inteiro(f.fotosBase),
    teto: inteiro(f.teto),
    ate1: inteiro(f.ate1),
    ate2: inteiro(f.ate2),
    fotoExtra: reaisParaCentavos(f.fotoExtra),
    ilimitado: reaisParaCentavos(f.ilimitado),
    preco1: reaisParaCentavos(f.preco1),
    preco2: reaisParaCentavos(f.preco2),
    preco3: reaisParaCentavos(f.preco3),
    piso: reaisParaCentavos(f.piso),
  }
  const cotacao = reaisParaCentavos(f.cotacao)
  const base = { participantes: inteiro(f.participantes), cotacao: cotacao === null ? null : cotacao / 100 }
  if (Object.values(n).some((v) => v === null)) return { ...base, params: null, erro: 'Há campo com valor inválido: use números inteiros e valores em reais, como 1,50.' }
  const v = n as { [K in keyof typeof n]: number }
  if (v.ate1 <= (f.cobrarTodos ? 0 : v.gratis) || v.ate2 <= v.ate1) return { ...base, params: null, erro: 'Os degraus precisam crescer: o fim do 1º tem de passar do grátis e ser menor que o fim do 2º.' }
  return {
    ...base,
    erro: null,
    params: {
      gratis: v.gratis,
      cobrarTodos: f.cobrarTodos,
      fotosTeste: v.fotosTeste,
      fotosLimitadas: v.fotosSugeridas,
      fotosBase: v.fotosBase,
      fotoExtraCentavos: v.fotoExtra,
      degraus: [
        { ate: v.ate1, centavos: v.preco1 },
        { ate: v.ate2, centavos: v.preco2 },
        { ate: null, centavos: v.preco3 },
      ],
      ilimitadoCentavos: v.ilimitado,
      tetoIlimitado: v.teto,
      pisoCentavos: v.piso,
      arredondar90: f.arredondar90,
    },
  }
}

/** Cada regra como texto, para mostrar o que muda antes de publicar. */
function regras(p: ParamsPreco): [string, string][] {
  const [d1, d2, d3] = p.degraus
  const sim = (b: boolean) => (b ? 'sim' : 'não')
  return [
    ['Participantes grátis', String(p.gratis)],
    ['Passou do grátis, todos pagam', sim(p.cobrarTodos)],
    ['Fotos por pessoa no teste', String(p.fotosTeste)],
    ['Fotos sugeridas na criação', String(p.fotosLimitadas)],
    ['Fotos incluídas nos degraus', String(p.fotosBase)],
    ['Cada foto acima disso', formatarReais(p.fotoExtraCentavos)],
    ['Fotos ilimitadas', formatarReais(p.ilimitadoCentavos)],
    ['Teto de fotos no ilimitado', String(p.tetoIlimitado)],
    ['1º degrau', `até o nº ${d1?.ate}, ${formatarReais(d1?.centavos ?? 0)}`],
    ['2º degrau', `até o nº ${d2?.ate}, ${formatarReais(d2?.centavos ?? 0)}`],
    ['Acima disso', formatarReais(d3?.centavos ?? 0)],
    ['Valor mínimo', formatarReais(p.pisoCentavos)],
    ['Arredondar para ,90', sim(p.arredondar90)],
  ]
}

const mudancas = (antes: ParamsPreco, depois: ParamsPreco): string[] => {
  const a = regras(antes)
  return regras(depois).flatMap(([rotulo, valor], i) => (a[i][1] === valor ? [] : [`${rotulo}: ${a[i][1]} → ${valor}`]))
}

const dinheiro = (c: number) => (c === 0 ? 'Grátis' : formatarReais(c))

function Grupo({ titulo, ajuda, children }: { titulo: string; ajuda?: string; children: ReactNode }) {
  return (
    <fieldset className="border-t border-line pt-5 first:border-t-0 first:pt-0">
      <legend className="float-left mb-3 w-full text-[17px] font-semibold">{titulo}</legend>
      {ajuda && <p className="mb-4 clear-both text-sm leading-normal text-muted">{ajuda}</p>}
      <div className="clear-both grid gap-4 sm:grid-cols-2">{children}</div>
    </fieldset>
  )
}

function Linha({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 sm:col-span-2">
      <span className="text-[15px]">{rotulo}</span>
      {children}
    </div>
  )
}

export function SimuladorPrecos() {
  const [f, setF] = useState<Formulario>(lerGuardado)
  const [escolha, setEscolha] = useState<number | 'ilimitado'>(24)
  const [real, setReal] = useState<PrecoPublicado | null>(null)
  const [semReal, setSemReal] = useState(false)
  const [confirmando, setConfirmando] = useState(false)
  const [publicando, setPublicando] = useState(false)
  const [aviso, setAviso] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null)

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

  useEffect(() => {
    let ativo = true
    admin.preco().then(
      (r) => ativo && setReal(r),
      () => ativo && setSemReal(true),
    )
    return () => {
      ativo = false
    }
  }, [])

  const { params, participantes, cotacao, erro } = useMemo(() => ler(f), [f])
  const n = participantes ?? 0
  const preco = params ? calcularPreco(n, params, escolha) : null
  const hoje = real && params ? calcularPreco(n, real.params, escolha) : null
  const pagos = params ? participantesPagos(n, params, escolha) : 0
  const igual = !!(real && params && mudancas(real.params, params).length === 0)
  const lista = useMemo(() => (real && params ? mudancas(real.params, params) : []), [real, params])

  const tamanhos = useMemo(() => [...new Set([5, 10, 25, 50, 100, 150, 200, ...(participantes ? [participantes] : [])])].sort((a, b) => a - b), [participantes])

  const publicar = async () => {
    if (!params) return
    setPublicando(true)
    setAviso(null)
    try {
      setReal(await admin.publicarPreco(params))
      setConfirmando(false)
      setAviso({ tipo: 'ok', texto: 'Preços publicados no real.' })
    } catch (e) {
      setAviso({ tipo: 'erro', texto: e instanceof ErroApi ? e.message : 'Não deu para publicar. Tente de novo.' })
    } finally {
      setPublicando(false)
    }
  }

  const carregarReal = () => {
    if (!real) return
    setF((atual) => ({ ...atual, ...doParams(real.params) }))
    try {
      localStorage.setItem(CHAVE, JSON.stringify({ ...f, ...doParams(real.params) }))
    } catch {
      // sem armazenamento: só não guarda
    }
    setAviso({ tipo: 'ok', texto: real.publicado ? 'Valores do real carregados no simulador.' : 'Nada publicado ainda: carreguei os valores propostos.' })
  }

  const campo = (rotulo: string, chave: keyof Omit<Formulario, 'cobrarTodos' | 'arredondar90'>, ajuda?: string, modo: 'numeric' | 'decimal' = 'numeric') => (
    <Campo rotulo={rotulo} ajuda={ajuda}>
      {(id) => <Input id={id} inputMode={modo} value={f[chave]} onChange={(e) => mudar({ [chave]: e.target.value })} />}
    </Campo>
  )

  const estado = semReal ? null : !real ? null : !real.publicado ? 'Nunca publicado' : igual ? 'Igual ao real' : `${lista.length} ${lista.length === 1 ? 'mudança' : 'mudanças'} em relação ao real`
  const inicio1 = f.cobrarTodos ? 1 : (inteiro(f.gratis) ?? 0) + 1
  const inicio2 = (inteiro(f.ate1) ?? 0) + 1

  return (
    <div className="mx-auto max-w-[1180px]">
      <Titulo detalhe="Teste o preço por participante e publique no real quando estiver bom. Os números que você digita ficam neste navegador até publicar.">Simulador de preços</Titulo>

      <div className="mb-6 flex flex-wrap items-center gap-3">
        {estado && (
          <span className={`rounded-full border px-3 py-1.5 text-sm ${igual ? 'border-line text-muted' : 'border-paper/40 text-paper'}`}>
            {estado}
            {real?.publicado && real.atualizado_em && <span className="text-muted"> · publicado {dataHora(real.atualizado_em)} por {real.atualizado_por}</span>}
          </span>
        )}
        {semReal && <span className="text-sm text-muted">Não consegui consultar o preço publicado.</span>}
        <div className="flex flex-wrap gap-3 sm:ml-auto">
          <Button type="button" variant="outline" onClick={carregarReal} disabled={!real}>
            Carregar o real
          </Button>
          <Button type="button" onClick={() => setConfirmando(true)} disabled={!params || !real || igual || confirmando}>
            Publicar no real
          </Button>
        </div>
      </div>

      {aviso && <div className="mb-6"><Aviso tipo={aviso.tipo}>{aviso.texto}</Aviso></div>}
      {erro && <div className="mb-6"><Aviso tipo="erro">{erro}</Aviso></div>}
      {confirmando && params && real && (
        <Cartao className="mb-6">
          <Confirmacao
            pergunta="Publicar estes preços no real?"
            detalhe="O que muda fica registrado na auditoria. Eventos que já foram pagos não mudam."
            rotuloConfirmar="Publicar"
            rotuloCarregando="Publicando..."
            carregando={publicando}
            onConfirmar={publicar}
            onCancelar={() => setConfirmando(false)}
          />
          <ul className="mt-4 flex flex-col gap-1.5 text-[15px] tabular-nums">
            {(real.publicado ? lista : regras(params).map(([r, v]) => `${r}: ${v}`)).map((l) => (
              <li key={l}>{l}</li>
            ))}
          </ul>
        </Cartao>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)] lg:items-start">
        <Cartao className="lg:sticky lg:top-4">
          <h2 className="font-display text-[22px] leading-none">Simulação</h2>
          <div className="mt-5">{campo('Participantes', 'participantes')}</div>
          <div className="mt-2 flex flex-wrap gap-2">
            {ATALHOS.map((a) => (
              <button key={a} type="button" onClick={() => mudar({ participantes: String(a) })} className={`min-h-11 min-w-11 rounded-full border px-3 text-sm tabular-nums transition-colors ${n === a ? 'border-paper bg-paper text-base' : 'border-line text-muted hover:text-paper'}`}>
                {a}
              </button>
            ))}
          </div>

          <p className="mt-6 text-sm font-medium" id="rotulo-fotos">Fotos por pessoa</p>
          <div role="radiogroup" aria-labelledby="rotulo-fotos" className="mt-2 flex flex-wrap gap-2">
            {[...OPCOES_FOTOS, 'ilimitado' as const].map((o) => (
              <button key={o} type="button" role="radio" aria-checked={escolha === o} onClick={() => setEscolha(o)} className={`min-h-11 rounded-full border px-4 text-sm transition-colors ${escolha === o ? 'border-paper bg-paper font-semibold text-base' : 'border-line text-muted hover:text-paper'}`}>
                {o === 'ilimitado' ? 'Ilimitado' : o}
              </button>
            ))}
          </div>

          {preco !== null && (
            <div className="mt-7 border-t border-line pt-6" aria-live="polite">
              <p className="font-display text-[54px] leading-none tabular-nums">{dinheiro(preco)}</p>
              <p className="mt-3 text-[15px] text-muted tabular-nums">
                {preco === 0 ? `Até ${params!.gratis} participantes com ${params!.fotosTeste} fotos não pagam.` : `${formatarReais(Math.round(preco / n))} por participante, ${pagos} pagando`}
              </p>
              {escolha === 'ilimitado' && <p className="mt-1 text-sm text-muted">Uso justo: até {params!.tetoIlimitado} fotos por pessoa.</p>}
              {hoje !== null && hoje !== preco && (
                <p className="mt-4 rounded-[12px] border border-line px-3 py-2 text-sm tabular-nums">
                  No real hoje: {dinheiro(hoje)} <span className="text-muted">({preco > hoje ? '+' : '−'}{formatarReais(Math.abs(preco - hoje))})</span>
                </p>
              )}
            </div>
          )}
        </Cartao>

        <div className="flex min-w-0 flex-col gap-6">
          <Cartao>
            <h2 className="font-display text-[22px] leading-none">Quanto fica</h2>
            {params && (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[620px] text-left text-[15px] tabular-nums">
                  <thead className="text-sm text-muted">
                    <tr className="border-b border-line">
                      <th className="py-2 pr-3 font-medium">Participantes</th>
                      {OPCOES_FOTOS.map((o) => (
                        <th key={o} className="py-2 pr-3 font-medium">{o} fotos</th>
                      ))}
                      <th className="py-2 pr-3 font-medium">Ilimitado</th>
                      <th className="py-2 font-medium">Once</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tamanhos.map((t) => {
                      const once = ONCE_USD.find((o) => o.convidados === t)
                      const celula = (c: number, o: number | 'ilimitado') => (
                        <td key={String(o)} className={`py-2.5 pr-3 ${t === n && o === escolha ? 'font-semibold text-paper' : ''}`}>{dinheiro(c)}</td>
                      )
                      return (
                        <tr key={t} className={`border-b border-line/60 ${t === n ? 'bg-surface' : ''}`}>
                          <td className="py-2.5 pr-3">{t}</td>
                          {OPCOES_FOTOS.map((o) => celula(calcularPreco(t, params, o), o))}
                          {celula(calcularPreco(t, params, 'ilimitado'), 'ilimitado')}
                          <td className="py-2.5 text-muted">{once ? (once.centavos === 0 ? 'Grátis' : cotacao ? formatarReais(Math.round(once.centavos * cotacao)) : '—') : '—'}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
            <div className="mt-4 flex flex-wrap items-end gap-x-6 gap-y-3">
              <div className="w-[160px]">{campo('Dólar (R$)', 'cotacao', undefined, 'decimal')}</div>
              <p className="max-w-[420px] pb-1 text-sm leading-normal text-muted">Once: once.film/pricing em 29/10/2026, em dólares e convertido pela cotação. Ela cobra à parte US$ 9,99 pelo extra de fotos ilimitadas.</p>
            </div>
          </Cartao>

          <Cartao>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-display text-[22px] leading-none">Regras de preço</h2>
              <Button type="button" variant="ghost" onClick={() => mudar(doParams(PARAMS_PADRAO))}>
                Voltar aos valores propostos
              </Button>
            </div>
            <div className="mt-5 flex flex-col gap-6">
              <Grupo titulo="Teste grátis">
                {campo('Participantes grátis', 'gratis')}
                {campo('Fotos por pessoa no teste', 'fotosTeste')}
                <Linha rotulo="Passou do grátis, todos pagam">
                  <Interruptor marcado={f.cobrarTodos} onMudar={(v) => mudar({ cobrarTodos: v })} rotulo="Passou do grátis, todos pagam" />
                </Linha>
              </Grupo>

              <Grupo titulo="Preço por participante (R$)" ajuda="Cada participante custa o preço do degrau em que cai.">
                <div className="flex flex-col gap-2 sm:col-span-2">
                  <div className="grid grid-cols-[1fr_88px_120px] items-center gap-3">
                    <span className="text-[15px] tabular-nums">Do {inicio1}º ao nº</span>
                    <Input aria-label="Último participante do 1º degrau" inputMode="numeric" value={f.ate1} onChange={(e) => mudar({ ate1: e.target.value })} />
                    <Input aria-label="Preço do 1º degrau" inputMode="decimal" value={f.preco1} onChange={(e) => mudar({ preco1: e.target.value })} />
                  </div>
                  <div className="grid grid-cols-[1fr_88px_120px] items-center gap-3">
                    <span className="text-[15px] tabular-nums">Do {inicio2}º ao nº</span>
                    <Input aria-label="Último participante do 2º degrau" inputMode="numeric" value={f.ate2} onChange={(e) => mudar({ ate2: e.target.value })} />
                    <Input aria-label="Preço do 2º degrau" inputMode="decimal" value={f.preco2} onChange={(e) => mudar({ preco2: e.target.value })} />
                  </div>
                  <div className="grid grid-cols-[1fr_88px_120px] items-center gap-3">
                    <span className="text-[15px] tabular-nums">Do {(inteiro(f.ate2) ?? 0) + 1}º em diante</span>
                    <span />
                    <Input aria-label="Preço acima do 2º degrau" inputMode="decimal" value={f.preco3} onChange={(e) => mudar({ preco3: e.target.value })} />
                  </div>
                </div>
              </Grupo>

              <Grupo titulo="Fotos" ajuda="Os degraus já incluem as fotos da base. Acima disso cada foto custa a mais, por participante.">
                {campo('Fotos já incluídas nos degraus', 'fotosBase')}
                {campo('Cada foto acima disso (R$)', 'fotoExtra', undefined, 'decimal')}
                {campo('Fotos ilimitadas (R$ por participante)', 'ilimitado', 'Substitui os degraus.', 'decimal')}
                {campo('Teto de fotos no ilimitado', 'teto', 'Uso justo.')}
                {campo('Fotos sugeridas na criação', 'fotosSugeridas', 'A opção que já vem marcada no /criar.')}
              </Grupo>

              <Grupo titulo="Fechamento do valor">
                {campo('Valor mínimo do evento pago (R$)', 'piso', 'Cobre a taxa fixa do pagamento.', 'decimal')}
                <Linha rotulo="Arredondar o total para ,90">
                  <Interruptor marcado={f.arredondar90} onMudar={(v) => mudar({ arredondar90: v })} rotulo="Arredondar o total para ,90" />
                </Linha>
              </Grupo>
            </div>
          </Cartao>
        </div>
      </div>
    </div>
  )
}
