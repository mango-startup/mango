import type { Pool } from 'pg'

/**
 * Avança os eventos pelo relógio: início da captura, fim, revelação e expiração.
 * Idempotente: cada UPDATE só pega quem ainda está no estado de origem, então rodar
 * duas vezes (ou em duas instâncias) não causa efeito duplo.
 */
export interface OpcoesAgendador {
  /** Dias até excluir rascunho ou pagamento não concluído (configuração `rascunho_validade_dias`). */
  rascunhoDias?: number
  /** Chamado com os ids dos eventos que acabaram de ser revelados pelo relógio. */
  aoRevelar?: (ids: string[]) => void
}

export async function avancarEstados(pool: Pick<Pool, 'query'>, agora = new Date(), opcoes: OpcoesAgendador = {}): Promise<void> {
  const rascunhoDias = opcoes.rascunhoDias ?? 7
  await pool.query(
    `update eventos set estado = 'captura_aberta', atualizado_em = $1
     where estado = 'pronto' and excluido_em is null and captura_inicio <= $1 and captura_fim > $1`,
    [agora],
  )
  await pool.query(
    `update eventos set estado = 'captura_encerrada', atualizado_em = $1
     where estado in ('pronto', 'captura_aberta') and excluido_em is null
       and captura_fim is not null and captura_fim <= $1`,
    [agora],
  )
  const reveladas = await pool.query<{ id: string }>(
    `update eventos set estado = 'revelado', revelado_em = $1, atualizado_em = $1,
       expira_em = $1::timestamptz + retencao_dias * interval '1 day'
     where estado = 'captura_encerrada' and excluido_em is null
       and revelacao_manual = false and revelacao_em <= $1 returning id::text`,
    [agora],
  )
  if (reveladas.rows.length) opcoes.aoRevelar?.(reveladas.rows.map((r) => r.id))
  // Rascunho ou pagamento que ninguém concluiu em 7 dias some (exclusão lógica).
  await pool.query(
    `update eventos set excluido_em = $1::timestamptz, atualizado_em = $1::timestamptz
     where estado in ('rascunho', 'aguardando_pagamento') and excluido_em is null
       and criado_em <= $1::timestamptz - $2::int * interval '1 day'`,
    [agora, rascunhoDias],
  )
  await pool.query(
    `update eventos set estado = 'expirado', atualizado_em = $1
     where estado = 'revelado' and expira_em <= $1`,
    [agora],
  )
}
