import type { Context } from 'hono'
import type { Pool } from 'pg'
import type { Servicos } from '../servicos.ts'
import { hashToken } from '../tokens.ts'
import { erro } from './util.ts'

export interface EventoAcesso {
  id: string
  codigo: string
  nome: string
  estado: string
  album_privado: boolean
  revelacao_em: Date | null
  expira_em: Date | null
}

export type Papel = 'anfitriao' | 'publico'

export function bearer(c: Context): string | null {
  const m = /^Bearer (\S+)$/.exec(c.req.header('authorization') ?? '')
  return m ? m[1] : null
}

/** Quem pode ver as fotos de um evento e quem é o anfitrião. Compartilhado entre álbum e moderação. */
export function criarAcesso(pool: Pool, servicos: Servicos) {
  /**
   * Quem pode ver as fotos de um evento:
   * - anfitrião (token): sempre, para moderar antes da revelação e baixar depois;
   * - qualquer pessoa com o código: só depois de revelado e se o álbum não for privado.
   * Devolve a resposta de erro pronta quando o acesso é negado.
   */
  async function acesso(c: Context): Promise<{ evento: EventoAcesso; papel: Papel } | Response> {
    await servicos.avancar()
    const r = await pool.query<EventoAcesso>(
      `select id, codigo, nome, estado, album_privado, revelacao_em, expira_em
       from eventos where codigo = $1 and excluido_em is null`,
      [c.req.param('codigo')!.toUpperCase()],
    )
    const evento = r.rows[0]
    if (!evento) return erro(c, 404, 'nao_encontrado', 'Evento não encontrado.')
    if (evento.estado === 'expirado') return erro(c, 410, 'expirado', 'Este álbum expirou.', { expira_em: evento.expira_em })

    const token = bearer(c)
    if (token) {
      const dono = await pool.query('select 1 from eventos where id = $1 and anfitriao_token_hash = $2', [evento.id, hashToken(token)])
      if (dono.rowCount) return { evento, papel: 'anfitriao' }
    }
    if (evento.estado !== 'revelado') {
      return erro(c, 409, 'nao_revelado', 'As fotos só aparecem na revelação.', { estado: evento.estado, revelacao_em: evento.revelacao_em })
    }
    if (evento.album_privado) return erro(c, 403, 'album_privado', 'O anfitrião deixou este álbum privado.')
    return { evento, papel: 'publico' }
  }

  async function anfitriao(c: Context): Promise<EventoAcesso | null> {
    const token = bearer(c)
    if (!token) return null
    await servicos.avancar()
    const r = await pool.query<EventoAcesso>(
      `select id, codigo, nome, estado, album_privado, revelacao_em, expira_em
       from eventos where anfitriao_token_hash = $1 and excluido_em is null`,
      [hashToken(token)],
    )
    return r.rows[0] ?? null
  }

  return { acesso, anfitriao }
}
