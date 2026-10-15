// Ciclo de vida do evento: docs/PLANO-MVP.md seção 3.3.
export type Estado =
  | 'rascunho'
  | 'aguardando_pagamento'
  | 'pronto'
  | 'captura_aberta'
  | 'captura_encerrada'
  | 'revelado'
  | 'expirado'
  | 'cancelado'

const TRANSICOES: Record<Estado, Estado[]> = {
  rascunho: ['aguardando_pagamento', 'pronto'],
  aguardando_pagamento: ['pronto', 'rascunho'],
  pronto: ['captura_aberta', 'cancelado'],
  captura_aberta: ['captura_encerrada'],
  captura_encerrada: ['revelado'],
  revelado: ['expirado'],
  expirado: [],
  cancelado: [],
}

export function podeTransicionar(de: Estado, para: Estado): boolean {
  return TRANSICOES[de].includes(para)
}

export const DAY_MS = 24 * 60 * 60 * 1000
export const CAPTURA_MAX_MS = 48 * 60 * 60 * 1000
export const REVELACAO_MAX_MS = 7 * DAY_MS
