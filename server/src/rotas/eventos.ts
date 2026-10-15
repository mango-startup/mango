import { Hono } from 'hono'
import type { Context } from 'hono'
import type { Pool } from 'pg'
import { avancarEstados } from '../agendador.ts'
import { CAPTURA_MAX_MS, REVELACAO_MAX_MS, podeTransicionar } from '../estados.ts'
import { PACOTES, POSES_VALIDAS, ehPacote } from '../pacotes.ts'
import { gerarCodigo, gerarToken, hashToken } from '../tokens.ts'
import { erro } from './util.ts'

interface EventoLinha {
  id: string
  codigo: string
  nome: string
  estado: string
  pacote: string
  limite_convidados: number
  poses_por_convidado: number
  limite_fotos: number | null
  captura_inicio: Date | null
  captura_fim: Date | null
  revelacao_em: Date | null
  revelacao_manual: boolean
  album_privado: boolean
  revelado_em: Date | null
  expira_em: Date | null
}

const COLUNAS = `id, codigo, nome, estado, pacote, limite_convidados, poses_por_convidado, limite_fotos,
  captura_inicio, captura_fim, revelacao_em, revelacao_manual, album_privado, revelado_em, expira_em`

async function lerCorpo(c: Context): Promise<Record<string, unknown> | null> {
  try {
    const corpo = await c.req.json()
    return corpo && typeof corpo === 'object' && !Array.isArray(corpo) ? (corpo as Record<string, unknown>) : null
  } catch {
    return null
  }
}

function lerData(valor: unknown): Date | null {
  if (typeof valor !== 'string') return null
  const data = new Date(valor)
  return Number.isNaN(data.getTime()) ? null : data
}

function bearer(c: Context): string | null {
  const m = /^Bearer (\S+)$/.exec(c.req.header('authorization') ?? '')
  return m ? m[1] : null
}

