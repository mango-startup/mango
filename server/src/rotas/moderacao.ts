import { createHash } from 'node:crypto'
import { Hono } from 'hono'
import type { Pool } from 'pg'
import { ipDoCliente } from '../limites.ts'
import { hashToken } from '../tokens.ts'
import { criarAcesso } from './acesso.ts'
import { erro } from './util.ts'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const MOTIVO_MAX = 300

/**
 * Moderação (plano, item A9): o anfitrião apaga fotos e o convidado pede remoção.
 * O pedido fica gravado (o anfitrião lê pela API) e também sai numa linha de log estruturada,
 * que é o que o suporte lê enquanto não existe e-mail (issue #58).
 */
export function rotasModeracao(pool: Pool, agora: () => Date = () => new Date(), log: (linha: string) => void = console.log): Hono {
  const app = new Hono()
  const { acesso, anfitriao } = criarAcesso(pool, agora)

  // Apaga a foto: some do álbum na hora; o arquivo sai do armazenamento em até 30 dias (limpeza.ts).
  app.delete('/api/anfitriao/fotos/:fotoId', async (c) => {
    const e = await anfitriao(c)
    if (!e) return erro(c, 401, 'nao_autorizado', 'Token do anfitrião inválido.')
    const fotoId = c.req.param('fotoId').toLowerCase()
    if (!UUID.test(fotoId)) return erro(c, 400, 'id_invalido', 'O id da foto precisa ser um UUID.')

    const r = await pool.query('update fotos set removida_em = $3 where id = $1 and evento_id = $2 and removida_em is null returning id', [fotoId, e.id, agora()])
    if (!r.rowCount) return erro(c, 404, 'nao_encontrada', 'Foto não encontrada.')
    await pool.query(
      `update pedidos_remocao set resolucao = 'removida', resolvido_em = $2 where foto_id = $1 and resolvido_em is null`,
      [fotoId, agora()],
    )
    return c.body(null, 204)
  })

  // Quem vê o álbum pode pedir a remoção de uma foto. Um pedido por pessoa e foto (repetir não duplica).
  app.post('/api/eventos/:codigo/fotos/:fotoId/pedir-remocao', async (c) => {
    const a = await acesso(c)
    if (a instanceof Response) return a
    if (a.papel === 'anfitriao') return erro(c, 400, 'anfitriao_apaga', 'Você é o anfitrião: apague a foto direto.')
    const fotoId = c.req.param('fotoId')!.toLowerCase()
    if (!UUID.test(fotoId)) return erro(c, 400, 'id_invalido', 'O id da foto precisa ser um UUID.')

    let motivo: string | null = null
    try {
      const corpo = (await c.req.json()) as { motivo?: unknown }
      if (typeof corpo.motivo === 'string') motivo = corpo.motivo.trim().slice(0, MOTIVO_MAX) || null
    } catch {
      // sem corpo: o motivo é opcional
    }

    const foto = await pool.query('select 1 from fotos where id = $1 and evento_id = $2 and removida_em is null', [fotoId, a.evento.id])
    if (!foto.rowCount) return erro(c, 404, 'nao_encontrada', 'Foto não encontrada.')

    // Convidado reconhecido pelo aparelho; quem só abriu o link entra pelo IP (guardado só como hash).
    let solicitante = `ip:${createHash('sha256').update(ipDoCliente(c)).digest('hex').slice(0, 16)}`
    const token = c.req.header('x-convidado-token')
    if (token) {
      const conv = await pool.query<{ id: string }>('select id from convidados where evento_id = $1 and token_hash = $2', [a.evento.id, hashToken(token)])
      if (conv.rows[0]) solicitante = `c:${conv.rows[0].id}`
    }

    const r = await pool.query<{ id: string }>(
      `insert into pedidos_remocao (evento_id, foto_id, solicitante, motivo, criado_em) values ($1,$2,$3,$4,$5)
       on conflict (foto_id, solicitante) do nothing returning id`,
      [a.evento.id, fotoId, solicitante, motivo, agora()],
    )
    if (!r.rows[0]) return c.json({ repetido: true })
    log(JSON.stringify({ aviso: 'pedido_remocao', evento: a.evento.codigo, foto: fotoId, pedido: r.rows[0].id, motivo }))
    return c.json({ pedido_id: r.rows[0].id, repetido: false }, 201)
  })

  // Pedidos de remoção pendentes, com o número do quadro no álbum.
  app.get('/api/anfitriao/pedidos-remocao', async (c) => {
    const e = await anfitriao(c)
    if (!e) return erro(c, 401, 'nao_autorizado', 'Token do anfitrião inválido.')
    const r = await pool.query(
      `select p.id, p.foto_id, t.numero::int as numero, p.motivo, p.criado_em
       from pedidos_remocao p
       join (select id, row_number() over (order by coalesce(tirada_em, criado_em), id) as numero
             from fotos where evento_id = $1 and removida_em is null) t on t.id = p.foto_id
       where p.evento_id = $1 and p.resolvido_em is null
       order by p.criado_em`,
      [e.id],
    )
    return c.json({ pedidos: r.rows })
  })

  // O anfitrião decide manter a foto: o pedido sai da fila.
  app.post('/api/anfitriao/pedidos-remocao/:pedidoId/manter', async (c) => {
    const e = await anfitriao(c)
    if (!e) return erro(c, 401, 'nao_autorizado', 'Token do anfitrião inválido.')
    const pedidoId = c.req.param('pedidoId').toLowerCase()
    if (!UUID.test(pedidoId)) return erro(c, 400, 'id_invalido', 'O id do pedido precisa ser um UUID.')
    const r = await pool.query(
      `update pedidos_remocao set resolucao = 'mantida', resolvido_em = $3
       where id = $1 and evento_id = $2 and resolvido_em is null returning id`,
      [pedidoId, e.id, agora()],
    )
    if (!r.rowCount) return erro(c, 404, 'nao_encontrado', 'Pedido não encontrado.')
    return c.body(null, 204)
  })

  return app
}
