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

/** E-mail é opcional (anfitrião só com o link): nunca mostrar "null". */
export function rotuloEmail(email: string | null | undefined): string {
  return email || 'sem e-mail'
}

export const ACOES_AUDITORIA: Record<string, string> = {
  'config.alterar': 'Alterou configuração',
  'config.restaurar': 'Voltou ao padrão',
  'pacote.criar': 'Criou pacote',
  'pacote.alterar': 'Alterou pacote',
  'preco.publicar': 'Publicou o preço por participante',
  'admin.entrar': 'Entrou',
  'admin.trocar_senha': 'Trocou a senha',
  'admin.redefinir_senha': 'Redefiniu a senha de',
  'admin.conta_bloqueada': 'Conta bloqueada por tentativas',
  'evento.ver_como_anfitriao': 'Viu o evento como anfitrião',
  'evento.estender_camera': 'Estendeu a câmera',
  'evento.enviar_email': 'Enviou e-mail ao anfitrião',
  'moderacao.resolver_lote': 'Resolveu pedidos de remoção',
}

/** Classe de link com área de toque de 44px (celular). */
export const linkToque = 'inline-flex min-h-11 items-center underline underline-offset-4 hover:text-paper'