export function rotasEventos(pool: Pool, agora: () => Date = () => new Date()): Hono {
  const app = new Hono()

  // Cria o evento. O token do anfitrião só aparece nesta resposta.
  app.post('/api/eventos', async (c) => {
    const corpo = await lerCorpo(c)
    if (!corpo) return erro(c, 400, 'corpo_invalido', 'Envie um JSON válido.')

    const nome = typeof corpo.nome === 'string' ? corpo.nome.trim() : ''
    if (nome.length < 1 || nome.length > 80) return erro(c, 400, 'nome_invalido', 'O nome precisa ter de 1 a 80 caracteres.')

    const pacoteNome = corpo.pacote ?? 'teste'
    if (!ehPacote(pacoteNome)) return erro(c, 400, 'pacote_invalido', 'Pacote desconhecido.')
    const pacote = PACOTES[pacoteNome]

    const poses = corpo.poses_por_convidado ?? Math.min(24, pacote.posesMax)
    if (typeof poses !== 'number' || !POSES_VALIDAS.includes(poses) || poses > pacote.posesMax) {
      return erro(c, 400, 'poses_invalidas', `As poses podem ser ${POSES_VALIDAS.filter((p) => p <= pacote.posesMax).join(', ')}.`)
    }

    const inicio = lerData(corpo.captura_inicio)
    const fim = lerData(corpo.captura_fim)
    if (!inicio || !fim) return erro(c, 400, 'datas_invalidas', 'Informe captura_inicio e captura_fim (ISO 8601).')
    if (fim <= agora()) return erro(c, 400, 'fim_no_passado', 'O fim da captura precisa ser no futuro.')
    if (fim <= inicio) return erro(c, 400, 'periodo_invalido', 'O fim precisa ser depois do início.')
    if (fim.getTime() - inicio.getTime() > CAPTURA_MAX_MS) {
      return erro(c, 400, 'periodo_longo', 'A câmera pode ficar aberta por no máximo 48 horas.')
    }

    const manual = corpo.revelacao_manual === true
    let revelacao: Date | null = null
    if (!manual) {
      // Padrão: 12 h depois do fim. O front costuma mandar "10h do dia seguinte" no fuso do anfitrião.
      revelacao = corpo.revelacao_em === undefined ? new Date(fim.getTime() + 12 * 3600_000) : lerData(corpo.revelacao_em)
      if (!revelacao) return erro(c, 400, 'revelacao_invalida', 'revelacao_em inválida.')
      if (revelacao < fim || revelacao.getTime() - fim.getTime() > REVELACAO_MAX_MS) {
        return erro(c, 400, 'revelacao_fora_do_prazo', 'A revelação deve ser depois do fim e em até 7 dias.')
      }
    }

    const token = gerarToken()
    // Pacote pago fica aguardando pagamento (o pagamento entra depois); o grátis já nasce pronto.
    const estado = pacote.gratis ? 'pronto' : 'aguardando_pagamento'

    for (let tentativa = 0; tentativa < 5; tentativa++) {
      const codigo = gerarCodigo()
      try {
        const r = await pool.query<EventoLinha>(
          `insert into eventos (codigo, anfitriao_token_hash, nome, estado, pacote, limite_convidados,
             poses_por_convidado, limite_fotos, captura_inicio, captura_fim, revelacao_em, revelacao_manual)
           values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) returning ${COLUNAS}`,
          [codigo, hashToken(token), nome, estado, pacoteNome, pacote.convidados, poses, pacote.convidados * poses, inicio, fim, revelacao, manual],
        )
        return c.json({ evento: r.rows[0], anfitriao_token: token }, 201)
      } catch (e) {
        if ((e as { code?: string }).code !== '23505') throw e // 23505 = código repetido: tenta outro
      }
    }
    return c.json({ erro: 'codigo_indisponivel', mensagem: 'Tente de novo.' }, 409)
  })

  // Estado público do evento (o que o convidado vê no link /c/:codigo).
  app.get('/api/eventos/:codigo', async (c) => {
    await avancarEstados(pool, agora())
    const r = await pool.query<EventoLinha & { convidados: string }>(
      `select ${COLUNAS}, (select count(*) from convidados where evento_id = eventos.id) as convidados
       from eventos where codigo = $1 and excluido_em is null`,
      [c.req.param('codigo').toUpperCase()],
    )
    const e = r.rows[0]
    if (!e) return erro(c, 404, 'nao_encontrado', 'Evento não encontrado.')
    return c.json({
      nome: e.nome,
      estado: e.estado,
      poses_por_convidado: e.poses_por_convidado,
      captura_inicio: e.captura_inicio,
      captura_fim: e.captura_fim,
      revelacao_em: e.revelacao_em,
      revelacao_manual: e.revelacao_manual,
      revelado_em: e.revelado_em,
      expira_em: e.expira_em,
      album_privado: e.album_privado,
      lotado: Number(e.convidados) >= e.limite_convidados,
    })
  })

  // Convidado entra: token novo, ou o mesmo se o aparelho já entrou (header X-Convidado-Token).
  app.post('/api/eventos/:codigo/entrar', async (c) => {
    await avancarEstados(pool, agora())
    const corpo = (await lerCorpo(c)) ?? {}
    const apelido = typeof corpo.apelido === 'string' ? corpo.apelido.trim().slice(0, 40) || null : null
    const tokenExistente = c.req.header('x-convidado-token')

    const cliente = await pool.connect()
    try {
      await cliente.query('begin')
      const ev = await cliente.query<EventoLinha>(
        `select ${COLUNAS} from eventos where codigo = $1 and excluido_em is null for update`,
        [c.req.param('codigo').toUpperCase()],
      )
      const e = ev.rows[0]
      if (!e) {
        await cliente.query('rollback')
        return erro(c, 404, 'nao_encontrado', 'Evento não encontrado.')
      }

      if (tokenExistente) {
        const ja = await cliente.query<{ id: string; apelido: string | null }>(
          'select id, apelido from convidados where evento_id = $1 and token_hash = $2',
          [e.id, hashToken(tokenExistente)],
        )
        if (ja.rows[0]) {
          const usadas = await cliente.query<{ n: string }>(
            'select count(*) as n from fotos where convidado_id = $1 and removida_em is null',
            [ja.rows[0].id],
          )
          await cliente.query('commit')
          return c.json({
            convidado_id: ja.rows[0].id,
            apelido: ja.rows[0].apelido,
            poses_restantes: Math.max(0, e.poses_por_convidado - Number(usadas.rows[0].n)),
          })
        }
      }

      if (e.estado !== 'captura_aberta') {
        await cliente.query('rollback')
        return erro(c, 409, 'captura_fechada', 'A câmera deste evento não está aberta.', {
          estado: e.estado,
          captura_inicio: e.captura_inicio,
          captura_fim: e.captura_fim,
        })
      }
      const total = await cliente.query<{ n: string }>('select count(*) as n from convidados where evento_id = $1', [e.id])
      if (Number(total.rows[0].n) >= e.limite_convidados) {
        await cliente.query('rollback')
        return erro(c, 409, 'lotado', 'Este evento atingiu o limite de convidados.')
      }

      const token = gerarToken()
      const novo = await cliente.query<{ id: string }>(
        'insert into convidados (evento_id, token_hash, apelido) values ($1,$2,$3) returning id',
        [e.id, hashToken(token), apelido],
      )
      await cliente.query('commit')
      return c.json({ convidado_id: novo.rows[0].id, convidado_token: token, apelido, poses_restantes: e.poses_por_convidado }, 201)
    } catch (e) {
      await cliente.query('rollback').catch(() => {})
      throw e
    } finally {
      cliente.release()
    }
  })

  // --- Anfitrião (token secreto no header Authorization: Bearer ...) ---
  async function eventoDoAnfitriao(c: Context): Promise<EventoLinha | null> {
    const token = bearer(c)
    if (!token) return null
    await avancarEstados(pool, agora())
    const r = await pool.query<EventoLinha>(
      `select ${COLUNAS} from eventos where anfitriao_token_hash = $1 and excluido_em is null`,
      [hashToken(token)],
    )
    return r.rows[0] ?? null
  }

  app.get('/api/anfitriao/evento', async (c) => {
    const e = await eventoDoAnfitriao(c)
    if (!e) return erro(c, 401, 'nao_autorizado', 'Token do anfitrião inválido.')
    const n = await pool.query<{ convidados: string; fotos: string }>(
      `select (select count(*) from convidados where evento_id = $1) as convidados,
              (select count(*) from fotos where evento_id = $1 and removida_em is null) as fotos`,
      [e.id],
    )
    return c.json({ evento: e, convidados: Number(n.rows[0].convidados), fotos: Number(n.rows[0].fotos) })
  })

  async function transicionar(c: Context, de: 'captura_aberta' | 'captura_encerrada', para: 'captura_encerrada' | 'revelado') {
    const e = await eventoDoAnfitriao(c)
    if (!e) return erro(c, 401, 'nao_autorizado', 'Token do anfitrião inválido.')
    if (e.estado !== de || !podeTransicionar(e.estado, para)) {
      return erro(c, 409, 'transicao_invalida', `Não dá para ir de ${e.estado} para ${para}.`, { estado: e.estado })
    }
    const agoraData = agora()
    const r = await pool.query<EventoLinha>(
      para === 'revelado'
        ? `update eventos set estado = 'revelado', revelado_em = $2::timestamptz, atualizado_em = $2::timestamptz,
             expira_em = $2::timestamptz + (case when pacote = 'teste' then interval '30 days' else interval '365 days' end)
           where id = $1 and estado = $3::text returning ${COLUNAS}`
        : `update eventos set estado = 'captura_encerrada', captura_fim = least(captura_fim, $2::timestamptz), atualizado_em = $2::timestamptz
           where id = $1 and estado = $3::text returning ${COLUNAS}`,
      [e.id, agoraData, de],
    )
    // Outra requisição pode ter mudado o estado entre a leitura e o update.
    if (!r.rows[0]) return erro(c, 409, 'transicao_invalida', 'O estado do evento mudou. Tente de novo.')
    return c.json({ evento: r.rows[0] })
  }

  app.post('/api/anfitriao/evento/encerrar', (c) => transicionar(c, 'captura_aberta', 'captura_encerrada'))
  app.post('/api/anfitriao/evento/revelar', (c) => transicionar(c, 'captura_encerrada', 'revelado'))

  // Exclusão lógica; as fotos são apagadas do armazenamento em até 30 dias (job futuro).
  app.delete('/api/anfitriao/evento', async (c) => {
    const e = await eventoDoAnfitriao(c)
    if (!e) return erro(c, 401, 'nao_autorizado', 'Token do anfitrião inválido.')
    await pool.query('update eventos set excluido_em = $2, atualizado_em = $2 where id = $1', [e.id, agora()])
    return c.body(null, 204)
  })

  return app
}
