// Simulador do novo modelo de preço (#169): cobrança por participante, com os primeiros grátis, degraus de desconto
// por volume e o extra de fotos ilimitadas. É só conta: nada aqui chega ao servidor.

export interface Degrau {
  /** Último participante (número total) coberto por este preço; null = sem limite. */
  ate: number | null
  centavos: number
}

export interface ParamsPreco {
  gratis: number
  /** Passou do grátis: todos pagam (o grátis é só o teste). Desligado, só quem passa do limite paga. */
  cobrarTodos: boolean
  fotosTeste: number
  fotosLimitadas: number
  degraus: Degrau[]
  /** Extra por participante pago para liberar fotos ilimitadas. */
  ilimitadasCentavos: number
  /** Valor mínimo de qualquer evento pago (cobre a taxa fixa do meio de pagamento). */
  pisoCentavos: number
  /** Arredonda o total para cima até o próximo ,90 (14,90 / 15,90 ...). */
  arredondar90: boolean
}

export const PARAMS_PADRAO: ParamsPreco = {
  gratis: 5,
  cobrarTodos: true,
  fotosTeste: 10,
  fotosLimitadas: 10,
  degraus: [
    { ate: 50, centavos: 150 },
    { ate: 100, centavos: 120 },
    { ate: null, centavos: 100 },
  ],
  ilimitadasCentavos: 50,
  pisoCentavos: 1490,
  arredondar90: true,
}

export interface ResultadoPreco {
  pagos: number
  limitado: number
  ilimitado: number
}

/** Preço em centavos para `n` participantes: cada pagante custa o preço do degrau em que cai. Até `gratis` participantes, não paga nada. */
export function calcularPreco(n: number, p: ParamsPreco): ResultadoPreco {
  const total = Math.max(0, Math.floor(n))
  const pagos = total <= p.gratis ? 0 : p.cobrarTodos ? total : total - p.gratis
  let limitado = 0
  let inicio = total <= p.gratis || p.cobrarTodos ? 0 : p.gratis
  if (total <= p.gratis) return { pagos, limitado, ilimitado: 0 }
  for (const d of p.degraus) {
    const fim = d.ate ?? Infinity
    const qtd = Math.max(0, Math.min(total, fim) - inicio)
    limitado += qtd * d.centavos
    inicio = Math.max(inicio, fim)
  }
  // O piso vale para o preço base; o extra de ilimitadas entra por cima, senão o piso o engole nas festas pequenas.
  const arredonda = (c: number) => (p.arredondar90 ? Math.ceil((c - 90) / 100) * 100 + 90 : c)
  const base = Math.max(limitado, p.pisoCentavos)
  return { pagos, limitado: arredonda(base), ilimitado: arredonda(base + pagos * p.ilimitadasCentavos) }
}

/** Tabela pública da Once (once.film/pricing, consultada em 2026-10-29), em dólares: convidados → centavos de dólar. */
export const ONCE_USD: { convidados: number; centavos: number }[] = [
  { convidados: 5, centavos: 0 },
  { convidados: 10, centavos: 199 },
  { convidados: 25, centavos: 499 },
  { convidados: 50, centavos: 1499 },
  { convidados: 100, centavos: 2999 },
  { convidados: 150, centavos: 4999 },
  { convidados: 200, centavos: 6999 },
]
