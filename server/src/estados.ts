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
