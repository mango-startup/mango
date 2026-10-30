import { Hono } from 'hono'
import type { Context } from 'hono'
import type { Pool } from 'pg'
import { podeTransicionar } from '../estados.ts'
import type { Servicos } from '../servicos.ts'
import { gerarCodigo, gerarToken, hashToken } from '../tokens.ts'
import { calcularPreco } from '../preco.ts'
import { validarConfig } from '../validacao.ts'
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

function bearer(c: Context): string | null {
  const m = /^Bearer (\S+)$/.exec(c.req.header('authorization') ?? '')
  return m ? m[1] : null
}

export function rotasEventos(pool: Pool, agora: () => Date = () => new Date(), servicos: Servicos): Hono {
  const app = new Hono()

  // Cria o evento. O token do anfitrião só aparece nesta resposta.
  app.post('/api/eventos', async (c) => {
    const corpo = await lerCorpo(c)
    if (!corpo) return erro(c, 400, 'corpo_invalido', 'Envie um JSON válido.')

    const cfg = await servicos.config.valores()
    if (!cfg.criacao_aberta) return erro(c, 503, 'criacao_pausada', 'A criação de eventos está pausada por um instante. Tente de novo em breve.')

    const dinamico = cfg.preco_dinamico && corpo.participantes !== undefined
    const params = dinamico ? (await servicos.precos.obter()).params : null

    // Preço por participante (#178): o servidor calcula o valor; o pacote do evento é o teste (se der zero) ou o marcador.
    let participantes = 0
    let fotos: number | 'ilimitado' = 0
    let valor = 0
    if (params) {
      const p = corpo.participantes
      const f = corpo.fotos ?? params.fotosLimitadas
      if (typeof p !== 'number' || !Number.isInteger(p) || p < 1 || p > 5000) return erro(c, 400, 'participantes_invalidos', 'Informe de 1 a 5000 participantes.')
      if (f !== 'ilimitado' && (typeof f !== 'number' || !Number.isInteger(f) || f < 1 || f > params.tetoIlimitado)) {
        return erro(c, 400, 'fotos_invalidas', `Informe de 1 a ${params.tetoIlimitado} fotos por pessoa, ou "ilimitado".`)
      }
      participantes = p
      fotos = f as number | 'ilimitado'
      valor = calcularPreco(participantes, params, fotos)
    }

    const pacoteNome = params ? (valor === 0 ? 'teste' : 'por_participante') : (corpo.pacote ?? 'teste')
    const pacote = typeof pacoteNome === 'string' ? await servicos.pacotes.obter(pacoteNome) : null
    if (!pacote) return erro(c, 400, 'pacote_invalido', 'Pacote desconhecido.')
    if (!pacote.ativo && !params) return erro(c, 409, 'pacote_indisponivel', 'Este pacote não está disponível no momento.')
    // O marcador do preço por participante tem preço zero na tabela; quem manda é o valor calculado.
    const pago = params ? valor > 0 : !pacote.gratis
    if (pago && !cfg.pacotes_pagos_disponiveis) {
      return erro(c, 409, 'pagamento_indisponivel', 'Os pacotes pagos ainda não estão disponíveis. Use o teste grátis por enquanto.')
    }

    // No modelo novo as poses e a lotação vêm do pedido, não do pacote; a validação de nome e horários é a mesma.
    const validado = validarConfig(params ? { ...corpo, poses_por_convidado: undefined } : corpo, params ? { ...pacote, poses_max: 100 } : pacote, agora(), params ? { ...cfg, poses_validas: [cfg.poses_padrao] } : cfg)
    if (!validado.ok) return erro(c, 400, validado.erro, validado.mensagem)
    const { nome, inicio, fim, manual, revelacao } = validado.config
    const poses = params ? (fotos === 'ilimitado' ? params.tetoIlimitado : fotos) : validado.config.poses
    const limiteConvidados = params ? participantes : pacote.convidados
    const valorCentavos = params && valor > 0 ? valor : null

    const token = gerarToken()
    // Evento pago fica aguardando pagamento; o grátis já nasce pronto.
    const estado = pago ? 'aguardando_pagamento' : 'pronto'

    for (let tentativa = 0; tentativa < 5; tentativa++) {
      const codigo = gerarCodigo()
      try {
        const r = await pool.query<EventoLinha>(
          `insert into eventos (codigo, anfitriao_token_hash, nome, estado, pacote, limite_convidados, retencao_dias,
             poses_por_convidado, limite_fotos, captura_inicio, captura_fim, revelacao_em, revelacao_manual, valor_centavos)
           values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) returning ${COLUNAS}`,
          [codigo, hashToken(token), nome, estado, pacote.id, limiteConvidados, pacote.retencao_dias, poses, limiteConvidados * poses, inicio, fim, revelacao, manual, valorCentavos],
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
    await servicos.avancar()
    const r = await pool.query<EventoLinha & { convidados: string; fotos: string }>(
      `select ${COLUNAS}, (select count(*) from convidados where evento_id = eventos.id) as convidados,
              (select count(*) from fotos where evento_id = eventos.id and removida_em is null) as fotos
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
      // Total de fotos no rolo (não revela nenhuma foto): a tela de espera mostra "N fotos no rolo".
      fotos: Number(e.fotos),
      lotado: Number(e.convidados) >= e.limite_convidados,
    })
  })

  // Convidado entra: token novo, ou o mesmo se o aparelho já entrou (header X-Convidado-Token).
  app.post('/api/eventos/:codigo/entrar', async (c) => {
    await servicos.avancar()
    const corpo = (await lerCorpo(c)) ?? {}
    const apelidoMax = (await servicos.config.valores()).apelido_max
    const apelido = typeof corpo.apelido === 'string' ? corpo.apelido.trim().slice(0, apelidoMax) || null : null
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
    await servicos.avancar()
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
      return erro(c, 409, 'transicao_invalida', 'Essa mudança não é possível no estado atual do evento.', { estado: e.estado })
    }
    const agoraData = agora()
    const r = await pool.query<EventoLinha>(
      para === 'revelado'
        ? `update eventos set estado = 'revelado', revelado_em = $2::timestamptz, atualizado_em = $2::timestamptz,
             expira_em = $2::timestamptz + retencao_dias * interval '1 day'
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

  // Pacotes vindos do servidor (limites e preço não ficam no front). Só os ativos.
  app.get('/api/pacotes', async (c) => {
    const [lista, cfg] = await Promise.all([servicos.pacotes.listar(), servicos.config.valores()])
    return c.json({
      pacotes: lista
        .filter((p) => p.ativo)
        .map((p) => ({
          id: p.id,
          nome: p.nome,
          convidados: p.convidados,
          gratis: p.gratis,
          preco_centavos: p.preco_centavos,
          retencao_dias: p.retencao_dias,
          poses_max: p.poses_max,
          poses_opcoes: cfg.poses_validas.filter((n) => n <= p.poses_max),
        })),
    })
  })

  // Configuração que o front pode ver (prazos, tamanhos, poses, se o pagamento está ligado).
  app.get('/api/config', async (c) => c.json(await servicos.config.publicas()))

  const CAMPOS_CONFIG = ['nome', 'poses_por_convidado', 'captura_inicio', 'captura_fim', 'revelacao_em', 'revelacao_manual']
  const ESTADOS_EDITAVEIS = ['rascunho', 'aguardando_pagamento', 'pronto']

  // Edita o evento. Nome, poses e horários só antes de a câmera abrir; "álbum privado" a qualquer momento.
  app.patch('/api/anfitriao/evento', async (c) => {
    const e = await eventoDoAnfitriao(c)
    if (!e) return erro(c, 401, 'nao_autorizado', 'Token do anfitrião inválido.')
    const corpo = await lerCorpo(c)
    if (!corpo) return erro(c, 400, 'corpo_invalido', 'Envie um JSON válido.')

    const desconhecido = Object.keys(corpo).find((k) => ![...CAMPOS_CONFIG, 'album_privado'].includes(k))
    if (desconhecido) return erro(c, 400, 'campo_desconhecido', `O campo "${desconhecido}" não pode ser alterado.`)
    if (Object.keys(corpo).length === 0) return erro(c, 400, 'corpo_invalido', 'Nada para alterar.')
    if (corpo.album_privado !== undefined && typeof corpo.album_privado !== 'boolean') {
      return erro(c, 400, 'album_privado_invalido', 'album_privado precisa ser true ou false.')
    }

    const mexeConfig = CAMPOS_CONFIG.some((k) => corpo[k] !== undefined)
    let atualizado: EventoLinha = e
    if (mexeConfig) {
      if (!ESTADOS_EDITAVEIS.includes(e.estado)) {
        return erro(c, 409, 'evento_em_andamento', 'Depois que a câmera abre, só o álbum privado pode mudar.', { estado: e.estado })
      }
      const mudouHorario = corpo.captura_inicio !== undefined || corpo.captura_fim !== undefined
      const entrada: Record<string, unknown> = {
        nome: corpo.nome ?? e.nome,
        poses_por_convidado: corpo.poses_por_convidado ?? e.poses_por_convidado,
        captura_inicio: corpo.captura_inicio ?? e.captura_inicio?.toISOString(),
        captura_fim: corpo.captura_fim ?? e.captura_fim?.toISOString(),
        revelacao_manual: corpo.revelacao_manual ?? e.revelacao_manual,
        // Mudou o horário sem informar a revelação: volta ao padrão (fim + 12 h) em vez de manter uma data que pode ficar inválida.
        revelacao_em: corpo.revelacao_em ?? (mudouHorario ? undefined : e.revelacao_em?.toISOString()),
      }
      const pacoteDoEvento = await servicos.pacotes.obter(e.pacote)
      if (!pacoteDoEvento) return erro(c, 409, 'pacote_indisponivel', 'O pacote deste evento não existe mais.')
      const validado = validarConfig(entrada, pacoteDoEvento, agora(), await servicos.config.valores())
      if (!validado.ok) return erro(c, 400, validado.erro, validado.mensagem)
      const { nome, poses, inicio, fim, manual, revelacao } = validado.config
      const r = await pool.query<EventoLinha>(
        `update eventos set nome = $2, poses_por_convidado = $3, limite_fotos = limite_convidados * $3,
           captura_inicio = $4, captura_fim = $5, revelacao_em = $6, revelacao_manual = $7, atualizado_em = $8
         where id = $1 and estado = any($9::text[]) returning ${COLUNAS}`,
        [e.id, nome, poses, inicio, fim, revelacao, manual, agora(), ESTADOS_EDITAVEIS],
      )
      // O estado pode ter mudado entre a leitura e a escrita (o agendador abriu a câmera).
      if (!r.rows[0]) return erro(c, 409, 'evento_em_andamento', 'Depois que a câmera abre, só o álbum privado pode mudar.')
      atualizado = r.rows[0]
    }
    if (typeof corpo.album_privado === 'boolean') {
      const r = await pool.query<EventoLinha>(
        `update eventos set album_privado = $2, atualizado_em = $3 where id = $1 returning ${COLUNAS}`,
        [e.id, corpo.album_privado, agora()],
      )
      atualizado = r.rows[0]
    }
    return c.json({ evento: atualizado, album_privado: atualizado.album_privado })
  })

  // Cancela antes da primeira foto. O estorno do pagamento entra com o pagamento (#62).
  app.post('/api/anfitriao/evento/cancelar', async (c) => {
    const e = await eventoDoAnfitriao(c)
    if (!e) return erro(c, 401, 'nao_autorizado', 'Token do anfitrião inválido.')
    if (!podeTransicionar(e.estado as never, 'cancelado')) {
      return erro(c, 409, 'transicao_invalida', 'Este evento não pode mais ser cancelado.', { estado: e.estado })
    }
    const fotos = await pool.query('select 1 from fotos where evento_id = $1 limit 1', [e.id])
    if (fotos.rowCount) return erro(c, 409, 'tem_fotos', 'O evento já tem fotos e não pode mais ser cancelado.')
    const r = await pool.query<EventoLinha>(
      `update eventos set estado = 'cancelado', atualizado_em = $2 where id = $1 and estado = 'pronto' returning ${COLUNAS}`,
      [e.id, agora()],
    )
    if (!r.rows[0]) return erro(c, 409, 'transicao_invalida', 'O estado do evento mudou. Tente de novo.')
    return c.json({ evento: r.rows[0] })
  })

  return app
}
