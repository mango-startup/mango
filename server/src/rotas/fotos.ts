import { Hono } from 'hono'
import type { Context } from 'hono'
import { bodyLimit } from 'hono/body-limit'
import type { Pool } from 'pg'
import { avancarEstados } from '../agendador.ts'
import { DAY_MS } from '../estados.ts'
import type { Storage } from '../storage/storage.ts'
import { hashToken } from '../tokens.ts'
import { erro } from './util.ts'

export const FOTO_MAX_BYTES = 2 * 1024 * 1024
export const MINIATURA_MAX_BYTES = 512 * 1024
/** Depois que a câmera fecha, ainda aceitamos envios atrasados por este tempo (plano, seção 2.1 etapa 12). */
const ENVIO_ATRASADO_MS = DAY_MS

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

interface Contexto {
  evento_id: string
  estado: string
  captura_fim: Date | null
  poses_por_convidado: number
  limite_fotos: number | null
  convidado_id: string
  apelido: string | null
}

function ehJpeg(dados: Uint8Array): boolean {
  return dados.length > 3 && dados[0] === 0xff && dados[1] === 0xd8 && dados[2] === 0xff
}

function inteiro(valor: string | undefined, min: number, max: number): number | null | 'invalido' {
  if (valor === undefined || valor === '') return null
  const n = Number(valor)
  return Number.isInteger(n) && n >= min && n <= max ? n : 'invalido'
}

