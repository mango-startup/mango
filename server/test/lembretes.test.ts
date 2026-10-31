import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { avancarEstados } from '../src/agendador.ts'
import { criarApp } from '../src/app.ts'
import { criarPool } from '../src/db.ts'
import { migrar } from '../src/migracoes.ts'

// Precisa de um Postgres descartável: TEST_DATABASE_URL. Sem ele, os testes são pulados.
const url = process.env.TEST_DATABASE_URL
const opcoes = { skip: url ? false : 'defina TEST_DATABASE_URL para testar os lembretes' }
const pool = url ? criarPool(url) : undefined

const base = new Date('2026-11-14T18:00:00Z')
const h = (horas: number) => new Date(base.getTime() + horas * 3600_000)
const app = pool ? criarApp(pool, {} as never, () => base) : undefined

before(async () => {
  if (!pool) return
  await pool.query('drop schema public cascade; create schema public')
  await migrar(pool)
  await pool.query("insert into configuracoes (chave, valor) values ('rl_ativo', 'false')")
})
after(async () => {
  await pool?.end()
})

async function criar(nome: string, inicioEmHoras: number) {
  const r = await app!.request('/api/eventos', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ nome, email: 'ana@mango.test', participantes: 5, captura_inicio: h(inicioEmHoras).toISOString(), captura_fim: h(inicioEmHoras + 6).toISOString() }),
  })
  assert.equal(r.status, 201)
  const { evento } = (await r.json()) as { evento: { id: string } }
  await pool!.query('update eventos set criado_em = $2 where id = $1', [evento.id, base])
  return evento.id
}

async function rodar(agora: Date) {
  const chamadas: { tipo: string; ids: string[] }[] = []
  await avancarEstados(pool!, agora, { aoLembrar: (tipo, ids) => chamadas.push({ tipo, ids }) })
  return chamadas
}

test('lembrete de festa: só dentro de 24 h do início e uma única vez', opcoes, async () => {
  const id = await criar('Festa longe', 48)
  assert.deepEqual(await rodar(base), [])
  const depois = await rodar(h(30)) // começa em 18 h
  assert.deepEqual(depois, [{ tipo: 'festa_amanha', ids: [id] }])
  assert.deepEqual(await rodar(h(30)), [])
  assert.deepEqual(await rodar(h(31)), [])
})

test('lembrete de pagamento: 24 h aguardando e com e-mail, uma única vez', opcoes, async () => {
  const id = await criar('Sem pagar', 200)
  await pool!.query("update eventos set estado = 'aguardando_pagamento' where id = $1", [id])
  assert.deepEqual(await rodar(h(23)), [])
  assert.deepEqual(await rodar(h(25)), [{ tipo: 'pagamento_pendente', ids: [id] }])
  assert.deepEqual(await rodar(h(26)), [])
})

test('sem e-mail do anfitrião não há lembrete de pagamento', opcoes, async () => {
  const id = await criar('Sem e-mail', 300)
  await pool!.query("update eventos set estado = 'aguardando_pagamento', anfitriao_email = null where id = $1", [id])
  assert.deepEqual(await rodar(h(60)), [])
})
