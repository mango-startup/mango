import { Hono } from 'hono'
import type { Context, MiddlewareHandler } from 'hono'
import { deleteCookie, getCookie, setCookie } from 'hono/cookie'
import type { Pool } from 'pg'
import { ServicoAdmin } from '../admin/autenticacao.ts'
import type { Admin } from '../admin/autenticacao.ts'
import type { Servicos } from '../servicos.ts'
import type { Storage } from '../storage/storage.ts'
import { hashToken } from '../tokens.ts'
import { erro } from './util.ts'

const COOKIE = 'mango_admin'
/** Os admins só mudam estado com este header: um site de fora não consegue mandá-lo (não há CORS) e o cookie é SameSite=Strict. */
const HEADER_CSRF = 'x-mango-admin'
/** Rotas liberadas enquanto a senha ainda é a inicial/temporária. */
const LIBERADAS_COM_SENHA_TEMPORARIA = ['/api/admin/eu', '/api/admin/sair', '/api/admin/trocar-senha']

type Variaveis = { Variables: { admin: Admin; token: string } }

async function lerCorpo(c: Context): Promise<Record<string, unknown> | null> {
  try {
    const corpo = await c.req.json()
    return corpo && typeof corpo === 'object' && !Array.isArray(corpo) ? (corpo as Record<string, unknown>) : null
  } catch {
    return null
  }
}

