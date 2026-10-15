import { Hono } from 'hono'
import type { Pool } from 'pg'
import { LIMITES_PADRAO, criarLimites } from './limites.ts'
import type { Limites } from './limites.ts'
import { rotasAlbum } from './rotas/album.ts'
import { rotasEventos } from './rotas/eventos.ts'
import { rotasFotos } from './rotas/fotos.ts'
import type { Storage } from './storage/storage.ts'

/** `limites: null` desliga os limites de requisição (emergência: RATE_LIMIT=off). */
export function criarApp(
  pool: Pool,
  storage: Storage,
  agora: () => Date = () => new Date(),
  limites: Limites | null = LIMITES_PADRAO,
): Hono {
  const app = new Hono()

  if (limites) {
    const [porFalhas, porCriacao, porUpload] = criarLimites(limites, agora)
    app.use('/api/*', porFalhas)
    app.use('/api/eventos', porCriacao)
    app.use('/api/eventos/:codigo/fotos/:fotoId', porUpload)
    app.use('/api/eventos/:codigo/fotos/:fotoId/miniatura', porUpload)
  }

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
  app.route('/', rotasAlbum(pool, storage, agora))

  return app
}
