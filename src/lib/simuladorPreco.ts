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
  /** Fotos por pessoa escolhidas no pacote limitado (muda o preço). */
  fotosLimitadas: number
  /** Fotos por pessoa que os degraus já incluem. */
  fotosBase: number
  /** Por participante, cada foto acima da base. */
  fotoExtraCentavos: number
  degraus: Degrau[]
  /** Preço por participante das fotos ilimitadas (no lugar dos degraus). */
  ilimitadoCentavos: number
  /** Teto de fotos por pessoa no ilimitado (uso justo). Só informativo na simulação. */
  tetoIlimitado: number
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
  fotosBase: 10,
  fotoExtraCentavos: 6,
  degraus: [
    { ate: 50, centavos: 150 },
    { ate: 100, centavos: 120 },
    { ate: null, centavos: 100 },
  ],
  ilimitadoCentavos: 450,
  tetoIlimitado: 100,
  pisoCentavos: 1490,
  arredondar90: true,
}

/** Opções de fotos por pessoa mostradas lado a lado na tabela. */
export const OPCOES_FOTOS = [10, 15, 24, 36]

/**
 * Preço em centavos para `n` participantes com `fotos` por pessoa (ou ilimitadas). Cada pagante custa o preço do
 * degrau em que cai, mais as fotos acima da base. Até `gratis` participantes, não paga nada. O piso vale para o
 * total; depois vem o arredondamento.
 */
export function calcularPreco(n: number, p: ParamsPreco, fotos: number | 'ilimitado'): number {
  const total = Math.max(0, Math.floor(n))
  if (total <= p.gratis) return 0
  const pagos = p.cobrarTodos ? total : total - p.gratis
  let porDegrau = 0
  let inicio = p.cobrarTodos ? 0 : p.gratis
  for (const d of p.degraus) {
    const fim = d.ate ?? Infinity
    porDegrau += Math.max(0, Math.min(total, fim) - inicio) * d.centavos
    inicio = Math.max(inicio, fim)
  }
  const bruto = fotos === 'ilimitado' ? pagos * p.ilimitadoCentavos : porDegrau + pagos * Math.max(0, fotos - p.fotosBase) * p.fotoExtraCentavos
  const comPiso = Math.max(bruto, p.pisoCentavos)
  return p.arredondar90 ? Math.ceil((comPiso - 90) / 100) * 100 + 90 : comPiso
}

/** Quantos participantes pagam (para mostrar o preço médio). */
export function participantesPagos(n: number, p: ParamsPreco): number {
  const total = Math.max(0, Math.floor(n))
  return total <= p.gratis ? 0 : p.cobrarTodos ? total : total - p.gratis
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
