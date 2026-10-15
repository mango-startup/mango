import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { after, before, test } from 'node:test'
import { criarApp } from '../src/app.ts'
import { criarPool } from '../src/db.ts'
import { limparArquivos } from '../src/limpeza.ts'
import { LIMITES_PADRAO } from '../src/limites.ts'
import { migrar } from '../src/migracoes.ts'
import type { Storage } from '../src/storage/storage.ts'

// Precisa de um Postgres descartável: TEST_DATABASE_URL. Sem ele, os testes são pulados.
const url = process.env.TEST_DATABASE_URL
const opcoes = { skip: url ? false : 'defina TEST_DATABASE_URL para testar a moderação' }
const pool = url ? criarPool(url) : undefined

class StorageMemoria implements Storage {
  arquivos = new Map<string, Uint8Array>()
  falharAoApagar = false
  async salvar(chave: string, dados: Uint8Array) {
    this.arquivos.set(chave, dados)
  }
  async ler(chave: string) {
    return this.arquivos.get(chave) ?? null
  }
  async apagar(chave: string) {
    if (this.falharAoApagar) throw new Error('disco travado')
    this.arquivos.delete(chave)
  }
}

const storage = new StorageMemoria()
const inicio = new Date('2026-11-14T18:00:00Z')
let agora = inicio
const app = pool ? criarApp(pool, storage, () => agora) : undefined
const h = (horas: number) => new Date(inicio.getTime() + horas * 3600_000)
const jpeg = (marca: number) => new Uint8Array([0xff, 0xd8, 0xff, 0xe0, ...new Array(30).fill(marca)])

before(async () => {
  if (!pool) return
  await pool.query('drop schema public cascade; create schema public')
  await migrar(pool)
})
after(async () => {
  await pool?.end()
})

async function chamar(metodo: string, caminho: string, opts: { corpo?: unknown; cab?: Record<string, string>; bruto?: Uint8Array; instancia?: ReturnType<typeof criarApp> } = {}) {
  const alvo = opts.instancia ?? app
  assert.ok(alvo)
  const cab: Record<string, string> = { ...(opts.bruto ? { 'content-type': 'image/jpeg' } : { 'content-type': 'application/json' }), ...opts.cab }
  const r = await alvo.request(caminho, {
    method: metodo,
    headers: cab,
    body: opts.bruto ? (opts.bruto as BodyInit) : opts.corpo === undefined ? undefined : JSON.stringify(opts.corpo),
  })
  const texto = await r.text()
  return { status: r.status, json: texto.startsWith('{') ? JSON.parse(texto) : null }
}

/** Evento com dois convidados e 4 fotos (2 de cada), no estado "câmera encerrada". */
async function cenario() {
  agora = inicio
  const criado = await chamar('POST', '/api/eventos', { corpo: { nome: 'Festa', captura_inicio: h(1).toISOString(), captura_fim: h(7).toISOString() } })
  const codigo = criado.json.evento.codigo as string
  const host = { authorization: `Bearer ${criado.json.anfitriao_token}` }
  agora = h(2)
  const ana = (await chamar('POST', `/api/eventos/${codigo}/entrar`, { corpo: { apelido: 'Ana' } })).json.convidado_token as string
  const beto = (await chamar('POST', `/api/eventos/${codigo}/entrar`, { corpo: { apelido: 'Beto' } })).json.convidado_token as string
  const ids: string[] = []
  for (const token of [ana, ana, beto, beto]) {
    const id = randomUUID()
    agora = new Date(h(2).getTime() + ids.length * 60_000)
    assert.equal((await chamar('PUT', `/api/eventos/${codigo}/fotos/${id}`, { bruto: jpeg(ids.length + 1), cab: { 'x-convidado-token': token } })).status, 201)
    ids.push(id)
  }
  agora = h(8)
  return { codigo, host, ana, beto, ids }
}
const revelar = () => {
  agora = h(20)
}
const total = async (codigo: string, cab: Record<string, string> = {}) => (await chamar('GET', `/api/eventos/${codigo}/album`, { cab })).json?.total

