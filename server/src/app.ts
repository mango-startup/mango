import { Hono } from 'hono'
import type { Pool } from 'pg'

export function criarApp(pool: Pick<Pool, 'query'>): Hono {
  const app = new Hono()

  app.get('/api/saude', async (c) => {
    try {
      await pool.query('select 1')
      return c.json({ status: 'ok', banco: 'ok' })
    } catch {
      return c.json({ status: 'erro', banco: 'indisponivel' }, 503)
    }
  })

  return app
}