export function rotasFotos(pool: Pool, storage: Storage, agora: () => Date = () => new Date()): Hono {
  const app = new Hono()

  /** Acha o convidado pelo token do aparelho dentro do evento do código. */
  async function convidadoDaRequisicao(c: Context): Promise<Contexto | null> {
    const token = c.req.header('x-convidado-token')
    if (!token) return null
    await avancarEstados(pool, agora())
    const r = await pool.query<Contexto>(
      `select e.id as evento_id, e.estado, e.captura_fim, e.poses_por_convidado, e.limite_fotos,
              c.id as convidado_id, c.apelido
       from eventos e join convidados c on c.evento_id = e.id and c.token_hash = $2
       where e.codigo = $1 and e.excluido_em is null`,
      [c.req.param('codigo')!.toUpperCase(), hashToken(token)],
    )
    return r.rows[0] ?? null
  }

  function aceitaEnvio(ctx: Contexto): boolean {
    if (ctx.estado === 'captura_aberta') return true
    if (ctx.estado === 'captura_encerrada' && ctx.captura_fim) {
      return agora().getTime() <= ctx.captura_fim.getTime() + ENVIO_ATRASADO_MS
    }
    return false
  }

  const limite = (max: number) =>
    bodyLimit({
      maxSize: max,
      onError: (c) => erro(c, 413, 'arquivo_grande', `O arquivo passa de ${Math.round(max / 1024)} KB.`),
    })

  // Estado do convidado: poses que sobram e quais fotos o servidor já tem (para a fila de envio do aparelho).
  app.get('/api/eventos/:codigo/eu', async (c) => {
    const ctx = await convidadoDaRequisicao(c)
    if (!ctx) return erro(c, 401, 'nao_autorizado', 'Convidado não reconhecido neste evento.')
    const r = await pool.query<{ id: string }>(
      'select id from fotos where convidado_id = $1 and removida_em is null order by criado_em',
      [ctx.convidado_id],
    )
    return c.json({
      convidado_id: ctx.convidado_id,
      apelido: ctx.apelido,
      estado: ctx.estado,
      poses_restantes: Math.max(0, ctx.poses_por_convidado - r.rows.length),
      fotos: r.rows.map((f) => f.id),
    })
  })

  // Envio da foto. O id é gerado no aparelho, então repetir o envio é seguro (idempotente).
  app.put('/api/eventos/:codigo/fotos/:fotoId', limite(FOTO_MAX_BYTES), async (c) => {
    const fotoId = c.req.param('fotoId').toLowerCase()
    if (!UUID.test(fotoId)) return erro(c, 400, 'id_invalido', 'O id da foto precisa ser um UUID.')
    if (!(c.req.header('content-type') ?? '').startsWith('image/jpeg')) {
      return erro(c, 415, 'tipo_invalido', 'Envie a foto como image/jpeg.')
    }
    const largura = inteiro(c.req.header('x-largura'), 1, 10000)
    const altura = inteiro(c.req.header('x-altura'), 1, 10000)
    if (largura === 'invalido' || altura === 'invalido') return erro(c, 400, 'dimensoes_invalidas', 'X-Largura/X-Altura inválidas.')
    const tiradaTexto = c.req.header('x-tirada-em')
    const tirada = tiradaTexto ? new Date(tiradaTexto) : null
    if (tirada && Number.isNaN(tirada.getTime())) return erro(c, 400, 'data_invalida', 'X-Tirada-Em inválida.')

    const ctx = await convidadoDaRequisicao(c)
    if (!ctx) return erro(c, 401, 'nao_autorizado', 'Convidado não reconhecido neste evento.')

    const dados = new Uint8Array(await c.req.arrayBuffer())
    if (dados.length > FOTO_MAX_BYTES) return erro(c, 413, 'arquivo_grande', 'A foto passa de 2 MB.')
    if (!ehJpeg(dados)) return erro(c, 415, 'tipo_invalido', 'O arquivo não é um JPEG.')

    const chave = `${ctx.evento_id}/${fotoId}.jpg`
    const cliente = await pool.connect()
    let criada = false
    try {
      await cliente.query('begin')
      // Serializa os envios do evento: o limite de poses e o teto de fotos não podem ser furados em paralelo.
      await cliente.query('select 1 from eventos where id = $1 for update', [ctx.evento_id])

      const existente = await cliente.query<{ convidado_id: string }>('select convidado_id from fotos where id = $1', [fotoId])
      if (existente.rows[0]) {
        await cliente.query('rollback')
        if (existente.rows[0].convidado_id !== ctx.convidado_id) return erro(c, 409, 'id_em_uso', 'Esse id de foto já existe.')
        await storage.salvar(chave, dados) // reenvio: garante o arquivo (pode ter falhado antes)
        return c.json({ foto_id: fotoId, repetida: true })
      }

      if (!aceitaEnvio(ctx)) {
        await cliente.query('rollback')
        return erro(c, 409, 'captura_fechada', 'A câmera deste evento não aceita mais fotos.', { estado: ctx.estado })
      }
      const contagem = await cliente.query<{ do_convidado: string; do_evento: string }>(
        `select count(*) filter (where convidado_id = $2) as do_convidado, count(*) as do_evento
         from fotos where evento_id = $1 and removida_em is null`,
        [ctx.evento_id, ctx.convidado_id],
      )
      if (Number(contagem.rows[0].do_convidado) >= ctx.poses_por_convidado) {
        await cliente.query('rollback')
        return erro(c, 409, 'sem_poses', 'Você usou todas as suas poses.')
      }
      if (ctx.limite_fotos !== null && Number(contagem.rows[0].do_evento) >= ctx.limite_fotos) {
        await cliente.query('rollback')
        return erro(c, 409, 'evento_cheio', 'O evento atingiu o limite de fotos.')
      }

      await cliente.query(
        `insert into fotos (id, evento_id, convidado_id, chave_storage, tipo_mime, tamanho_bytes, largura, altura, tirada_em)
         values ($1,$2,$3,$4,'image/jpeg',$5,$6,$7,$8)`,
        [fotoId, ctx.evento_id, ctx.convidado_id, chave, dados.length, largura, altura, tirada],
      )
      await cliente.query('commit')
      criada = true
    } catch (e) {
      await cliente.query('rollback').catch(() => {})
      throw e
    } finally {
      cliente.release()
    }

    try {
      await storage.salvar(chave, dados)
    } catch (e) {
      // Sem arquivo não vale a pose: desfaz a reserva para o aparelho tentar de novo.
      if (criada) await pool.query('delete from fotos where id = $1', [fotoId])
      throw e
    }
    return c.json({ foto_id: fotoId, repetida: false }, 201)
  })

  // Miniatura (gerada no aparelho). A foto precisa existir e ser do mesmo convidado.
  app.put('/api/eventos/:codigo/fotos/:fotoId/miniatura', limite(MINIATURA_MAX_BYTES), async (c) => {
    const fotoId = c.req.param('fotoId').toLowerCase()
    if (!UUID.test(fotoId)) return erro(c, 400, 'id_invalido', 'O id da foto precisa ser um UUID.')
    if (!(c.req.header('content-type') ?? '').startsWith('image/jpeg')) {
      return erro(c, 415, 'tipo_invalido', 'Envie a miniatura como image/jpeg.')
    }
    const ctx = await convidadoDaRequisicao(c)
    if (!ctx) return erro(c, 401, 'nao_autorizado', 'Convidado não reconhecido neste evento.')
    if (!aceitaEnvio(ctx)) return erro(c, 409, 'captura_fechada', 'A câmera deste evento não aceita mais fotos.', { estado: ctx.estado })

    const foto = await pool.query('select 1 from fotos where id = $1 and convidado_id = $2 and removida_em is null', [fotoId, ctx.convidado_id])
    if (foto.rowCount === 0) return erro(c, 404, 'nao_encontrada', 'Foto não encontrada.')

    const dados = new Uint8Array(await c.req.arrayBuffer())
    if (dados.length > MINIATURA_MAX_BYTES) return erro(c, 413, 'arquivo_grande', 'A miniatura passa de 512 KB.')
    if (!ehJpeg(dados)) return erro(c, 415, 'tipo_invalido', 'O arquivo não é um JPEG.')

    const chave = `${ctx.evento_id}/${fotoId}_min.jpg`
    await storage.salvar(chave, dados)
    await pool.query('update fotos set miniatura_chave = $2 where id = $1', [fotoId, chave])
    return c.json({ foto_id: fotoId })
  })

  return app
}
