import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import type { Pool } from 'pg'

export const pastaMigracoes = path.resolve(import.meta.dirname, '../migrations')

/** Aplica, em ordem alfabética, os arquivos .sql ainda não registrados. Cada um roda numa transação. */
export async function migrar(pool: Pool, pasta = pastaMigracoes): Promise<string[]> {
  await pool.query(`create table if not exists migracoes (
    nome text primary key,
    aplicada_em timestamptz not null default now()
  )`)
  const arquivos = (await readdir(pasta)).filter((f) => f.endsWith('.sql')).sort()
  const feitas = new Set((await pool.query<{ nome: string }>('select nome from migracoes')).rows.map((r) => r.nome))
  const aplicadas: string[] = []

  for (const nome of arquivos) {
    if (feitas.has(nome)) continue
    const sql = await readFile(path.join(pasta, nome), 'utf8')
    const cliente = await pool.connect()
    try {
      await cliente.query('begin')
      // Trava para duas instâncias não migrarem ao mesmo tempo.
      await cliente.query('select pg_advisory_xact_lock(727274)')
      const ja = await cliente.query('select 1 from migracoes where nome = $1', [nome])
      if (ja.rowCount === 0) {
        await cliente.query(sql)
        await cliente.query('insert into migracoes (nome) values ($1)', [nome])
        aplicadas.push(nome)
      }
      await cliente.query('commit')
    } catch (erro) {
      await cliente.query('rollback')
      throw new Error(`Falha na migração ${nome}: ${erro instanceof Error ? erro.message : erro}`)
    } finally {
      cliente.release()
    }
  }
  return aplicadas
}
