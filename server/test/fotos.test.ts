import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { after, before, test } from 'node:test'
import { criarApp } from '../src/app.ts'
import { criarPool } from '../src/db.ts'
import { migrar } from '../src/migracoes.ts'
import type { Storage } from '../src/storage/storage.ts'

// Precisa de um Postgres descartável: TEST_DATABASE_URL. Sem ele, os testes são pulados.
const url = process.env.TEST_DATABASE_URL
const opcoes = { skip: url ? false : 'defina TEST_DATABASE_URL para testar fotos' }
const pool = url ? criarPool(url) : undefined

class StorageMemoria implements Storage {
  arquivos = new Map<string, Uint8Array>()
  falhar = false
  async salvar(chave: string, dados: Uint8Array) {
    if (this.falhar) throw new Error('disco cheio')
    this.arquivos.set(chave, dados)
  }
  async ler(chave: string) {
    return this.arquivos.get(chave) ?? null
  }
  async apagar(chave: string) {
    this.arquivos.delete(chave)
  }
}

const storage = new StorageMemoria()
const inicio = new Date('2026-11-14T18:00:00Z')
let agora = inicio
const app = pool ? criarApp(pool, storage, () => agora) : undefined
const h = (horas: number) => new Date(inicio.getTime() + horas * 3600_000).toISOString()
const jpeg = (tamanho = 100) => new Uint8Array([0xff, 0xd8, 0xff, 0xe0, ...new Array(tamanho).fill(7)])

before(async () => {
  if (!pool) return
  await pool.query('drop schema public cascade; create schema public')
  await migrar(pool)
})
after(async () => {
  await pool?.end()
})

async function json(metodo: string, caminho: string, corpo?: unknown, cabecalhos: Record<string, string> = {}) {
  assert.ok(app)
  const r = await app.request(caminho, {
    method: metodo,
    headers: { 'content-type': 'application/json', ...cabecalhos },
    body: corpo === undefined ? undefined : JSON.stringify(corpo),
  })
  const texto = await r.text()
  return { status: r.status, json: texto ? JSON.parse(texto) : null }
}

async function enviar(
  caminho: string,
  token: string | undefined,
  dados: Uint8Array = jpeg(),
  extra: Record<string, string> = {},
) {
  assert.ok(app)
  const cabecalhos: Record<string, string> = { 'content-type': 'image/jpeg', ...extra }
  if (token) cabecalhos['x-convidado-token'] = token
  const r = await app.request(caminho, { method: 'PUT', headers: cabecalhos, body: dados as BodyInit })
  const texto = await r.text()
  // Erros inesperados (500) voltam como texto puro, não JSON.
  return { status: r.status, json: texto.startsWith('{') ? JSON.parse(texto) : null }
}

/** Evento grátis com a câmera aberta e um convidado dentro. */
async function cenario() {
  agora = inicio
  const criado = await json('POST', '/api/eventos', { nome: 'Festa', captura_inicio: h(1), captura_fim: h(7) })
  const codigo = criado.json.evento.codigo as string
  const hospede = criado.json.anfitriao_token as string
  agora = new Date(inicio.getTime() + 2 * 3600_000)
  const entrou = await json('POST', `/api/eventos/${codigo}/entrar`, {})
  assert.equal(entrou.status, 201)
  return { codigo, hospede, token: entrou.json.convidado_token as string, convidadoId: entrou.json.convidado_id as string }
}

test('envia a foto, repete sem duplicar e atualiza as poses', opcoes, async () => {
  const { codigo, token } = await cenario()
  const id = randomUUID()
  const r = await enviar(`/api/eventos/${codigo}/fotos/${id}`, token, jpeg(), { 'x-largura': '1200', 'x-altura': '1600' })
  assert.equal(r.status, 201)
  assert.equal(r.json.repetida, false)

  const de_novo = await enviar(`/api/eventos/${codigo}/fotos/${id.toUpperCase()}`, token)
  assert.equal(de_novo.status, 200)
  assert.equal(de_novo.json.repetida, true)

  const eu = await json('GET', `/api/eventos/${codigo}/eu`, undefined, { 'x-convidado-token': token })
  assert.equal(eu.status, 200)
  assert.deepEqual(eu.json.fotos, [id])
  assert.equal(eu.json.poses_restantes, 11)

  const linha = (await pool!.query('select largura, altura, tamanho_bytes, chave_storage from fotos where id = $1', [id])).rows[0]
  assert.equal(linha.largura, 1200)
  assert.equal(linha.altura, 1600)
  assert.ok(storage.arquivos.has(linha.chave_storage))
})