/** Área de admin: login, troca de senha e gestão de pacotes, configurações e auditoria. Tudo sob /api/admin. */
export function rotasAdmin(pool: Pool, servicos: Servicos, agora: () => Date = () => new Date(), storage?: Storage): Hono<Variaveis> {
  const app = new Hono<Variaveis>()
  const admins = new ServicoAdmin(pool, agora)

  const seguro = (c: Context) => c.req.header('x-forwarded-proto') === 'https' || new URL(c.req.url).protocol === 'https:'

  // Nada daqui pode ser guardado em cache nem indexado.
  app.use('/api/admin/*', async (c, next) => {
    await next()
    c.res.headers.set('Cache-Control', 'no-store')
    c.res.headers.set('X-Robots-Tag', 'noindex, nofollow')
  })

  const exigirAdmin: MiddlewareHandler<Variaveis> = async (c, next) => {
    const token = getCookie(c, COOKIE)
    const admin = token ? await admins.porToken(token) : null
    if (!token || !admin) return erro(c, 401, 'nao_autorizado', 'Entre com o seu usuário e senha.')
    if (c.req.method !== 'GET' && c.req.header(HEADER_CSRF) !== '1') return erro(c, 403, 'requisicao_invalida', 'Requisição não permitida.')
    if (admin.trocar_senha && !LIBERADAS_COM_SENHA_TEMPORARIA.includes(new URL(c.req.url).pathname)) {
      return erro(c, 403, 'trocar_senha_obrigatoria', 'Troque a senha inicial antes de continuar.')
    }
    c.set('admin', admin)
    c.set('token', token)
    return next()
  }

  app.post('/api/admin/entrar', async (c) => {
    if (c.req.header(HEADER_CSRF) !== '1') return erro(c, 403, 'requisicao_invalida', 'Requisição não permitida.')
    const corpo = await lerCorpo(c)
    if (!corpo || typeof corpo.usuario !== 'string' || typeof corpo.senha !== 'string' || corpo.usuario.length > 60 || corpo.senha.length > 200) {
      return erro(c, 400, 'corpo_invalido', 'Informe usuário e senha.')
    }
    const r = await admins.entrar(corpo.usuario, corpo.senha)
    if (!r.ok) {
      if (r.erro === 'conta_bloqueada') {
        c.header('Retry-After', String(r.retryEmSegundos ?? 900))
        return erro(c, 429, 'conta_bloqueada', 'Muitas tentativas. Aguarde alguns minutos e tente de novo.', { retry_em_segundos: r.retryEmSegundos })
      }
      return erro(c, 401, 'credenciais_invalidas', 'Usuário ou senha incorretos.')
    }
    setCookie(c, COOKIE, r.token, { httpOnly: true, secure: seguro(c), sameSite: 'Strict', path: '/api/admin', expires: r.expiraEm })
    return c.json({ admin: { usuario: r.admin.usuario, nome: r.admin.nome, trocar_senha: r.admin.trocar_senha } })
  })

  app.post('/api/admin/sair', exigirAdmin, async (c) => {
    await admins.sair(c.get('token'))
    deleteCookie(c, COOKIE, { path: '/api/admin' })
    return c.body(null, 204)
  })

  app.get('/api/admin/eu', exigirAdmin, (c) => {
    const a = c.get('admin')
    return c.json({ admin: { usuario: a.usuario, nome: a.nome, trocar_senha: a.trocar_senha } })
  })

  app.post('/api/admin/trocar-senha', exigirAdmin, async (c) => {
    const corpo = await lerCorpo(c)
    if (!corpo || typeof corpo.senha_atual !== 'string' || typeof corpo.nova_senha !== 'string') {
      return erro(c, 400, 'corpo_invalido', 'Informe a senha atual e a nova.')
    }
    const r = await admins.trocarSenha(c.get('admin'), corpo.senha_atual, corpo.nova_senha, c.get('token'))
    if (!r.ok) return erro(c, 400, r.erro, r.mensagem)
    return c.json({ ok: true })
  })

  // Visão geral para o dashboard.
  app.get('/api/admin/resumo', exigirAdmin, async (c) => {
    const [estados, totais, pedidos] = await Promise.all([
      pool.query<{ estado: string; n: string }>('select estado, count(*) as n from eventos where excluido_em is null group by estado'),
      pool.query<{ eventos_7d: string; convidados: string; fotos: string; fotos_24h: string; armazenamento_bytes: string }>(
        `select (select count(*) from eventos where excluido_em is null and criado_em > $1::timestamptz - interval '7 days') as eventos_7d,
                (select count(*) from convidados v join eventos e on e.id = v.evento_id where e.excluido_em is null) as convidados,
                (select count(*) from fotos f join eventos e on e.id = f.evento_id where e.excluido_em is null and f.removida_em is null) as fotos,
                (select count(*) from fotos f join eventos e on e.id = f.evento_id where e.excluido_em is null and f.removida_em is null and f.criado_em > $1::timestamptz - interval '24 hours') as fotos_24h,
                (select coalesce(sum(tamanho_bytes), 0) from fotos where arquivo_apagado_em is null) as armazenamento_bytes`,
        [agora()],
      ),
      pool.query<{ n: string }>('select count(*) as n from pedidos_remocao where resolvido_em is null'),
    ])
    const t = totais.rows[0]
    return c.json({
      eventos_por_estado: Object.fromEntries(estados.rows.map((e) => [e.estado, Number(e.n)])),
      eventos_ultimos_7_dias: Number(t.eventos_7d),
      convidados: Number(t.convidados),
      fotos: Number(t.fotos),
      fotos_ultimas_24_horas: Number(t.fotos_24h),
      armazenamento_bytes: Number(t.armazenamento_bytes),
      pedidos_de_remocao_pendentes: Number(pedidos.rows[0].n),
    })
  })

  const paginar = (c: Context) => {
    const limite = Math.min(100, Math.max(1, Number(c.req.query('limite') ?? 25) || 25))
    const pagina = Math.max(1, Number(c.req.query('pagina') ?? 1) || 1)
    return { limite, pagina, deslocamento: (pagina - 1) * limite }
  }

  /** CSV seguro para planilha: aspas dobradas e células que começam com = + - @ ganham um apóstrofo (injeção de fórmula). */
  const csv = (c: Context, nome: string, colunas: string[], linhas: Record<string, unknown>[]) => {
    const celula = (v: unknown) => {
      let s = v instanceof Date ? v.toISOString() : v === null || v === undefined ? '' : String(v)
      if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`
      return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
    }
    const corpo = [colunas.join(','), ...linhas.map((l) => colunas.map((k) => celula(l[k])).join(','))].join('\r\n')
    c.header('Content-Type', 'text/csv; charset=utf-8')
    c.header('Content-Disposition', `attachment; filename="${nome}.csv"`)
    return c.body('\ufeff' + corpo + '\r\n')
  }
  const LIMITE_CSV = 10000

  // --- Eventos: lista com filtros (estado, pacote, busca por nome/e-mail do anfitrião) e contagens.
  const DATA = /^\d{4}-\d{2}-\d{2}$/
  const ORDEM_EVENTOS: Record<string, string> = {
    recentes: 'e.criado_em desc, e.id desc',
    antigos: 'e.criado_em asc, e.id asc',
    fotos: 'fotos desc, e.criado_em desc',
    convidados: 'convidados desc, e.criado_em desc',
    armazenamento: 'armazenamento_bytes desc, e.criado_em desc',
    camera: 'e.captura_inicio asc nulls last, e.criado_em desc',
  }

  app.get('/api/admin/eventos', exigirAdmin, async (c) => {
    const exportar = c.req.query('formato') === 'csv'
    const { limite, pagina, deslocamento } = exportar ? { limite: LIMITE_CSV, pagina: 1, deslocamento: 0 } : paginar(c)
    const estado = c.req.query('estado')
    const pacote = c.req.query('pacote')
    const busca = (c.req.query('busca') ?? '').trim().slice(0, 100)
    const de = c.req.query('de')
    const ate = c.req.query('ate')
    if ((de && !DATA.test(de)) || (ate && !DATA.test(ate))) return erro(c, 400, 'periodo_invalido', 'Use datas no formato AAAA-MM-DD.')
    const ordem = ORDEM_EVENTOS[c.req.query('ordem') ?? ''] ?? ORDEM_EVENTOS.recentes
    const r = await pool.query(
      `select e.id::text, e.codigo, e.nome, e.anfitriao_email, e.estado, e.pacote, e.limite_convidados, e.criado_em, e.captura_inicio, e.captura_fim,
              (select count(*) from convidados where evento_id = e.id)::int as convidados,
              (select count(*) from fotos where evento_id = e.id and removida_em is null)::int as fotos,
              (select coalesce(sum(tamanho_bytes), 0) from fotos where evento_id = e.id and arquivo_apagado_em is null)::bigint::float8 as armazenamento_bytes,
              count(*) over () as total
         from eventos e
        where e.excluido_em is null
          and ($1::text is null or e.estado = $1)
          and ($2::text is null or e.pacote = $2)
          and ($3 = '' or e.nome ilike '%' || $3 || '%' or e.anfitriao_email ilike '%' || $3 || '%')
          and ($6::date is null or (e.criado_em at time zone 'America/Sao_Paulo')::date >= $6::date)
          and ($7::date is null or (e.criado_em at time zone 'America/Sao_Paulo')::date <= $7::date)
        order by ${ordem} limit $4 offset $5`,
      [estado || null, pacote || null, busca.replace(/[\\%_]/g, '\\$&'), limite, deslocamento, de || null, ate || null],
    )
    const eventos = r.rows.map(({ total: _t, ...linha }) => linha)
    if (exportar) return csv(c, 'eventos', ['id', 'codigo', 'nome', 'anfitriao_email', 'estado', 'pacote', 'limite_convidados', 'convidados', 'fotos', 'armazenamento_bytes', 'captura_inicio', 'captura_fim', 'criado_em'], eventos)
    return c.json({ pagina, limite, total: r.rows[0] ? Number(r.rows[0].total) : 0, eventos })
  })

  // Detalhe de um evento: tudo o que o admin precisa para entender (e atender) aquele evento.
  app.get('/api/admin/eventos/:id', exigirAdmin, async (c) => {
    const id = c.req.param('id')
    if (!/^[0-9a-f-]{36}$/i.test(id)) return erro(c, 400, 'id_invalido', 'Id inválido.')
    const ev = await pool.query(
      `select e.id::text, e.codigo, e.nome, e.anfitriao_email, e.estado, e.pacote, p.nome as pacote_nome, e.limite_convidados, e.poses_por_convidado, e.limite_fotos,
              e.captura_inicio, e.captura_fim, e.revelacao_em, e.revelado_em, e.expira_em, e.album_privado, e.criado_em, e.excluido_em
         from eventos e left join pacotes p on p.id = e.pacote where e.id = $1`,
      [id],
    )
    if (!ev.rows[0]) return erro(c, 404, 'nao_encontrado', 'Evento não encontrado.')
    const [convidados, fotos, pagamentos, pedidos] = await Promise.all([
      pool.query(
        `select v.id::text, v.apelido, v.criado_em, (select count(*) from fotos f where f.convidado_id = v.id and f.removida_em is null)::int as fotos
           from convidados v where v.evento_id = $1 order by v.criado_em limit 300`,
        [id],
      ),
      pool.query<{ total: number; removidas: number; bytes: string; primeira: Date | null; ultima: Date | null }>(
        `select count(*) filter (where removida_em is null)::int as total, count(*) filter (where removida_em is not null)::int as removidas,
                coalesce(sum(tamanho_bytes) filter (where arquivo_apagado_em is null), 0) as bytes, min(criado_em) as primeira, max(criado_em) as ultima
           from fotos where evento_id = $1`,
        [id],
      ),
      pool.query('select id::text, valor_centavos, status, criado_em from pagamentos where evento_id = $1 order by criado_em desc', [id]),
      pool.query('select id::text, foto_id::text, motivo, resolucao, resolvido_em, criado_em from pedidos_remocao where evento_id = $1 order by criado_em desc', [id]),
    ])
    const f = fotos.rows[0]
    return c.json({
      evento: ev.rows[0],
      fotos: { total: f.total, removidas: f.removidas, armazenamento_bytes: Number(f.bytes), primeira_em: f.primeira, ultima_em: f.ultima },
      convidados: convidados.rows,
      pagamentos: pagamentos.rows,
      pedidos_de_remocao: pedidos.rows,
    })
  })

  // --- Pagamentos: totais por status e lista paginada (mais recentes primeiro).
  app.get('/api/admin/pagamentos', exigirAdmin, async (c) => {
    const exportar = c.req.query('formato') === 'csv'
    const { limite, pagina, deslocamento } = exportar ? { limite: LIMITE_CSV, pagina: 1, deslocamento: 0 } : paginar(c)
    const status = c.req.query('status')
    const de = c.req.query('de')
    const ate = c.req.query('ate')
    if ((de && !DATA.test(de)) || (ate && !DATA.test(ate))) return erro(c, 400, 'periodo_invalido', 'Use datas no formato AAAA-MM-DD.')
    const periodo = (col: string, a = 4, b = 5) => `($${a}::date is null or (${col} at time zone 'America/Sao_Paulo')::date >= $${a}::date) and ($${b}::date is null or (${col} at time zone 'America/Sao_Paulo')::date <= $${b}::date)`
    const [totais, lista] = await Promise.all([
      pool.query<{ status: string; n: string; soma: string }>(`select status, count(*) as n, coalesce(sum(valor_centavos), 0) as soma from pagamentos p where ${periodo('p.criado_em', 1, 2)} group by status`, [de || null, ate || null]),
      pool.query(
        `select p.id::text, p.evento_id::text, e.nome as evento_nome, e.pacote, p.valor_centavos, p.status, p.criado_em, count(*) over () as total
           from pagamentos p join eventos e on e.id = p.evento_id
          where ($1::text is null or p.status = $1) and ${periodo('p.criado_em')}
          order by p.criado_em desc, p.id desc limit $2 offset $3`,
        [status || null, limite, deslocamento, de || null, ate || null],
      ),
    ])
    if (exportar) {
      return csv(c, 'pagamentos', ['id', 'evento_id', 'evento_nome', 'pacote', 'valor_centavos', 'status', 'criado_em'], lista.rows)
    }
    const por_status = Object.fromEntries(totais.rows.map((t) => [t.status, { pagamentos: Number(t.n), valor_centavos: Number(t.soma) }]))
    return c.json({
      pagina,
      limite,
      total: lista.rows[0] ? Number(lista.rows[0].total) : 0,
      receita_centavos: por_status.aprovado?.valor_centavos ?? 0,
      por_status,
      pagamentos: lista.rows.map(({ total: _t, ...linha }) => linha),
    })
  })

  // --- Crescimento: série diária dos últimos N dias (eventos, convidados, fotos), com os dias sem nada zerados.
  app.get('/api/admin/crescimento', exigirAdmin, async (c) => {
    const dias = Math.min(365, Math.max(1, Number(c.req.query('dias') ?? 30) || 30))
    const r = await pool.query<{ dia: string; eventos: number; convidados: number; fotos: number; receita_centavos: number }>(
      `with dias as (select generate_series(($1::timestamptz at time zone 'America/Sao_Paulo')::date - ($2::int - 1), ($1::timestamptz at time zone 'America/Sao_Paulo')::date, interval '1 day')::date as dia)
       select to_char(d.dia, 'YYYY-MM-DD') as dia,
              (select count(*) from eventos e where e.excluido_em is null and (e.criado_em at time zone 'America/Sao_Paulo')::date = d.dia)::int as eventos,
              (select count(*) from convidados v join eventos e on e.id = v.evento_id where e.excluido_em is null and (v.criado_em at time zone 'America/Sao_Paulo')::date = d.dia)::int as convidados,
              (select count(*) from fotos f join eventos e on e.id = f.evento_id where e.excluido_em is null and f.removida_em is null and (f.criado_em at time zone 'America/Sao_Paulo')::date = d.dia)::int as fotos,
              (select coalesce(sum(p.valor_centavos), 0) from pagamentos p where p.status = 'aprovado' and (p.atualizado_em at time zone 'America/Sao_Paulo')::date = d.dia)::int as receita_centavos
         from dias d order by d.dia`,
      [agora(), dias],
    )
    const soma = (k: 'eventos' | 'convidados' | 'fotos' | 'receita_centavos') => r.rows.reduce((a, l) => a + l[k], 0)
    return c.json({ dias, totais: { eventos: soma('eventos'), convidados: soma('convidados'), fotos: soma('fotos'), receita_centavos: soma('receita_centavos') }, serie: r.rows })
  })

  // --- Moderação: pedidos de remoção pendentes (mais antigos primeiro) e o que já foi resolvido.
  app.get('/api/admin/moderacao', exigirAdmin, async (c) => {
    const [pendentes, resolvidos] = await Promise.all([
      pool.query(
        `select p.id::text, p.evento_id::text, e.nome as evento_nome, e.anfitriao_email, p.foto_id::text, p.motivo, p.criado_em
           from pedidos_remocao p join eventos e on e.id = p.evento_id
          where p.resolvido_em is null order by p.criado_em asc limit 100`,
      ),
      pool.query<{ resolucao: string; n: string }>('select resolucao, count(*) as n from pedidos_remocao where resolvido_em is not null group by resolucao'),
    ])
    const por = Object.fromEntries(resolvidos.rows.map((l) => [l.resolucao, Number(l.n)]))
    return c.json({ pendentes: pendentes.rows, resolvidos: { removida: por.removida ?? 0, mantida: por.mantida ?? 0 } })
  })

  // --- Ao vivo: eventos com a câmera aberta agora e o ritmo de fotos na última hora.
  app.get('/api/admin/ao-vivo', exigirAdmin, async (c) => {
    const r = await pool.query(
      `select e.id::text, e.nome, e.anfitriao_email, e.captura_fim, e.limite_convidados,
              (select count(*) from convidados v where v.evento_id = e.id)::int as convidados,
              (select count(*) from fotos f where f.evento_id = e.id and f.removida_em is null)::int as fotos,
              (select count(*) from fotos f where f.evento_id = e.id and f.criado_em > $1::timestamptz - interval '1 hour')::int as fotos_ultima_hora
         from eventos e where e.estado = 'captura_aberta' and e.excluido_em is null
        order by fotos_ultima_hora desc, e.captura_fim asc limit 50`,
      [agora()],
    )
    return c.json({ eventos: r.rows })
  })

  // --- Retenção: quantos anfitriões voltam para um segundo evento e em quanto tempo.
  app.get('/api/admin/retencao', exigirAdmin, async (c) => {
    const r = await pool.query<{ anfitrioes: string; recorrentes: string; dias_medios: string | null }>(
      `with por as (
         select anfitriao_email, count(*) as n, min(criado_em) as primeiro, max(criado_em) as ultimo
           from eventos where excluido_em is null and anfitriao_email is not null group by anfitriao_email)
       select count(*) as anfitrioes, count(*) filter (where n >= 2) as recorrentes,
              avg(extract(epoch from (ultimo - primeiro)) / 86400 / nullif(n - 1, 0)) filter (where n >= 2) as dias_medios
         from por`,
    )
    const l = r.rows[0]
    const total = Number(l.anfitrioes)
    const recorrentes = Number(l.recorrentes)
    return c.json({
      anfitrioes: total,
      recorrentes,
      taxa_recorrencia: total > 0 ? recorrentes / total : null,
      dias_medios_entre_eventos: l.dias_medios === null ? null : Number(Number(l.dias_medios).toFixed(1)),
    })
  })

  // --- Armazenamento: bytes por semana (12 semanas), média por evento e ritmo recente.
  app.get('/api/admin/armazenamento', exigirAdmin, async (c) => {
    const [semanas, totais] = await Promise.all([
      pool.query<{ semana: string; bytes: string; fotos: string }>(
        `with semanas as (
           select generate_series(date_trunc('week', $1::timestamptz at time zone 'America/Sao_Paulo') - interval '11 weeks', date_trunc('week', $1::timestamptz at time zone 'America/Sao_Paulo'), interval '1 week') as inicio)
         select to_char(s.inicio, 'YYYY-MM-DD') as semana,
                coalesce(sum(f.tamanho_bytes), 0) as bytes, count(f.id) as fotos
           from semanas s
           left join fotos f on date_trunc('week', f.criado_em at time zone 'America/Sao_Paulo') = s.inicio and f.removida_em is null
           group by s.inicio order by s.inicio`,
        [agora()],
      ),
      pool.query<{ bytes: string; eventos: string }>(
        `select coalesce(sum(tamanho_bytes), 0) as bytes,
                (select count(*) from eventos e where e.excluido_em is null and exists (select 1 from fotos f where f.evento_id = e.id)) as eventos
           from fotos where arquivo_apagado_em is null`,
      ),
    ])
    const bytes = Number(totais.rows[0].bytes)
    const eventosComFoto = Number(totais.rows[0].eventos)
    const recentes = semanas.rows.slice(-4)
    return c.json({
      total_bytes: bytes,
      bytes_por_evento: eventosComFoto > 0 ? Math.round(bytes / eventosComFoto) : 0,
      // A série já traz as 12 semanas, inclusive as vazias.
      bytes_por_semana_recente: Math.round(recentes.reduce((a, l) => a + Number(l.bytes), 0) / 4),
      semanas: semanas.rows.map((l) => ({ semana: l.semana, bytes: Number(l.bytes), fotos: Number(l.fotos) })),
    })
  })

  // --- Estender a câmera de um evento que ainda não foi revelado (até 24 horas por vez).
  app.post('/api/admin/eventos/:id/estender-camera', exigirAdmin, async (c) => {
    const id = c.req.param('id')
    if (!/^[0-9a-f-]{36}$/i.test(id)) return erro(c, 400, 'id_invalido', 'Id inválido.')
    const corpo = await lerCorpo(c)
    const minutos = corpo ? Number(corpo.minutos) : NaN
    if (!Number.isInteger(minutos) || minutos < 1 || minutos > 1440) return erro(c, 400, 'validacao', 'Informe de 1 a 1440 minutos.', { erros: { minutos: 'Informe de 1 a 1440 minutos.' } })
    const ev = await pool.query<{ estado: string; captura_fim: Date | null; revelacao_em: Date | null }>('select estado, captura_fim, revelacao_em from eventos where id = $1 and excluido_em is null', [id])
    const e = ev.rows[0]
    if (!e) return erro(c, 404, 'nao_encontrado', 'Evento não encontrado.')
    if (!['pronto', 'captura_aberta'].includes(e.estado) || !e.captura_fim) return erro(c, 409, 'estado_invalido', 'Só dá para estender a câmera de um evento pronto ou com a câmera aberta.')
    const novoFim = new Date(Math.max(e.captura_fim.getTime(), agora().getTime()) + minutos * 60_000)
    const novaRevelacao = e.revelacao_em && e.revelacao_em < novoFim ? novoFim : e.revelacao_em
    await pool.query('update eventos set captura_fim = $2, revelacao_em = $3, atualizado_em = $4 where id = $1', [id, novoFim, novaRevelacao, agora()])
    const a = c.get('admin')
    await pool.query(`insert into auditoria_admin (admin_id, usuario, acao, alvo, antes, depois, criado_em) values ($1,$2,'evento.estender_camera',$3,$4::jsonb,$5::jsonb,$6)`, [
      a.id, a.usuario, id, JSON.stringify({ captura_fim: e.captura_fim }), JSON.stringify({ captura_fim: novoFim, minutos }), agora(),
    ])
    return c.json({ captura_fim: novoFim, revelacao_em: novaRevelacao })
  })

  // --- Moderação em lote: resolve vários pedidos de remoção de uma vez (remover a foto ou manter).
  app.post('/api/admin/moderacao/resolver', exigirAdmin, async (c) => {
    const corpo = await lerCorpo(c)
    const ids = corpo && Array.isArray(corpo.ids) ? corpo.ids.filter((x): x is string => typeof x === 'string' && /^[0-9a-f-]{36}$/i.test(x)) : []
    const resolucao = corpo?.resolucao
    if (ids.length === 0 || ids.length > 100 || (resolucao !== 'removida' && resolucao !== 'mantida')) {
      return erro(c, 400, 'validacao', 'Envie de 1 a 100 pedidos e a resolução (removida ou mantida).')
    }
    const cliente = await pool.connect()
    try {
      await cliente.query('begin')
      const pedidos = await cliente.query<{ id: string; foto_id: string }>(
        `update pedidos_remocao set resolucao = $2, resolvido_em = $3 where id = any($1::uuid[]) and resolvido_em is null returning id::text, foto_id::text`,
        [ids, resolucao, agora()],
      )
      if (resolucao === 'removida' && pedidos.rows.length > 0) {
        const fotos = pedidos.rows.map((p) => p.foto_id)
        await cliente.query('update fotos set removida_em = $2 where id = any($1::uuid[]) and removida_em is null', [fotos, agora()])
        // Outros pedidos da mesma foto ficam resolvidos junto.
        await cliente.query(`update pedidos_remocao set resolucao = 'removida', resolvido_em = $2 where foto_id = any($1::uuid[]) and resolvido_em is null`, [fotos, agora()])
      }
      const a = c.get('admin')
      await cliente.query(`insert into auditoria_admin (admin_id, usuario, acao, alvo, depois, criado_em) values ($1,$2,'moderacao.resolver_lote',null,$3::jsonb,$4)`, [
        a.id, a.usuario, JSON.stringify({ resolucao, pedidos: pedidos.rows.map((p) => p.id) }), agora(),
      ])
      await cliente.query('commit')
      return c.json({ resolvidos: pedidos.rows.length })
    } catch (e) {
      await cliente.query('rollback')
      throw e
    } finally {
      cliente.release()
    }
  })

  const UUID_OK = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

  const auditar = (c: Context<Variaveis>, acao: string, alvo: string, depois?: unknown) => {
    const a = c.get('admin')
    return pool.query(`insert into auditoria_admin (admin_id, usuario, acao, alvo, depois, criado_em) values ($1,$2,$3,$4,$5::jsonb,$6)`, [a.id, a.usuario, acao, alvo, depois === undefined ? null : JSON.stringify(depois), agora()])
  }

  // --- Ver como o anfitrião (só leitura): o que ele vê no painel do evento. Não usa nem revela o token do anfitrião.
  app.get('/api/admin/eventos/:id/como-anfitriao', exigirAdmin, async (c) => {
    const id = c.req.param('id')
    if (!UUID_OK.test(id)) return erro(c, 400, 'id_invalido', 'Id inválido.')
    await servicos.avancar()
    const ev = await pool.query(
      `select id::text, codigo, nome, estado, anfitriao_email, album_privado, captura_inicio, captura_fim, revelacao_em, revelado_em, expira_em, poses_por_convidado, limite_convidados,
              (select count(*) from convidados v where v.evento_id = e.id)::int as convidados,
              (select count(*) from fotos f where f.evento_id = e.id and f.removida_em is null)::int as fotos
         from eventos e where id = $1 and excluido_em is null`,
      [id],
    )
    if (!ev.rows[0]) return erro(c, 404, 'nao_encontrado', 'Evento não encontrado.')
    const pedidos = await pool.query(
      `select p.id::text, t.numero::int as numero, p.motivo, p.criado_em
         from pedidos_remocao p
         left join (select id, row_number() over (order by coalesce(tirada_em, criado_em), id) as numero from fotos where evento_id = $1 and removida_em is null) t on t.id = p.foto_id
        where p.evento_id = $1 and p.resolvido_em is null order by p.criado_em`,
      [id],
    )
    await auditar(c, 'evento.ver_como_anfitriao', id)
    return c.json({ evento: ev.rows[0], pedidos_de_remocao: pedidos.rows })
  })

  app.get('/api/admin/eventos/:id/album', exigirAdmin, async (c) => {
    const id = c.req.param('id')
    if (!UUID_OK.test(id)) return erro(c, 400, 'id_invalido', 'Id inválido.')
    const { limite, pagina, deslocamento } = paginar(c)
    const r = await pool.query(
      `with todas as (
         select f.id, c.apelido, f.tirada_em, f.miniatura_chave is not null as tem_miniatura,
                row_number() over (order by coalesce(f.tirada_em, f.criado_em), f.id) as numero
           from fotos f join convidados c on c.id = f.convidado_id where f.evento_id = $1 and f.removida_em is null)
       select id::text, numero::int, apelido, tirada_em, tem_miniatura, count(*) over () as total from todas order by numero limit $2 offset $3`,
      [id, limite, deslocamento],
    )
    return c.json({ pagina, limite, total: r.rows[0] ? Number(r.rows[0].total) : 0, fotos: r.rows.map(({ total: _t, ...f }) => f) })
  })

  app.get('/api/admin/eventos/:id/fotos/:fotoId/miniatura', exigirAdmin, async (c) => {
    const id = c.req.param('id')
    const fotoId = c.req.param('fotoId').toLowerCase()
    if (!UUID_OK.test(id) || !UUID_OK.test(fotoId)) return erro(c, 400, 'id_invalido', 'Id inválido.')
    if (!storage) return erro(c, 404, 'nao_encontrada', 'Arquivo da foto não encontrado.')
    const r = await pool.query<{ chave_storage: string; miniatura_chave: string | null }>('select chave_storage, miniatura_chave from fotos where id = $1 and evento_id = $2 and removida_em is null', [fotoId, id])
    const foto = r.rows[0]
    if (!foto) return erro(c, 404, 'nao_encontrada', 'Foto não encontrada.')
    const dados = await storage.ler(foto.miniatura_chave ?? foto.chave_storage)
    if (!dados) return erro(c, 404, 'nao_encontrada', 'Arquivo da foto não encontrado.')
    return new Response(dados as BodyInit, { status: 200, headers: { 'content-type': 'image/jpeg', 'content-length': String(dados.length), 'x-content-type-options': 'nosniff' } })
  })

  // --- E-mail ao anfitrião de um evento, com histórico. Sem RESEND_API_KEY no servidor, avisa em vez de fingir que enviou.
  app.get('/api/admin/eventos/:id/emails', exigirAdmin, async (c) => {
    const id = c.req.param('id')
    if (!UUID_OK.test(id)) return erro(c, 400, 'id_invalido', 'Id inválido.')
    const r = await pool.query('select id::text, usuario, destinatario, assunto, corpo, status, erro, criado_em from emails_admin where evento_id = $1 order by criado_em desc limit 50', [id])
    return c.json({ configurado: !!servicos.email, emails: r.rows })
  })

  app.post('/api/admin/eventos/:id/emails', exigirAdmin, async (c) => {
    const id = c.req.param('id')
    if (!UUID_OK.test(id)) return erro(c, 400, 'id_invalido', 'Id inválido.')
    if (!servicos.email) return erro(c, 503, 'email_nao_configurado', 'O envio de e-mail ainda não está configurado no servidor (RESEND_API_KEY).')
    const corpo = await lerCorpo(c)
    const assunto = typeof corpo?.assunto === 'string' ? corpo.assunto.trim() : ''
    const texto = typeof corpo?.texto === 'string' ? corpo.texto.trim() : ''
    const erros: Record<string, string> = {}
    if (assunto.length < 3 || assunto.length > 150) erros.assunto = 'Use de 3 a 150 caracteres.'
    if (texto.length < 3 || texto.length > 5000) erros.texto = 'Use de 3 a 5000 caracteres.'
    if (Object.keys(erros).length) return erro(c, 400, 'validacao', 'Confira os campos.', { erros })
    const ev = await pool.query<{ anfitriao_email: string | null }>('select anfitriao_email from eventos where id = $1 and excluido_em is null', [id])
    if (!ev.rows[0]) return erro(c, 404, 'nao_encontrado', 'Evento não encontrado.')
    const para = ev.rows[0].anfitriao_email
    if (!para) return erro(c, 409, 'sem_email', 'Este evento não tem e-mail de anfitrião cadastrado.')
    const r = await servicos.email.enviar({ para, assunto, texto })
    const a = c.get('admin')
    await pool.query(`insert into emails_admin (evento_id, admin_id, usuario, destinatario, assunto, corpo, status, erro, criado_em) values ($1,$2,$3,$4,$5,$6,$7,$8,$9)`, [
      id, a.id, a.usuario, para, assunto, texto, r.ok ? 'enviado' : 'falhou', r.ok ? null : r.erro, agora(),
    ])
    await auditar(c, 'evento.enviar_email', id, { destinatario: para, assunto, status: r.ok ? 'enviado' : 'falhou' })
    if (!r.ok) return erro(c, 503, 'email_falhou', 'O provedor de e-mail recusou o envio. Tente de novo em instantes.')
    return c.json({ ok: true, destinatario: para }, 201)
  })

  // --- Agenda: o que acontece hoje e nos próximos 7 dias, e o que está parado e pede atenção.
  app.get('/api/admin/agenda', exigirAdmin, async (c) => {
    await servicos.avancar()
    const [agenda, parados] = await Promise.all([
      pool.query(
        `select * from (
           select e.id::text, e.nome, e.anfitriao_email, e.estado, e.pacote, 'abre' as tipo, e.captura_inicio as quando from eventos e where e.estado = 'pronto' and e.captura_inicio is not null
           union all
           select e.id::text, e.nome, e.anfitriao_email, e.estado, e.pacote, 'fecha', e.captura_fim from eventos e where e.estado in ('pronto', 'captura_aberta') and e.captura_fim is not null
           union all
           select e.id::text, e.nome, e.anfitriao_email, e.estado, e.pacote, 'revela', e.revelacao_em from eventos e where e.estado in ('pronto', 'captura_aberta', 'captura_encerrada') and e.revelacao_manual = false and e.revelacao_em is not null
         ) x
         join eventos ev on ev.id::text = x.id and ev.excluido_em is null
        where x.quando >= $1::timestamptz - interval '12 hours' and x.quando < $1::timestamptz + interval '7 days'
        order by x.quando asc limit 100`,
        [agora()],
      ),
      pool.query(
        `select e.id::text, e.nome, e.anfitriao_email, e.estado, e.criado_em,
                case when e.estado = 'aguardando_pagamento' then 'aguardando_pagamento' else 'sem_convidados' end as motivo
           from eventos e
          where e.excluido_em is null and (
                  (e.estado = 'aguardando_pagamento' and e.criado_em < $1::timestamptz - interval '1 day')
               or (e.estado = 'pronto' and e.captura_inicio < $1::timestamptz + interval '24 hours' and not exists (select 1 from convidados v where v.evento_id = e.id)))
          order by e.criado_em asc limit 50`,
        [agora()],
      ),
    ])
    return c.json({ proximos: agenda.rows.map(({ id, nome, anfitriao_email, estado, pacote, tipo, quando }) => ({ id, nome, anfitriao_email, estado, pacote, tipo, quando })), parados: parados.rows })
  })

  // --- Financeiro: receita bruta e líquida (estimada pela taxa configurada), funil de venda e quebra por pacote.
  app.get('/api/admin/financeiro', exigirAdmin, async (c) => {
    const dias = Math.min(365, Math.max(1, Number(c.req.query('dias') ?? 30) || 30))
    const cfg = await servicos.config.valores()
    const [periodos, pacotes, mes] = await Promise.all([
      pool.query<{ janela: string; aprovados: string; bruta: string }>(
        `select case when p.atualizado_em > $1::timestamptz - make_interval(days => $2) then 'atual' else 'anterior' end as janela,
                count(*) as aprovados, coalesce(sum(p.valor_centavos), 0) as bruta
           from pagamentos p
          where p.status = 'aprovado' and p.atualizado_em > $1::timestamptz - make_interval(days => $2 * 2)
          group by 1`,
        [agora(), dias],
      ),
      pool.query(
        `select pc.id, pc.nome, pc.preco_centavos,
                count(distinct e.id) filter (where e.criado_em > $1::timestamptz - make_interval(days => $2)) as eventos,
                count(distinct pg.evento_id) filter (where pg.criado_em > $1::timestamptz - make_interval(days => $2)) as checkouts,
                count(pg.id) filter (where pg.status = 'aprovado' and pg.atualizado_em > $1::timestamptz - make_interval(days => $2)) as pagos,
                count(pg.id) filter (where pg.status in ('pendente', 'expirado', 'recusado') and pg.criado_em > $1::timestamptz - make_interval(days => $2)) as abandonados,
                coalesce(sum(pg.valor_centavos) filter (where pg.status = 'aprovado' and pg.atualizado_em > $1::timestamptz - make_interval(days => $2)), 0) as bruta,
                count(distinct e.id) filter (where e.criado_em > $1::timestamptz - make_interval(days => $2) and exists (select 1 from fotos f where f.evento_id = e.id and f.removida_em is null)) as com_fotos,
                count(distinct e.id) filter (where e.criado_em > $1::timestamptz - make_interval(days => $2) and e.revelado_em is not null) as revelados
           from pacotes pc
           left join eventos e on e.pacote = pc.id and e.excluido_em is null
           left join pagamentos pg on pg.evento_id = e.id
          group by pc.id, pc.nome, pc.preco_centavos, pc.ordem order by pc.ordem, pc.id`,
        [agora(), dias],
      ),
      pool.query<{ bruta: string }>(
        `select coalesce(sum(valor_centavos), 0) as bruta from pagamentos
          where status = 'aprovado' and (atualizado_em at time zone 'America/Sao_Paulo') >= date_trunc('month', $1::timestamptz at time zone 'America/Sao_Paulo')`,
        [agora()],
      ),
    ])
    const taxa = (valor: number, n: number) => Math.round(valor * (cfg.taxa_stripe_percentual / 100) + n * cfg.taxa_stripe_fixa_centavos)
    const por = (j: string) => periodos.rows.find((l) => l.janela === j)
    const resumo = (j: string) => {
      const aprovados = Number(por(j)?.aprovados ?? 0)
      const bruta = Number(por(j)?.bruta ?? 0)
      const taxas = taxa(bruta, aprovados)
      return { pagamentos: aprovados, bruta_centavos: bruta, taxas_centavos: taxas, liquida_centavos: bruta - taxas, ticket_medio_centavos: aprovados > 0 ? Math.round(bruta / aprovados) : 0 }
    }
    const metaMes = cfg.meta_receita_mensal_centavos
    const brutaMes = Number(mes.rows[0].bruta)
    return c.json({
      dias,
      atual: resumo('atual'),
      anterior: resumo('anterior'),
      mes: { bruta_centavos: brutaMes, meta_centavos: metaMes > 0 ? metaMes : null },
      taxa: { percentual: cfg.taxa_stripe_percentual, fixa_centavos: cfg.taxa_stripe_fixa_centavos },
      pacotes: pacotes.rows.map((l) => {
        const pagos = Number(l.pagos)
        const bruta = Number(l.bruta)
        const checkouts = Number(l.checkouts)
        return {
          id: l.id, nome: l.nome, preco_centavos: Number(l.preco_centavos),
          eventos: Number(l.eventos), checkouts, pagos, abandonados: Number(l.abandonados),
          conversao: checkouts > 0 ? pagos / checkouts : null,
          com_fotos: Number(l.com_fotos), revelados: Number(l.revelados),
          bruta_centavos: bruta, liquida_centavos: bruta - taxa(bruta, pagos),
        }
      }),
    })
  })

  // --- Anfitriões: um por e-mail, com eventos, fotos e quanto já pagou.
  app.get('/api/admin/anfitrioes', exigirAdmin, async (c) => {
    const { limite, pagina, deslocamento } = paginar(c)
    const busca = (c.req.query('busca') ?? '').trim().slice(0, 100)
    const r = await pool.query(
      `select e.anfitriao_email,
              count(*)::int as eventos,
              coalesce(sum((select count(*) from fotos f where f.evento_id = e.id and f.removida_em is null)), 0)::int as fotos,
              coalesce(sum((select coalesce(sum(p.valor_centavos), 0) from pagamentos p where p.evento_id = e.id and p.status = 'aprovado')), 0)::int as pago_centavos,
              min(e.criado_em) as primeiro_evento_em, max(e.criado_em) as ultimo_evento_em,
              count(*) over () as total
         from eventos e
        where e.excluido_em is null and ($1 = '' or e.anfitriao_email ilike '%' || $1 || '%')
        group by e.anfitriao_email order by max(e.criado_em) desc, e.anfitriao_email limit $2 offset $3`,
      [busca.replace(/[\\%_]/g, '\\$&'), limite, deslocamento],
    )
    return c.json({ pagina, limite, total: r.rows[0] ? Number(r.rows[0].total) : 0, anfitrioes: r.rows.map(({ total: _t, ...linha }) => linha) })
  })

  // --- Saúde: banco, fila de limpeza de arquivos, pagamentos e webhook.
  app.get('/api/admin/saude', exigirAdmin, async (c) => {
    const inicio = Date.now()
    const r = await pool.query<{ limpeza: string; limpeza_antiga: string; orfaos: string; ultimo_webhook: Date | null; pendentes_antigos: string }>(
      `select (select count(*) from fotos where removida_em is not null and arquivo_apagado_em is null) as limpeza,
              (select count(*) from fotos where removida_em < $1::timestamptz - interval '2 days' and arquivo_apagado_em is null) as limpeza_antiga,
              (select count(*) from pagamentos where status = 'aprovado_orfao') as orfaos,
              (select max(recebido_em) from stripe_eventos) as ultimo_webhook,
              (select count(*) from pedidos_remocao where resolvido_em is null and criado_em < $1::timestamptz - interval '2 days') as pendentes_antigos`,
      [agora()],
    )
    const l = r.rows[0]
    return c.json({
      banco: { ok: true, latencia_ms: Date.now() - inicio },
      fotos_aguardando_limpeza: Number(l.limpeza),
      fotos_aguardando_limpeza_ha_mais_de_2_dias: Number(l.limpeza_antiga),
      pagamentos_aprovados_sem_evento: Number(l.orfaos),
      ultimo_webhook_do_stripe_em: l.ultimo_webhook,
      pedidos_de_remocao_pendentes_ha_mais_de_2_dias: Number(l.pendentes_antigos),
      email_configurado: !!servicos.email,
    })
  })

  // --- Análise: o período escolhido contra o período anterior, funil, pacotes e maiores eventos.
  app.get('/api/admin/analise', exigirAdmin, async (c) => {
    const dias = Math.min(365, Math.max(1, Number(c.req.query('dias') ?? 30) || 30))
    const parametros = [agora(), dias]
    const janela = (coluna: string, alias: string) =>
      `count(*) filter (where ${coluna} >= $1::timestamptz - make_interval(days => $2) and ${coluna} < $1::timestamptz) as ${alias}_atual,
       count(*) filter (where ${coluna} >= $1::timestamptz - make_interval(days => $2 * 2) and ${coluna} < $1::timestamptz - make_interval(days => $2)) as ${alias}_anterior`
    const [ev, cv, ft, pg, funil, medias, pacotes, maiores] = await Promise.all([
      pool.query(`select ${janela('criado_em', 'n')} from eventos where excluido_em is null`, parametros),
      pool.query(`select ${janela('criado_em', 'n')} from convidados where evento_id in (select id from eventos where excluido_em is null)`, parametros),
      pool.query(`select ${janela('criado_em', 'n')} from fotos where removida_em is null and evento_id in (select id from eventos where excluido_em is null)`, parametros),
      pool.query(
        `select ${janela('atualizado_em', 'n')},
                coalesce(sum(valor_centavos) filter (where atualizado_em >= $1::timestamptz - make_interval(days => $2) and atualizado_em < $1::timestamptz), 0) as receita_atual,
                coalesce(sum(valor_centavos) filter (where atualizado_em >= $1::timestamptz - make_interval(days => $2 * 2) and atualizado_em < $1::timestamptz - make_interval(days => $2)), 0) as receita_anterior
           from pagamentos where status = 'aprovado'`,
        parametros,
      ),
      pool.query(
        `select count(*) as criados,
                count(*) filter (where e.estado in ('pronto','captura_aberta','captura_encerrada','revelado','expirado')) as ativados,
                count(*) filter (where exists (select 1 from fotos f where f.evento_id = e.id)) as com_fotos,
                count(*) filter (where e.revelado_em is not null) as revelados,
                count(*) filter (where coalesce(p.preco_centavos, 0) > 0) as pagos_criados,
                count(*) filter (where coalesce(p.preco_centavos, 0) > 0 and e.estado in ('pronto','captura_aberta','captura_encerrada','revelado','expirado')) as pagos_ativados
           from eventos e left join pacotes p on p.id = e.pacote
          where e.excluido_em is null and e.criado_em >= $1::timestamptz - make_interval(days => $2) and e.criado_em < $1::timestamptz`,
        parametros,
      ),
      pool.query(
        `select (select count(*) from eventos where excluido_em is null) as eventos,
                (select count(*) from fotos f join eventos x on x.id = f.evento_id where x.excluido_em is null and f.removida_em is null) as fotos,
                (select count(*) from convidados v join eventos x on x.id = v.evento_id where x.excluido_em is null) as convidados,
                (select coalesce(sum(limite_convidados), 0) from eventos where excluido_em is null and estado in ('captura_aberta','captura_encerrada','revelado')) as vagas,
                (select count(*) from convidados v join eventos e on e.id = v.evento_id where e.excluido_em is null and e.estado in ('captura_aberta','captura_encerrada','revelado')) as ocupadas,
                (select count(*) from eventos where excluido_em is null and estado = 'captura_aberta') as capturando_agora`,
      ),
      pool.query(
        `select p.id, p.nome, p.preco_centavos,
                count(e.id) filter (where e.criado_em >= $1::timestamptz - make_interval(days => $2) and e.criado_em < $1::timestamptz)::int as eventos_no_periodo,
                count(e.id)::int as eventos_total,
                coalesce((select sum(g.valor_centavos) from pagamentos g join eventos x on x.id = g.evento_id
                           where x.pacote = p.id and g.status = 'aprovado' and g.atualizado_em >= $1::timestamptz - make_interval(days => $2) and g.atualizado_em < $1::timestamptz), 0)::int as receita_no_periodo_centavos,
                coalesce((select count(*) from fotos f join eventos x on x.id = f.evento_id where x.pacote = p.id and f.removida_em is null), 0)::int as fotos,
                coalesce((select sum(f.tamanho_bytes) from fotos f join eventos x on x.id = f.evento_id where x.pacote = p.id and f.arquivo_apagado_em is null), 0)::float8 as armazenamento_bytes
           from pacotes p left join eventos e on e.pacote = p.id and e.excluido_em is null
          group by p.id order by p.ordem, p.id`,
        parametros,
      ),
      pool.query(
        `select e.id::text, e.nome, e.anfitriao_email, e.pacote, e.estado,
                (select count(*) from fotos where evento_id = e.id and removida_em is null)::int as fotos,
                (select count(*) from convidados where evento_id = e.id)::int as convidados,
                (select coalesce(sum(tamanho_bytes), 0) from fotos where evento_id = e.id and arquivo_apagado_em is null)::float8 as armazenamento_bytes
           from eventos e where e.excluido_em is null order by armazenamento_bytes desc, fotos desc limit 10`,
      ),
    ])
    const par = (l: Record<string, string>, k: string) => ({ atual: Number(l[`${k}_atual`]), anterior: Number(l[`${k}_anterior`]) })
    const f = funil.rows[0]
    const m = medias.rows[0]
    const eventosTotal = Number(m.eventos)
    const pagosCriados = Number(f.pagos_criados)
    const aprovados = par(pg.rows[0], 'n')
    const receita = par(pg.rows[0], 'receita')
    return c.json({
      dias,
      periodo: {
        eventos: par(ev.rows[0], 'n'),
        convidados: par(cv.rows[0], 'n'),
        fotos: par(ft.rows[0], 'n'),
        pagamentos_aprovados: aprovados,
        receita_centavos: receita,
        ticket_medio_centavos: {
          atual: aprovados.atual ? Math.round(receita.atual / aprovados.atual) : 0,
          anterior: aprovados.anterior ? Math.round(receita.anterior / aprovados.anterior) : 0,
        },
      },
      funil: {
        criados: Number(f.criados),
        ativados: Number(f.ativados),
        com_fotos: Number(f.com_fotos),
        revelados: Number(f.revelados),
        pagos_criados: pagosCriados,
        pagos_ativados: Number(f.pagos_ativados),
        conversao_paga: pagosCriados ? Number(f.pagos_ativados) / pagosCriados : null,
      },
      medias: {
        fotos_por_evento: eventosTotal ? Number(m.fotos) / eventosTotal : 0,
        convidados_por_evento: eventosTotal ? Number(m.convidados) / eventosTotal : 0,
        fotos_por_convidado: Number(m.convidados) ? Number(m.fotos) / Number(m.convidados) : 0,
        ocupacao_das_vagas: Number(m.vagas) ? Number(m.ocupadas) / Number(m.vagas) : null,
        eventos_capturando_agora: Number(m.capturando_agora),
      },
      pacotes: pacotes.rows,
      maiores_eventos: maiores.rows,
    })
  })

  // --- Pacotes
  const maiorPose = async () => Math.max(...(await servicos.config.valores()).poses_validas)

  app.get('/api/admin/pacotes', exigirAdmin, async (c) => {
    const [lista, uso] = await Promise.all([servicos.pacotes.listar(), pool.query<{ pacote: string; n: string }>('select pacote, count(*) as n from eventos where excluido_em is null group by pacote')])
    const porPacote = new Map(uso.rows.map((u) => [u.pacote, Number(u.n)]))
    return c.json({ pacotes: lista.map((p) => ({ ...p, eventos: porPacote.get(p.id) ?? 0 })) })
  })

  app.post('/api/admin/pacotes', exigirAdmin, async (c) => {
    const corpo = await lerCorpo(c)
    if (!corpo) return erro(c, 400, 'corpo_invalido', 'Envie um JSON válido.')
    const r = await servicos.pacotes.criar(corpo, c.get('admin'), await maiorPose())
    if (!r.ok) return erro(c, r.status, 'validacao', 'Confira os campos.', { erros: r.erros })
    return c.json({ pacote: r.pacote }, 201)
  })

  app.patch('/api/admin/pacotes/:id', exigirAdmin, async (c) => {
    const corpo = await lerCorpo(c)
    if (!corpo) return erro(c, 400, 'corpo_invalido', 'Envie um JSON válido.')
    const r = await servicos.pacotes.atualizar(c.req.param('id'), corpo, c.get('admin'), await maiorPose())
    if (!r.ok) return erro(c, r.status, r.status === 404 ? 'nao_encontrado' : 'validacao', 'Confira os campos.', { erros: r.erros })
    return c.json({ pacote: r.pacote })
  })

  // --- Preço por participante (#169): o que o simulador publica
  app.get('/api/admin/preco', exigirAdmin, async (c) => c.json(await servicos.precos.obter()))

  app.put('/api/admin/preco', exigirAdmin, async (c) => {
    const corpo = await lerCorpo(c)
    if (!corpo) return erro(c, 400, 'corpo_invalido', 'Envie um JSON válido.')
    const r = await servicos.precos.publicar(corpo, c.get('admin'))
    if (!r.ok) return erro(c, 400, 'validacao', 'Confira os campos.', { erros: r.erros })
    return c.json(r.preco)
  })

  // --- Configurações
  app.get('/api/admin/configuracoes', exigirAdmin, async (c) => {
    const linhas = await servicos.config.linhas()
    const grupos: { nome: string; itens: unknown[] }[] = []
    for (const l of linhas) {
      const d = l.definicao
      let grupo = grupos.find((g) => g.nome === d.grupo)
      if (!grupo) grupos.push((grupo = { nome: d.grupo, itens: [] }))
      grupo.itens.push({
        chave: d.chave,
        rotulo: d.rotulo,
        descricao: d.descricao,
        tipo: d.tipo,
        unidade: d.unidade ?? null,
        min: d.min ?? null,
        max: d.max ?? null,
        valor: l.valor,
        padrao: d.padrao,
        personalizado: l.personalizado,
        atualizado_em: l.atualizado_em,
        publica: d.publica,
      })
    }
    return c.json({ grupos })
  })

  app.patch('/api/admin/configuracoes', exigirAdmin, async (c) => {
    const corpo = await lerCorpo(c)
    if (!corpo || Object.keys(corpo).length === 0) return erro(c, 400, 'corpo_invalido', 'Envie { chave: valor }. Use null para voltar ao padrão.')
    const r = await servicos.config.atualizar(corpo, c.get('admin'))
    if (!r.ok) return erro(c, 400, 'validacao', 'Confira os valores.', { erros: r.erros })
    return c.json({ ok: true })
  })

  // --- Auditoria
  app.get('/api/admin/auditoria', exigirAdmin, async (c) => {
    const limite = Math.min(200, Math.max(1, Number(c.req.query('limite') ?? 50) || 50))
    const pagina = Math.max(1, Number(c.req.query('pagina') ?? 1) || 1)
    const usuario = c.req.query('usuario') || null
    const acao = c.req.query('acao') || null
    const de = c.req.query('de')
    const ate = c.req.query('ate')
    if ((de && !DATA.test(de)) || (ate && !DATA.test(ate))) return erro(c, 400, 'periodo_invalido', 'Use datas no formato AAAA-MM-DD.')
    const r = await pool.query(
      `select id::text, usuario, acao, alvo, antes, depois, criado_em, count(*) over () as total
         from auditoria_admin where ($3::text is null or usuario = $3) and ($4::text is null or acao = $4)
          and ($5::date is null or (criado_em at time zone 'America/Sao_Paulo')::date >= $5::date)
          and ($6::date is null or (criado_em at time zone 'America/Sao_Paulo')::date <= $6::date)
        order by criado_em desc, id desc limit $1 offset $2`,
      [limite, (pagina - 1) * limite, usuario, acao, de || null, ate || null],
    )
    return c.json({ pagina, limite, total: r.rows[0] ? Number(r.rows[0].total) : 0, registros: r.rows.map(({ total: _t, ...linha }) => linha) })
  })

  // --- Reverter uma alteração de configuração registrada na auditoria (volta ao valor de antes; também é auditado).
  app.post('/api/admin/auditoria/:id/reverter', exigirAdmin, async (c) => {
    const id = c.req.param('id')
    if (!/^\d{1,18}$/.test(id)) return erro(c, 400, 'id_invalido', 'Id inválido.')
    const r = await pool.query<{ acao: string; alvo: string | null; antes: unknown }>('select acao, alvo, antes from auditoria_admin where id = $1', [id])
    const l = r.rows[0]
    if (!l) return erro(c, 404, 'nao_encontrado', 'Registro não encontrado.')
    if (!['config.alterar', 'config.restaurar'].includes(l.acao) || !l.alvo) return erro(c, 409, 'nao_reversivel', 'Só alterações de configuração podem ser revertidas.')
    const resultado = await servicos.config.atualizar({ [l.alvo]: l.antes }, c.get('admin'))
    if (!resultado.ok) return erro(c, 400, 'validacao', 'O valor antigo não vale mais com as regras atuais.', { erros: resultado.erros })
    return c.json({ ok: true, chave: l.alvo, valor: l.antes })
  })

  // --- Sessões do próprio admin: onde está logado e encerrar as outras.
  app.get('/api/admin/sessoes', exigirAdmin, async (c) => {
    const atual = hashToken(c.get('token'))
    const r = await pool.query<{ token_hash: string; criado_em: Date; expira_em: Date }>('select token_hash, criado_em, expira_em from admin_sessoes where admin_id = $1 and expira_em > $2 order by criado_em desc', [c.get('admin').id, agora()])
    return c.json({ sessoes: r.rows.map((l) => ({ id: l.token_hash.slice(0, 16), atual: l.token_hash === atual, criado_em: l.criado_em, expira_em: l.expira_em })) })
  })

  app.delete('/api/admin/sessoes/:id', exigirAdmin, async (c) => {
    const id = c.req.param('id')
    if (!/^[0-9a-f]{16}$/.test(id)) return erro(c, 400, 'id_invalido', 'Id inválido.')
    const atual = hashToken(c.get('token'))
    if (atual.startsWith(id)) return erro(c, 409, 'sessao_atual', 'Para encerrar esta sessão, use Sair.')
    const r = await pool.query('delete from admin_sessoes where admin_id = $1 and starts_with(token_hash, $2)', [c.get('admin').id, id])
    if (!r.rowCount) return erro(c, 404, 'nao_encontrado', 'Sessão não encontrada.')
    return c.body(null, 204)
  })

  // --- Administradores
  app.get('/api/admin/administradores', exigirAdmin, async (c) => c.json({ administradores: await admins.listar() }))

  app.post('/api/admin/administradores/:id/redefinir-senha', exigirAdmin, async (c) => {
    const id = c.req.param('id')
    if (!/^[0-9a-f-]{36}$/i.test(id)) return erro(c, 400, 'id_invalido', 'Id inválido.')
    const r = await admins.redefinir(id, c.get('admin'))
    if (!r.ok) return erro(c, r.status, r.erro, r.mensagem)
    return c.json({ usuario: r.usuario, senha_temporaria: r.senha })
  })

  return app
}
