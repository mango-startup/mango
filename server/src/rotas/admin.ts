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

  // --- Eventos: lista com filtros (estado, pacote, busca por nome/e-mail do anfitrião) e contagens.
  app.get('/api/admin/eventos', exigirAdmin, async (c) => {
    const { limite, pagina, deslocamento } = paginar(c)
    const estado = c.req.query('estado')
    const pacote = c.req.query('pacote')
    const busca = (c.req.query('busca') ?? '').trim().slice(0, 100)
    const r = await pool.query(
      `select e.id::text, e.codigo, e.nome, e.anfitriao_email, e.estado, e.pacote, e.limite_convidados, e.criado_em,
              (select count(*) from convidados where evento_id = e.id)::int as convidados,
              (select count(*) from fotos where evento_id = e.id and removida_em is null)::int as fotos,
              count(*) over () as total
         from eventos e
        where e.excluido_em is null
          and ($1::text is null or e.estado = $1)
          and ($2::text is null or e.pacote = $2)
          and ($3 = '' or e.nome ilike '%' || $3 || '%' or e.anfitriao_email ilike '%' || $3 || '%')
        order by e.criado_em desc, e.id desc limit $4 offset $5`,
      [estado || null, pacote || null, busca.replace(/[\\%_]/g, '\\$&'), limite, deslocamento],
    )
    return c.json({ pagina, limite, total: r.rows[0] ? Number(r.rows[0].total) : 0, eventos: r.rows.map(({ total: _t, ...linha }) => linha) })
  })

  // --- Pagamentos: totais por status e lista paginada (mais recentes primeiro).
  app.get('/api/admin/pagamentos', exigirAdmin, async (c) => {
    const { limite, pagina, deslocamento } = paginar(c)
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
    const r = await pool.query(
      `select id::text, usuario, acao, alvo, antes, depois, criado_em, count(*) over () as total
       from auditoria_admin order by criado_em desc, id desc limit $1 offset $2`,
      [limite, (pagina - 1) * limite],
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
