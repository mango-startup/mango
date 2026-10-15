import type { Context } from 'hono'

export type StatusErro = 400 | 401 | 403 | 404 | 409 | 410 | 413 | 415 | 429

export function erro(c: Context, status: StatusErro, codigo: string, mensagem: string, extra = {}) {
  return c.json({ erro: codigo, mensagem, ...extra }, status)
}
