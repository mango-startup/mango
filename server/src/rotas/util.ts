import type { Context } from 'hono'

export type StatusErro = 400 | 401 | 404 | 409 | 413 | 415

export function erro(c: Context, status: StatusErro, codigo: string, mensagem: string, extra = {}) {
  return c.json({ erro: codigo, mensagem, ...extra }, status)
}