test('anfitrião apaga a foto: some do álbum na hora, antes e depois da revelação', opcoes, async () => {
  const { codigo, host, ids } = await cenario()
  assert.equal((await chamar('DELETE', `/api/anfitriao/fotos/${ids[0]}`)).status, 401)
  assert.equal((await chamar('DELETE', `/api/anfitriao/fotos/nao-uuid`, { cab: host })).status, 400)
  assert.equal((await chamar('DELETE', `/api/anfitriao/fotos/${randomUUID()}`, { cab: host })).status, 404)

  // moderação antes da revelação
  assert.equal(await total(codigo, host), 4)
  assert.equal((await chamar('DELETE', `/api/anfitriao/fotos/${ids[0]}`, { cab: host })).status, 204)
  assert.equal(await total(codigo, host), 3)
  assert.equal((await chamar('DELETE', `/api/anfitriao/fotos/${ids[0]}`, { cab: host })).status, 404) // já apagada

  revelar()
  assert.equal(await total(codigo), 3)
  assert.equal((await chamar('GET', `/api/eventos/${codigo}/fotos/${ids[0]}/arquivo`)).status, 404)
  assert.equal((await chamar('GET', `/api/eventos/${codigo}/fotos/${ids[1]}/arquivo`)).status, 200)

  // foto de outro evento não é do anfitrião
  const outro = await cenario()
  assert.equal((await chamar('DELETE', `/api/anfitriao/fotos/${outro.ids[0]}`, { cab: host })).status, 404)
})

test('pedir remoção: só com o álbum aberto, um pedido por pessoa, e o anfitrião decide', opcoes, async () => {
  const { codigo, host, beto, ids } = await cenario()
  const pedir = (foto: string, cab: Record<string, string> = {}, corpo: unknown = {}) =>
    chamar('POST', `/api/eventos/${codigo}/fotos/${foto}/pedir-remocao`, { corpo, cab })

  const cedo = await pedir(ids[0], { 'x-forwarded-for': '1.1.1.1' })
  assert.equal(cedo.status, 409)
  assert.equal(cedo.json.erro, 'nao_revelado')

  revelar()
  const a = await pedir(ids[0], { 'x-forwarded-for': '1.1.1.1' }, { motivo: '  Não gostei de aparecer  ' })
  assert.equal(a.status, 201)
  assert.equal((await pedir(ids[0], { 'x-forwarded-for': '1.1.1.1' })).json.repetido, true) // mesma pessoa, sem duplicar
  assert.equal((await pedir(ids[0], { 'x-forwarded-for': '2.2.2.2' })).status, 201) // outra pessoa
  assert.equal((await pedir(ids[0], { 'x-convidado-token': beto, 'x-forwarded-for': '1.1.1.1' })).status, 201) // convidado reconhecido
  assert.equal((await pedir(ids[1], { 'x-forwarded-for': '1.1.1.1' })).status, 201)

  assert.equal((await pedir('nao-uuid')).status, 400)
  assert.equal((await pedir(randomUUID())).status, 404)
  assert.equal((await pedir(ids[0], host)).json.erro, 'anfitriao_apaga')

  const lista = await chamar('GET', '/api/anfitriao/pedidos-remocao', { cab: host })
  assert.equal(lista.status, 200)
  assert.equal(lista.json.pedidos.length, 4)
  assert.equal(lista.json.pedidos[0].motivo, 'Não gostei de aparecer')
  assert.equal(lista.json.pedidos[0].numero, 1)
  assert.equal(lista.json.pedidos[3].numero, 2)
  assert.equal((await chamar('GET', '/api/anfitriao/pedidos-remocao')).status, 401)

  // mantém um pedido
  const unico = lista.json.pedidos[3].id
  assert.equal((await chamar('POST', `/api/anfitriao/pedidos-remocao/${unico}/manter`, { cab: host })).status, 204)
  assert.equal((await chamar('POST', `/api/anfitriao/pedidos-remocao/${unico}/manter`, { cab: host })).status, 404)
  assert.equal((await chamar('GET', '/api/anfitriao/pedidos-remocao', { cab: host })).json.pedidos.length, 3)

  // apagar a foto resolve os pedidos dela e novos pedidos dão 404
  assert.equal((await chamar('DELETE', `/api/anfitriao/fotos/${ids[0]}`, { cab: host })).status, 204)
  assert.equal((await chamar('GET', '/api/anfitriao/pedidos-remocao', { cab: host })).json.pedidos.length, 0)
  assert.equal((await pedir(ids[0], { 'x-forwarded-for': '3.3.3.3' })).status, 404)
  const resolucao = await pool!.query("select resolucao from pedidos_remocao where foto_id = $1 order by criado_em", [ids[0]])
  assert.ok(resolucao.rows.every((r) => r.resolucao === 'removida'))
})

