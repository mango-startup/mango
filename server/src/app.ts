import { Hono } from 'hono'
import type { Pool } from 'pg'
import { criarLimites } from './limites.ts'
import type { Limites, ProvedorLimites } from './limites.ts'
import { rotasAdmin } from './rotas/admin.ts'
import { rotasAlbum } from './rotas/album.ts'
import { rotasEventos } from './rotas/eventos.ts'
import { rotasFotos } from './rotas/fotos.ts'
import { rotasModeracao } from './rotas/moderacao.ts'
import { criarServicos } from './servicos.ts'
import type { Servicos } from './servicos.ts'
import type { Storage } from './storage/storage.ts'

/**
 * `limites`: `undefined` = valores da configuração do admin (`rl_*`, e `rl_ativo` desliga tudo);
 * objeto = valores fixos (testes); `null` = sem limites (emergência: RATE_LIMIT=off).
 */
export function criarApp(
  pool: Pool,
  storage: Storage,
  agora: () => Date = () => new Date(),
  limites?: Limites | null,
  servicos: Servicos = criarServicos(pool, agora),
): Hono {
  const app = new Hono()

  const provedor: ProvedorLimites | null =
    limites === null
      ? null
      : limites
        ? () => limites
        : async () => {
            const c = await servicos.config.valores()
            if (!c.rl_ativo) return null
            return {
              criarEventoPorHora: c.rl_criar_evento_hora,
              uploadsPorMinutoPorConvidado: c.rl_upload_minuto,
              falhasPorMinuto: c.rl_falhas_minuto,
              pedidosRemocaoPorHora: c.rl_pedido_remocao_hora,
            }
          }

  if (provedor) {
    const [porFalhas, porCriacao, porUpload, porRemocao] = criarLimites(provedor, agora)
    app.use('/api/*', porFalhas)
    app.use('/api/eventos', porCriacao)
    app.use('/api/eventos/:codigo/fotos/:fotoId', porUpload)
    app.use('/api/eventos/:codigo/fotos/:fotoId/miniatura', porUpload)
    app.use('/api/eventos/:codigo/fotos/:fotoId/pedir-remocao', porRemocao)
  }

  app.get('/api/saude', async (c) => {
    try {
      await pool.query('select 1')
      return c.json({ status: 'ok', banco: 'ok' })
    } catch {
      return c.json({ status: 'erro', banco: 'indisponivel' }, 503)
    }
  })

  app.route('/', rotasEventos(pool, agora, servicos))
  app.route('/', rotasFotos(pool, storage, agora, servicos))
  app.route('/', rotasAlbum(pool, storage, agora, servicos))
  app.route('/', rotasModeracao(pool, agora, servicos))
  app.route('/', rotasAdmin(pool, servicos, agora))

  return app
}
