export const campoTexto = 'min-h-11 w-full rounded-[12px] border border-line bg-surface px-3 text-[15px] text-paper placeholder:text-muted/60 disabled:opacity-50'

export function dataHora(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })
}

export const ESTADOS_EVENTO: Record<string, string> = {
  rascunho: 'Rascunho',
  aguardando_pagamento: 'Aguardando pagamento',
  pronto: 'Pronto',
  captura_aberta: 'Câmera aberta',
  captura_encerrada: 'Câmera encerrada',
  revelado: 'Revelado',
  expirado: 'Expirado',
  cancelado: 'Cancelado',
}

export function porcento(v: number | null): string {
  return v === null ? '—' : `${(v * 100).toFixed(0)}%`
}

export function decimal(v: number): string {
  return v.toFixed(1).replace('.', ',')
}
