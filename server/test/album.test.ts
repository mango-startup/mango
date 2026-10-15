import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { after, before, test } from 'node:test'
import { crc32 } from 'node:zlib'
import { criarApp } from '../src/app.ts'
import { criarPool } from '../src/db.ts'
import { migrar } from '../src/migracoes.ts'
import type { Storage } from '../src/storage/storage.ts'

// Precisa de um Postgres descartável: TEST_DATABASE_URL. Sem ele, os testes são pulados.
const url = process.env.TEST_DATABASE_URL
const opcoes = { skip: url ? false : 'defina TEST_DATABASE_URL para testar o álbum' }
const pool = url ? criarPool(url) : undefined

class StorageMemoria implements Storage {
  arquivos = new Map<string, Uint8Array>()
  async salvar(chave: string, dados: Uint8Array) {
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
const h = (horas: number) => new Date(inicio.getTime() + horas * 3600_000)
const jpeg = (marca: number, tamanho = 50) => new Uint8Array([0xff, 0xd8, 0xff, 0xe0, ...new Array(tamanho).fill(marca)])

before(async () => {
  if (!pool) return
  await pool.query('drop schema public cascade; create schema public')
  await migrar(pool)
})
after(async () => {
  await pool?.end()
})

async function chamar(metodo: string, caminho: string, opts: { corpo?: unknown; cab?: Record<string, string>; bruto?: Uint8Array } = {}) {
  assert.ok(app)
  const cab: Record<string, string> = { ...(opts.bruto ? { 'content-type': 'image/jpeg' } : { 'content-type': 'application/json' }), ...opts.cab }
  const r = await app.request(caminho, {
    method: metodo,
    headers: cab,
    body: opts.bruto ? (opts.bruto as BodyInit) : opts.corpo === undefined ? undefined : JSON.stringify(opts.corpo),
  })
  const buf = new Uint8Array(await r.arrayBuffer())
  const texto = new TextDecoder().decode(buf)
  return { status: r.status, headers: r.headers, buf, json: texto.startsWith('{') ? JSON.parse(texto) : null }
}

/** Evento com dois convidados (Ana e Beto), 3 fotos da Ana e 2 do Beto; fotos ficam no estado "câmera encerrada". */
async function cenario() {
  agora = inicio
  const criado = await chamar('POST', '/api/eventos', { corpo: { nome: 'Casamento Ana & Léo', captura_inicio: h(1).toISOString(), captura_fim: h(7).toISOString() } })
  const codigo = criado.json.evento.codigo as string
  const host = { authorization: `Bearer ${criado.json.anfitriao_token}` }
  agora = h(2)
  const ana = (await chamar('POST', `/api/eventos/${codigo}/entrar`, { corpo: { apelido: 'Ana Paula' } })).json.convidado_token as string
  const beto = (await chamar('POST', `/api/eventos/${codigo}/entrar`, { corpo: { apelido: 'Beto' } })).json.convidado_token as string
  const ids: string[] = []
  let marca = 1
  for (const [token, qtd] of [[ana, 3], [beto, 2]] as const) {
    for (let i = 0; i < qtd; i++) {
      const id = randomUUID()
      agora = new Date(h(2).getTime() + ids.length * 60_000) // cada foto 1 min depois: ordem previsível
      const r = await chamar('PUT', `/api/eventos/${codigo}/fotos/${id}`, {
        bruto: jpeg(marca++),
        cab: { 'x-convidado-token': token, 'x-tirada-em': agora.toISOString() },
      })
      assert.equal(r.status, 201)
      ids.push(id)
    }
  }
  agora = h(8)
  return { codigo, host, ana, beto, ids }
}

const revelar = () => {
  agora = h(20)
}

test('antes da revelação só o anfitrião vê as fotos (moderação)', opcoes, async () => {
  const { codigo, host, ids } = await cenario()
  const publico = await chamar('GET', `/api/eventos/${codigo}/album`)
  assert.equal(publico.status, 409)
  assert.equal(publico.json.erro, 'nao_revelado')
  assert.ok(publico.json.revelacao_em)
  assert.equal((await chamar('GET', `/api/eventos/${codigo}/fotos/${ids[0]}/arquivo`)).status, 409)

  const moderacao = await chamar('GET', `/api/eventos/${codigo}/album`, { cab: host })
  assert.equal(moderacao.status, 200)
  assert.equal(moderacao.json.total, 5)
  assert.equal((await chamar('GET', `/api/eventos/${codigo}/fotos/${ids[0]}/arquivo`, { cab: host })).status, 200)
  assert.equal((await chamar('GET', `/api/eventos/${codigo}/album`, { cab: { authorization: 'Bearer errado' } })).status, 409)
})

test('álbum revelado: folha de contato numerada, paginada e filtro "minhas"', opcoes, async () => {
  const { codigo, ana, beto, ids } = await cenario()
  revelar()
  const todas = await chamar('GET', `/api/eventos/${codigo}/album`)
  assert.equal(todas.status, 200)
  assert.equal(todas.json.total, 5)
  assert.deepEqual(todas.json.fotos.map((f: { id: string }) => f.id), ids)
  assert.deepEqual(todas.json.fotos.map((f: { numero: number }) => f.numero), [1, 2, 3, 4, 5])
  assert.equal(todas.json.fotos[0].apelido, 'Ana Paula')
  assert.equal(todas.json.fotos[0].chave_storage, undefined) // nada de caminho interno na resposta
  assert.equal(todas.json.evento.nome, 'Casamento Ana & Léo')

  const pag2 = await chamar('GET', `/api/eventos/${codigo}/album?limite=2&pagina=2`)
  assert.deepEqual(pag2.json.fotos.map((f: { numero: number }) => f.numero), [3, 4])
  assert.equal(pag2.json.total, 5)

  const minhasBeto = await chamar('GET', `/api/eventos/${codigo}/album?minhas=1`, { cab: { 'x-convidado-token': beto } })
  assert.deepEqual(minhasBeto.json.fotos.map((f: { numero: number }) => f.numero), [4, 5]) // numeração do álbum inteiro
  assert.equal(minhasBeto.json.total, 2)
  assert.equal((await chamar('GET', `/api/eventos/${codigo}/album?minhas=1`)).status, 401)
  assert.equal((await chamar('GET', `/api/eventos/${codigo}/album?minhas=1`, { cab: { 'x-convidado-token': ana } })).json.total, 3)
})

test('arquivo, miniatura (com fallback), download e fotos removidas', opcoes, async () => {
  const { codigo, ana, ids } = await cenario()
  assert.equal((await chamar('PUT', `/api/eventos/${codigo}/fotos/${ids[0]}/miniatura`, { bruto: jpeg(99, 10), cab: { 'x-convidado-token': ana } })).status, 200)
  revelar()

  const arq = await chamar('GET', `/api/eventos/${codigo}/fotos/${ids[0]}/arquivo`)
  assert.equal(arq.status, 200)
  assert.equal(arq.headers.get('content-type'), 'image/jpeg')
  assert.match(arq.headers.get('cache-control') ?? '', /private/)
  assert.deepEqual([...arq.buf], [...jpeg(1)])

  const comMiniatura = await chamar('GET', `/api/eventos/${codigo}/fotos/${ids[0]}/miniatura`)
  assert.deepEqual([...comMiniatura.buf], [...jpeg(99, 10)])
  assert.equal((await chamar('GET', `/api/eventos/${codigo}/album`)).json.fotos[0].tem_miniatura, true)

  // sem miniatura gravada, cai para a original
  const min = await chamar('GET', `/api/eventos/${codigo}/fotos/${ids[1]}/miniatura`)
  assert.equal(min.status, 200)
  assert.deepEqual([...min.buf], [...jpeg(2)])

  const baixar = await chamar('GET', `/api/eventos/${codigo}/fotos/${ids[0]}/arquivo?baixar=1`)
  assert.match(baixar.headers.get('content-disposition') ?? '', /attachment; filename="mango-/)

  assert.equal((await chamar('GET', `/api/eventos/${codigo}/fotos/nao-uuid/arquivo`)).status, 400)
  assert.equal((await chamar('GET', `/api/eventos/${codigo}/fotos/${randomUUID()}/arquivo`)).status, 404)

  await pool!.query('update fotos set removida_em = now() where id = $1', [ids[2]])
  assert.equal((await chamar('GET', `/api/eventos/${codigo}/fotos/${ids[2]}/arquivo`)).status, 404)
  assert.equal((await chamar('GET', `/api/eventos/${codigo}/album`)).json.total, 4)

  const outro = await cenario()
  revelar()
  assert.equal((await chamar('GET', `/api/eventos/${outro.codigo}/fotos/${ids[0]}/arquivo`)).status, 404) // foto de outro evento
})

test('álbum privado só abre para o anfitrião e dá para voltar atrás', opcoes, async () => {
  const { codigo, host, ids } = await cenario()
  revelar()
  assert.equal((await chamar('PATCH', `/api/anfitriao/evento`, { corpo: { album_privado: true } })).status, 401)
  assert.equal((await chamar('PATCH', `/api/anfitriao/evento`, { corpo: { album_privado: 'sim' }, cab: host })).status, 400)
  assert.equal((await chamar('PATCH', `/api/anfitriao/evento`, { corpo: { album_privado: true }, cab: host })).status, 200)

  assert.equal((await chamar('GET', `/api/eventos/${codigo}`)).json.album_privado, true)
  const lista = await chamar('GET', `/api/eventos/${codigo}/album`)
  assert.equal(lista.status, 403)
  assert.equal(lista.json.erro, 'album_privado')
  assert.equal((await chamar('GET', `/api/eventos/${codigo}/fotos/${ids[0]}/arquivo`)).status, 403)
  assert.equal((await chamar('GET', `/api/eventos/${codigo}/album`, { cab: host })).status, 200)

  await chamar('PATCH', `/api/anfitriao/evento`, { corpo: { album_privado: false }, cab: host })
  assert.equal((await chamar('GET', `/api/eventos/${codigo}/album`)).status, 200)
})

test('trocar o código derruba o link antigo e mantém o token do anfitrião', opcoes, async () => {
  const { codigo, host } = await cenario()
  assert.equal((await chamar('POST', `/api/anfitriao/evento/novo-codigo`)).status, 401)
  const r = await chamar('POST', `/api/anfitriao/evento/novo-codigo`, { cab: host })
  assert.equal(r.status, 200)
  assert.notEqual(r.json.codigo, codigo)
  assert.equal((await chamar('GET', `/api/eventos/${codigo}`)).status, 404)
  assert.equal((await chamar('GET', `/api/eventos/${r.json.codigo}`)).status, 200)
  assert.equal((await chamar('GET', `/api/anfitriao/evento`, { cab: host })).json.evento.codigo, r.json.codigo)
})

interface EntradaLida {
  nome: string
  dados: Uint8Array
  crcOk: boolean
}

/** Leitor mínimo de ZIP (diretório central) para conferir o arquivo gerado. */
function lerZip(buf: Uint8Array): EntradaLida[] {
  const v = new DataView(buf.buffer, buf.byteOffset, buf.byteLength)
  const fim = buf.length - 22
  assert.equal(v.getUint32(fim, true), 0x06054b50, 'fim do diretório central')
  const qtd = v.getUint16(fim + 10, true)
  let pos = v.getUint32(fim + 16, true)
  const entradas: EntradaLida[] = []
  for (let i = 0; i < qtd; i++) {
    assert.equal(v.getUint32(pos, true), 0x02014b50)
    const crc = v.getUint32(pos + 16, true)
    const tamanho = v.getUint32(pos + 24, true)
    const nomeLen = v.getUint16(pos + 28, true)
    const extraLen = v.getUint16(pos + 30, true)
    const comentarioLen = v.getUint16(pos + 32, true)
    const local = v.getUint32(pos + 42, true)
    const nome = new TextDecoder().decode(buf.slice(pos + 46, pos + 46 + nomeLen))
    assert.equal(v.getUint32(local, true), 0x04034b50)
    const inicioDados = local + 30 + v.getUint16(local + 26, true) + v.getUint16(local + 28, true)
    const dados = buf.slice(inicioDados, inicioDados + tamanho)
    entradas.push({ nome, dados, crcOk: crc32(dados) === crc })
    pos += 46 + nomeLen + extraLen + comentarioLen
  }
  return entradas
}

test('ZIP do anfitrião: só depois de revelado, íntegro e com nomes legíveis', opcoes, async () => {
  const { codigo, host } = await cenario()
  assert.equal((await chamar('GET', `/api/anfitriao/album.zip`)).status, 401)
  assert.equal((await chamar('GET', `/api/anfitriao/album.zip`, { cab: host })).json.erro, 'nao_revelado')

  revelar()
  const r = await chamar('GET', `/api/anfitriao/album.zip`, { cab: host })
  assert.equal(r.status, 200)
  assert.equal(r.headers.get('content-type'), 'application/zip')
  assert.match(r.headers.get('content-disposition') ?? '', /mango-Casamento-Ana-Leo\.zip/)
  const entradas = lerZip(r.buf)
  assert.deepEqual(entradas.map((e) => e.nome), ['0001-Ana-Paula.jpg', '0002-Ana-Paula.jpg', '0003-Ana-Paula.jpg', '0004-Beto.jpg', '0005-Beto.jpg'])
  assert.ok(entradas.every((e) => e.crcOk))
  assert.deepEqual([...entradas[0].dados], [...jpeg(1)])
  assert.deepEqual([...entradas[4].dados], [...jpeg(5)])
  void codigo
})

test('ZIP sem fotos dá 404 e ZIP pula arquivo que sumiu do disco', opcoes, async () => {
  const vazio = await chamar('POST', '/api/eventos', { corpo: { nome: 'Vazio', captura_inicio: h(21).toISOString(), captura_fim: h(25).toISOString() } })
  const hostVazio = { authorization: `Bearer ${vazio.json.anfitriao_token}` }
  agora = h(30)
  await chamar('POST', `/api/anfitriao/evento/revelar`, { cab: hostVazio }) // ainda captura_encerrada → revela manualmente
  agora = h(50)
  assert.equal((await chamar('GET', `/api/anfitriao/album.zip`, { cab: hostVazio })).json.erro, 'sem_fotos')

  const { host, ids } = await cenario()
  revelar()
  const chave = (await pool!.query('select chave_storage from fotos where id = $1', [ids[1]])).rows[0].chave_storage
  storage.arquivos.delete(chave)
  const r = await chamar('GET', `/api/anfitriao/album.zip`, { cab: host })
  assert.equal(r.status, 200)
  assert.equal(lerZip(r.buf).length, 4)
})

test('álbum expirado responde 410 para todos', opcoes, async () => {
  const { codigo, host } = await cenario()
  revelar()
  assert.equal((await chamar('GET', `/api/eventos/${codigo}/album`)).status, 200) // o relógio avança e revela
  agora = new Date(h(20).getTime() + 31 * 24 * 3600_000)
  const publico = await chamar('GET', `/api/eventos/${codigo}/album`)
  assert.equal(publico.status, 410)
  assert.equal(publico.json.erro, 'expirado')
  assert.equal((await chamar('GET', `/api/eventos/${codigo}/album`, { cab: host })).status, 410)
})

test('festa inteira no mesmo Wi-Fi (um IP só) com os limites padrão: nada é barrado', opcoes, async () => {
  agora = inicio
  const wifi = { 'x-forwarded-for': '200.200.200.200' }
  const criado = await chamar('POST', '/api/eventos', { corpo: { nome: 'Festa lotada', captura_inicio: h(1).toISOString(), captura_fim: h(7).toISOString() }, cab: wifi })
  const codigo = criado.json.evento.codigo as string
  agora = h(2)
  const convidados: string[] = []
  for (let i = 0; i < 10; i++) {
    const r = await chamar('POST', `/api/eventos/${codigo}/entrar`, { corpo: { apelido: `C${i}` }, cab: wifi })
    assert.equal(r.status, 201)
    convidados.push(r.json.convidado_token)
  }
  let pedidos = 0
  const status429: number[] = []
  // 10 convidados x 12 poses: foto + miniatura de cada uma, tudo pelo mesmo IP.
  await Promise.all(
    convidados.map(async (token) => {
      for (let i = 0; i < 12; i++) {
        const id = randomUUID()
        const f = await chamar('PUT', `/api/eventos/${codigo}/fotos/${id}`, { bruto: jpeg(i + 1), cab: { ...wifi, 'x-convidado-token': token } })
        const m = await chamar('PUT', `/api/eventos/${codigo}/fotos/${id}/miniatura`, { bruto: jpeg(i + 1, 10), cab: { ...wifi, 'x-convidado-token': token } })
        pedidos += 2
        for (const r of [f, m]) if (r.status === 429) status429.push(r.status)
        assert.equal(f.status, 201)
        assert.equal(m.status, 200)
      }
    }),
  )
  agora = h(20)
  const album = await chamar('GET', `/api/eventos/${codigo}/album?limite=200`, { cab: wifi })
  assert.equal(album.status, 200)
  assert.equal(album.json.total, 120)
  // Cada convidado abre o álbum e baixa todas as miniaturas, do mesmo IP.
  await Promise.all(
    convidados.map(async () => {
      for (const foto of album.json.fotos as { id: string }[]) {
        const r = await chamar('GET', `/api/eventos/${codigo}/fotos/${foto.id}/miniatura`, { cab: wifi })
        pedidos++
        if (r.status === 429) status429.push(r.status)
        assert.equal(r.status, 200)
      }
    }),
  )
  assert.ok(pedidos > 1000)
  assert.deepEqual(status429, [])
})
