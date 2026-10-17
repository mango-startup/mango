import { Hono } from 'hono'
import type { Context, MiddlewareHandler } from 'hono'
import { deleteCookie, getCookie, setCookie } from 'hono/cookie'
import type { Pool } from 'pg'
import { ServicoAdmin } from '../admin/autenticacao.ts'
import type { Admin } from '../admin/autenticacao.ts'
import type { Servicos } from '../servicos.ts'
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
export function rotasAdmin(pool: Pool, servicos: Servicos, agora: () => Date = () => new Date()): Hono<Variaveis> {
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
        `select (select count(*) from eventos where criado_em > $1::timestamptz - interval '7 days') as eventos_7d,
                (select count(*) from convidados) as convidados,
                (select count(*) from fotos where removida_em is null) as fotos,
                (select count(*) from fotos where criado_em > $1::timestamptz - interval '24 hours') as fotos_24h,
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
      `select e.id::text, e.codigo, e.nome, e.anfitriao_email, e.estado, e.pacote, e.limite_convidados, e.criado_em,
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
    if (exportar) return csv(c, 'eventos', ['id', 'codigo', 'nome', 'anfitriao_email', 'estado', 'pacote', 'limite_convidados', 'convidados', 'fotos', 'armazenamento_bytes', 'criado_em'], eventos)
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
    const [totais, lista] = await Promise.all([
      pool.query<{ status: string; n: string; soma: string }>('select status, count(*) as n, coalesce(sum(valor_centavos), 0) as soma from pagamentos group by status'),
      pool.query(
        `select p.id::text, p.evento_id::text, e.nome as evento_nome, e.pacote, p.valor_centavos, p.status, p.criado_em, count(*) over () as total
           from pagamentos p join eventos e on e.id = p.evento_id
          where ($1::text is null or p.status = $1)
          order by p.criado_em desc, p.id desc limit $2 offset $3`,
        [status || null, limite, deslocamento],
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
              (select count(*) from eventos e where (e.criado_em at time zone 'America/Sao_Paulo')::date = d.dia)::int as eventos,
              (select count(*) from convidados v where (v.criado_em at time zone 'America/Sao_Paulo')::date = d.dia)::int as convidados,
              (select count(*) from fotos f where (f.criado_em at time zone 'America/Sao_Paulo')::date = d.dia)::int as fotos,
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
      pool.query(`select ${janela('criado_em', 'n')} from convidados`, parametros),
      pool.query(`select ${janela('criado_em', 'n')} from fotos`, parametros),
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
                (select count(*) from fotos where removida_em is null) as fotos,
                (select count(*) from convidados) as convidados,
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
    const r = await pool.query(
      `select id::text, usuario, acao, alvo, antes, depois, criado_em, count(*) over () as total
         from auditoria_admin where ($3::text is null or usuario = $3) and ($4::text is null or acao = $4)
        order by criado_em desc, id desc limit $1 offset $2`,
      [limite, (pagina - 1) * limite, usuario, acao],
    )
    return c.json({ pagina, limite, total: r.rows[0] ? Number(r.rows[0].total) : 0, registros: r.rows.map(({ total: _t, ...linha }) => linha) })
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
