import { Hono } from 'hono'
import type { Pool } from 'pg'
import { rotasEventos } from './rotas/eventos.ts'
import { rotasFotos } from './rotas/fotos.ts'
import type { Storage } from './storage/storage.ts'

export function criarApp(pool: Pool, storage: Storage, agora: () => Date = () => new Date()): Hono {
  const app = new Hono()

  app.get('/api/saude', async (c) => {
    try {
      await pool.query('select 1')
      return c.json({ status: 'ok', banco: 'ok' })
    } catch {
      return c.json({ status: 'erro', banco: 'indisponivel' }, 503)
    }
  })

  app.route('/', rotasEventos(pool, agora))
  app.route('/', rotasFotos(pool, storage, agora))

  return app
}
