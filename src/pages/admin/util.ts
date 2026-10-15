export const campoTexto = 'min-h-11 w-full rounded-[12px] border border-line bg-surface px-3 text-[15px] text-paper placeholder:text-muted/60 disabled:opacity-50'

export function dataHora(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })
}
