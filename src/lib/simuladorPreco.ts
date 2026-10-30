// Simulador do novo modelo de preço (#169): cobrança por participante, com os primeiros grátis, degraus de desconto
// por volume e o extra de fotos ilimitadas. É só conta: nada aqui chega ao servidor.

export interface Degrau {
  /** Último participante (número total) coberto por este preço; null = sem limite. */
  ate: number | null
  centavos: number
}

export interface ParamsPreco {
  gratis: number
  fotosTeste: number
  fotosLimitadas: number
  degraus: Degrau[]
  /** Extra por participante pago para liberar fotos ilimitadas. */
  ilimitadasCentavos: number
}

export const PARAMS_PADRAO: ParamsPreco = {
  gratis: 5,
  fotosTeste: 10,
  fotosLimitadas: 10,
  degraus: [
    { ate: 50, centavos: 150 },
    { ate: 100, centavos: 120 },
    { ate: null, centavos: 100 },
  ],
  ilimitadasCentavos: 50,
}

export interface ResultadoPreco {
  pagos: number
  limitado: number
  ilimitado: number
}

/** Preço em centavos para `n` participantes: do (gratis+1)º em diante, cada um custa o preço do degrau em que cai. */
export function calcularPreco(n: number, p: ParamsPreco): ResultadoPreco {
  const total = Math.max(0, Math.floor(n))
  const pagos = Math.max(0, total - p.gratis)
  let limitado = 0
  let inicio = p.gratis
  for (const d of p.degraus) {
    const fim = d.ate ?? Infinity
    const qtd = Math.max(0, Math.min(total, fim) - inicio)
    limitado += qtd * d.centavos
    inicio = Math.max(inicio, fim)
  }
  return { pagos, limitado, ilimitado: limitado + pagos * p.ilimitadasCentavos }
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
