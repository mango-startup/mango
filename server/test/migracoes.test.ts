import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { criarPool } from '../src/db.ts'
import { migrar } from '../src/migracoes.ts'

// Precisa de um Postgres descartável: TEST_DATABASE_URL. Sem ele, os testes são pulados.
const url = process.env.TEST_DATABASE_URL
const opcoes = { skip: url ? false : 'defina TEST_DATABASE_URL para testar migrações' }
const pool = url ? criarPool(url) : undefined

before(async () => {
  if (!pool) return
  await pool.query('drop schema public cascade; create schema public')
})
after(async () => {
  await pool?.end()
})

test('migração cria as tabelas e é idempotente', opcoes, async () => {
  assert.ok(pool)
  const primeira = await migrar(pool)
  assert.ok(primeira.length > 0)
  const tabelas = (
    await pool.query<{ tablename: string }>("select tablename from pg_tables where schemaname = 'public'")
  ).rows.map((r) => r.tablename)
  for (const t of ['eventos', 'convidados', 'fotos', 'migracoes']) assert.ok(tabelas.includes(t), t)
  assert.deepEqual(await migrar(pool), [])
})

test('estado inválido de evento é recusado', opcoes, async () => {
  assert.ok(pool)
  await assert.rejects(
    pool.query(
      "insert into eventos (codigo, anfitriao_email, nome, estado, limite_convidados) values ('x','a@b.c','n','inexistente',10)",
    ),
  )
})
