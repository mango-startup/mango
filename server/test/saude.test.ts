import assert from 'node:assert/strict'
import { test } from 'node:test'
import { criarApp } from '../src/app.ts'

test('GET /api/saude responde 200 quando o banco responde', async () => {
  const app = criarApp({ query: async () => ({ rows: [] }) } as never)
  const r = await app.request('/api/saude')
  assert.equal(r.status, 200)
  assert.deepEqual(await r.json(), { status: 'ok', banco: 'ok' })
})

test('GET /api/saude responde 503 quando o banco falha', async () => {
  const app = criarApp({ query: async () => { throw new Error('caiu') } } as never)
  const r = await app.request('/api/saude')
  assert.equal(r.status, 503)
})