test('álbum privado não aceita pedido de remoção', opcoes, async () => {
  const { codigo, host, ids } = await cenario()
  revelar()
  await chamar('PATCH', '/api/anfitriao/evento', { corpo: { album_privado: true }, cab: host })
  const r = await chamar('POST', `/api/eventos/${codigo}/fotos/${ids[0]}/pedir-remocao`, { corpo: {} })
  assert.equal(r.status, 403)
})

test('limite de pedidos de remoção por IP e por hora', opcoes, async () => {
  assert.ok(pool)
  const limitada = criarApp(pool, storage, () => agora, { ...LIMITES_PADRAO, pedidosRemocaoPorHora: 2 })
  const { codigo, ids } = await cenario()
  revelar()
  const pedir = () => chamar('POST', `/api/eventos/${codigo}/fotos/${ids[0]}/pedir-remocao`, { corpo: {}, cab: { 'x-forwarded-for': '9.9.9.9' }, instancia: limitada })
  assert.equal((await pedir()).status, 201)
  assert.equal((await pedir()).json.repetido, true)
  const barrado = await pedir()
  assert.equal(barrado.status, 429)
  assert.equal(barrado.json.erro, 'muitas_requisicoes')
})

test('limpeza apaga os arquivos vencidos, mantém os recentes e é idempotente', opcoes, async () => {
  const { codigo, host, ids } = await cenario()
  const chaves = async () =>
    Object.fromEntries((await pool!.query('select id, chave_storage, arquivo_apagado_em from fotos where id = any($1)', [ids])).rows.map((r) => [r.id, r]))
  const existe = async (id: string) => storage.arquivos.has((await chaves())[id].chave_storage)

  // Foto 0 removida há 31 dias; foto 1 removida há 5 dias.
  await chamar('DELETE', `/api/anfitriao/fotos/${ids[0]}`, { cab: host })
  await chamar('DELETE', `/api/anfitriao/fotos/${ids[1]}`, { cab: host })
  await pool!.query('update fotos set removida_em = $2 where id = $1', [ids[0], new Date(agora.getTime() - 31 * 24 * 3600_000)])
  await pool!.query('update fotos set removida_em = $2 where id = $1', [ids[1], new Date(agora.getTime() - 5 * 24 * 3600_000)])

  assert.equal(await limparArquivos(pool!, storage, agora), 1)
  assert.equal(await existe(ids[0]), false)
  assert.ok((await chaves())[ids[0]].arquivo_apagado_em)
  assert.equal(await existe(ids[1]), true) // ainda dentro do prazo
  assert.equal(await existe(ids[2]), true) // foto normal
  assert.equal(await limparArquivos(pool!, storage, agora), 0) // idempotente

  // Falha do armazenamento: não marca, tenta de novo na próxima rodada.
  await pool!.query('update fotos set removida_em = $2 where id = $1', [ids[1], new Date(agora.getTime() - 40 * 24 * 3600_000)])
  storage.falharAoApagar = true
  const erroOriginal = console.error
  console.error = () => {}
  assert.equal(await limparArquivos(pool!, storage, agora), 0)
  console.error = erroOriginal
  storage.falharAoApagar = false
  assert.equal((await chaves())[ids[1]].arquivo_apagado_em, null)
  assert.equal(await limparArquivos(pool!, storage, agora), 1)
  assert.equal(await existe(ids[1]), false)

  // Evento expirado: apaga tudo que sobrou.
  revelar()
  await chamar('GET', `/api/eventos/${codigo}`) // o relógio revela
  agora = new Date(h(20).getTime() + 31 * 24 * 3600_000)
  assert.equal((await chamar('GET', `/api/eventos/${codigo}`)).json.estado, 'expirado')
  assert.ok((await limparArquivos(pool!, storage, agora)) >= 2) // pega também eventos expirados de outros testes
  assert.equal(await existe(ids[2]), false)
  assert.equal(await existe(ids[3]), false)
})

test('limpeza de evento excluído só depois de 30 dias', opcoes, async () => {
  const { host, ids } = await cenario()
  await chamar('DELETE', '/api/anfitriao/evento', { cab: host })
  assert.equal(await limparArquivos(pool!, storage, agora), 0) // excluído agora
  const futuro = new Date(agora.getTime() + 31 * 24 * 3600_000)
  assert.ok((await limparArquivos(pool!, storage, futuro)) >= 4)
  const chave = (await pool!.query('select chave_storage from fotos where id = $1', [ids[0]])).rows[0].chave_storage
  assert.equal(storage.arquivos.has(chave), false)
})
