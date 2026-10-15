import type { Context } from 'hono'
import { Hono } from 'hono'
import type { Pool } from 'pg'
import type { Storage } from '../storage/storage.ts'
import { gerarCodigo, hashToken } from '../tokens.ts'
import { criarAcesso } from './acesso.ts'
import { criarZip } from '../zip.ts'
import { erro } from './util.ts'

const ZIP_MAX_BYTES = 4_000_000_000
const ZIP_MAX_ARQUIVOS = 65_000
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function slug(texto: string): string {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 30)
}

export function rotasAlbum(pool: Pool, storage: Storage, agora: () => Date = () => new Date()): Hono {
  const app = new Hono()
  const { acesso, anfitriao } = criarAcesso(pool, agora)

  // Folha de contato: lista paginada. "numero" é a posição no álbum inteiro, mesmo com o filtro "minhas".
  app.get('/api/eventos/:codigo/album', async (c) => {
    const a = await acesso(c)
    if (a instanceof Response) return a

    const limite = Math.min(200, Math.max(1, Number(c.req.query('limite') ?? 60) || 60))
    const pagina = Math.max(1, Number(c.req.query('pagina') ?? 1) || 1)

    let soDoConvidado: string | null = null
    if (c.req.query('minhas') === '1') {
      const token = c.req.header('x-convidado-token')
      const r = token
        ? await pool.query<{ id: string }>('select id from convidados where evento_id = $1 and token_hash = $2', [a.evento.id, hashToken(token)])
        : null
      if (!r?.rows[0]) return erro(c, 401, 'nao_autorizado', 'Convidado não reconhecido neste evento.')
      soDoConvidado = r.rows[0].id
    }

    const r = await pool.query(
      `with todas as (
         select f.id, f.convidado_id, c.apelido, f.tirada_em, f.largura, f.altura, f.miniatura_chave is not null as tem_miniatura,
                row_number() over (order by coalesce(f.tirada_em, f.criado_em), f.id) as numero
         from fotos f join convidados c on c.id = f.convidado_id
         where f.evento_id = $1 and f.removida_em is null
       )
       select id, numero::int as numero, apelido, tirada_em, largura, altura, tem_miniatura, count(*) over () as total
       from todas where ($2::uuid is null or convidado_id = $2)
       order by numero limit $3 offset $4`,
      [a.evento.id, soDoConvidado, limite, (pagina - 1) * limite],
    )
    return c.json({
      evento: { nome: a.evento.nome, expira_em: a.evento.expira_em, estado: a.evento.estado },
      pagina,
      limite,
      total: r.rows[0] ? Number(r.rows[0].total) : 0,
      fotos: r.rows.map(({ total: _total, ...foto }) => foto),
    })
  })

  async function servirArquivo(c: Context, miniatura: boolean) {
    const a = await acesso(c)
    if (a instanceof Response) return a
    const fotoId = c.req.param('fotoId')!.toLowerCase()
    if (!UUID.test(fotoId)) return erro(c, 400, 'id_invalido', 'O id da foto precisa ser um UUID.')
    const r = await pool.query<{ chave_storage: string; miniatura_chave: string | null }>(
      'select chave_storage, miniatura_chave from fotos where id = $1 and evento_id = $2 and removida_em is null',
      [fotoId, a.evento.id],
    )
    const foto = r.rows[0]
    if (!foto) return erro(c, 404, 'nao_encontrada', 'Foto não encontrada.')
    // Sem miniatura gravada, devolve a foto original.
    const dados = await storage.ler(miniatura && foto.miniatura_chave ? foto.miniatura_chave : foto.chave_storage)
    if (!dados) return erro(c, 404, 'nao_encontrada', 'Arquivo da foto não encontrado.')
    const cabecalhos: Record<string, string> = {
      'content-type': 'image/jpeg',
      'content-length': String(dados.length),
      // O álbum pode virar privado ou a foto removida: nada de cache compartilhado.
      'cache-control': 'private, max-age=3600',
      'x-content-type-options': 'nosniff',
    }
    if (!miniatura && c.req.query('baixar') === '1') cabecalhos['content-disposition'] = `attachment; filename="mango-${fotoId.slice(0, 8)}.jpg"`
    return new Response(dados as BodyInit, { status: 200, headers: cabecalhos })
  }

  app.get('/api/eventos/:codigo/fotos/:fotoId/arquivo', (c) => servirArquivo(c, false))
  app.get('/api/eventos/:codigo/fotos/:fotoId/miniatura', (c) => servirArquivo(c, true))

  // --- Anfitrião ---
  // ZIP com todas as fotos, só depois de revelado.
  app.get('/api/anfitriao/album.zip', async (c) => {
    const e = await anfitriao(c)
    if (!e) return erro(c, 401, 'nao_autorizado', 'Token do anfitrião inválido.')
    if (e.estado !== 'revelado') return erro(c, 409, 'nao_revelado', 'O ZIP só fica disponível depois da revelação.', { estado: e.estado })

    const r = await pool.query<{ chave_storage: string; apelido: string | null; numero: number; tamanho_bytes: number }>(
      `select f.chave_storage, c.apelido, f.tamanho_bytes,
              row_number() over (order by coalesce(f.tirada_em, f.criado_em), f.id)::int as numero
       from fotos f join convidados c on c.id = f.convidado_id
       where f.evento_id = $1 and f.removida_em is null order by numero`,
      [e.id],
    )
    if (r.rows.length === 0) return erro(c, 404, 'sem_fotos', 'Este álbum ainda não tem fotos.')
    const total = r.rows.reduce((s, f) => s + f.tamanho_bytes, 0)
    if (r.rows.length > ZIP_MAX_ARQUIVOS || total > ZIP_MAX_BYTES) {
      return erro(c, 413, 'zip_grande', 'O álbum é grande demais para um ZIP só. Baixe as fotos pelo álbum.')
    }
    const corpo = criarZip(
      r.rows.map((f) => ({
        nome: `${String(f.numero).padStart(4, '0')}${f.apelido ? `-${slug(f.apelido)}` : ''}.jpg`,
        ler: () => storage.ler(f.chave_storage),
      })),
    )
    return new Response(corpo, {
      headers: {
        'content-type': 'application/zip',
        'content-disposition': `attachment; filename="mango-${slug(e.nome) || 'album'}.zip"`,
        'cache-control': 'no-store',
      },
    })
  })

  // Troca o código: o link e o QR antigos param de funcionar (útil se o link vazou).
  app.post('/api/anfitriao/evento/novo-codigo', async (c) => {
    const e = await anfitriao(c)
    if (!e) return erro(c, 401, 'nao_autorizado', 'Token do anfitrião inválido.')
    for (let tentativa = 0; tentativa < 5; tentativa++) {
      const codigo = gerarCodigo()
      try {
        await pool.query('update eventos set codigo = $2, atualizado_em = $3 where id = $1', [e.id, codigo, agora()])
        return c.json({ codigo })
      } catch (erroSql) {
        if ((erroSql as { code?: string }).code !== '23505') throw erroSql
      }
    }
    return c.json({ erro: 'codigo_indisponivel', mensagem: 'Tente de novo.' }, 409)
  })

  return app
}