test('recusa sem token, token de outro evento, id ruim, tipo errado e arquivo grande', opcoes, async () => {
  const a = await cenario()
  const b = await cenario()
  const id = randomUUID()
  assert.equal((await enviar(`/api/eventos/${a.codigo}/fotos/${id}`, undefined)).status, 401)
  assert.equal((await enviar(`/api/eventos/${a.codigo}/fotos/${id}`, b.token)).status, 401)
  assert.equal((await enviar(`/api/eventos/${a.codigo}/fotos/nao-e-uuid`, a.token)).json.erro, 'id_invalido')
  assert.equal((await enviar(`/api/eventos/${a.codigo}/fotos/${id}`, a.token, new Uint8Array([1, 2, 3, 4, 5]))).json.erro, 'tipo_invalido')
  assert.equal((await enviar(`/api/eventos/${a.codigo}/fotos/${id}`, a.token, jpeg(), { 'content-type': 'image/png' })).status, 415)
  assert.equal((await enviar(`/api/eventos/${a.codigo}/fotos/${id}`, a.token, jpeg(2 * 1024 * 1024))).status, 413)
  assert.equal((await enviar(`/api/eventos/${a.codigo}/fotos/${id}`, a.token, jpeg(), { 'x-largura': 'abc' })).json.erro, 'dimensoes_invalidas')
  const n = (await pool!.query('select count(*) as n from fotos where evento_id = (select id from eventos where codigo = $1)', [a.codigo])).rows[0].n
  assert.equal(Number(n), 0)
})

test('limite de poses vale no servidor, inclusive em paralelo', opcoes, async () => {
  const { codigo, token } = await cenario() // teste = 12 poses
  const rs = await Promise.all(Array.from({ length: 16 }, () => enviar(`/api/eventos/${codigo}/fotos/${randomUUID()}`, token)))
  assert.equal(rs.filter((r) => r.status === 201).length, 12)
  assert.equal(rs.filter((r) => r.json.erro === 'sem_poses').length, 4)
  const eu = await json('GET', `/api/eventos/${codigo}/eu`, undefined, { 'x-convidado-token': token })
  assert.equal(eu.json.poses_restantes, 0)
})

test('o mesmo id de foto não pode ser usado por outro convidado', opcoes, async () => {
  const a = await cenario()
  const outro = await json('POST', `/api/eventos/${a.codigo}/entrar`, {})
  const id = randomUUID()
  assert.equal((await enviar(`/api/eventos/${a.codigo}/fotos/${id}`, a.token)).status, 201)
  const r = await enviar(`/api/eventos/${a.codigo}/fotos/${id}`, outro.json.convidado_token)
  assert.equal(r.status, 409)
  assert.equal(r.json.erro, 'id_em_uso')
})

test('envio atrasado vale por 24 h depois do fim; depois disso a câmera está fechada', opcoes, async () => {
  const { codigo, token } = await cenario()
  agora = new Date(inicio.getTime() + 8 * 3600_000) // fim foi em +7h: capturação encerrada
  assert.equal((await json('GET', `/api/eventos/${codigo}`)).json.estado, 'captura_encerrada')
  assert.equal((await enviar(`/api/eventos/${codigo}/fotos/${randomUUID()}`, token)).status, 201)

  agora = new Date(inicio.getTime() + (7 + 25) * 3600_000)
  const r = await enviar(`/api/eventos/${codigo}/fotos/${randomUUID()}`, token)
  assert.equal(r.status, 409)
  assert.equal(r.json.erro, 'captura_fechada')
})

test('se o armazenamento falhar, a pose não é gasta e o reenvio funciona', opcoes, async () => {
  const { codigo, token } = await cenario()
  const id = randomUUID()
  storage.falhar = true
  const falha = await enviar(`/api/eventos/${codigo}/fotos/${id}`, token)
  storage.falhar = false
  assert.equal(falha.status, 500)
  const eu = await json('GET', `/api/eventos/${codigo}/eu`, undefined, { 'x-convidado-token': token })
  assert.equal(eu.json.poses_restantes, 12)
  assert.equal((await enviar(`/api/eventos/${codigo}/fotos/${id}`, token)).status, 201)
})

test('miniatura: só do dono da foto e só JPEG', opcoes, async () => {
  const a = await cenario()
  const outro = await json('POST', `/api/eventos/${a.codigo}/entrar`, {})
  const id = randomUUID()
  await enviar(`/api/eventos/${a.codigo}/fotos/${id}`, a.token)

  assert.equal((await enviar(`/api/eventos/${a.codigo}/fotos/${id}/miniatura`, a.token, jpeg(50))).status, 200)
  const chave = (await pool!.query('select miniatura_chave from fotos where id = $1', [id])).rows[0].miniatura_chave
  assert.ok(chave.endsWith('_min.jpg'))
  assert.ok(storage.arquivos.has(chave))

  assert.equal((await enviar(`/api/eventos/${a.codigo}/fotos/${id}/miniatura`, outro.json.convidado_token, jpeg(50))).status, 404)
  assert.equal((await enviar(`/api/eventos/${a.codigo}/fotos/${randomUUID()}/miniatura`, a.token, jpeg(50))).status, 404)
  assert.equal((await enviar(`/api/eventos/${a.codigo}/fotos/${id}/miniatura`, a.token, new Uint8Array([9, 9, 9, 9]))).status, 415)
  assert.equal((await enviar(`/api/eventos/${a.codigo}/fotos/${id}/miniatura`, a.token, jpeg(600 * 1024))).status, 413)
})
