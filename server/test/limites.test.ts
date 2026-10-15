import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { test } from 'node:test'
import { criarApp } from '../src/app.ts'
import { Limitador } from '../src/limite.ts'
import { LIMITES_PADRAO } from '../src/limites.ts'

test('Limitador: conta, recusa com tempo de espera e reabre depois da janela', () => {
  const l = new Limitador(3, 60_000)
  for (let i = 0; i < 3; i++) assert.ok(l.consumir('a', 0).permitido)
  const recusado = l.consumir('a', 10_000)
  assert.equal(recusado.permitido, false)
  assert.equal(recusado.retryEmSegundos, 50)
  assert.ok(l.consumir('b', 10_000).permitido) // outra chave não é afetada
  assert.ok(l.consumir('a', 60_001).permitido) // janela nova
})

test('Limitador: falhas só contam quando registradas e a consulta não consome', () => {
  const l = new Limitador(2, 60_000)
  assert.equal(l.espera('x', 0), 0)
  l.registrar('x', 0)
  assert.equal(l.espera('x', 1), 0)
  l.registrar('x', 2)
  assert.ok(l.espera('x', 3) > 0)
  assert.equal(l.espera('x', 61_000), 0)
})

// Banco de mentira: as rotas que respondem sem tocar no banco bastam para estes testes.
const poolFalso = {
  query: async () => ({ rows: [], rowCount: 0 }),
  connect: async () => ({ query: async () => ({ rows: [], rowCount: 0 }), release: () => {} }),
} as never

let agora = new Date('2026-11-14T18:00:00Z')
const criar = (limites = LIMITES_PADRAO) => criarApp(poolFalso, {} as never, () => agora, limites)

async function chamar(app: ReturnType<typeof criar>, metodo: string, caminho: string, cab: Record<string, string> = {}, corpo?: BodyInit) {
  const r = await app.request(caminho, { method: metodo, headers: cab, body: corpo })
  return { status: r.status, retryAfter: r.headers.get('retry-after'), json: await r.json().catch(() => null) }
}
const ip = (n: string) => ({ 'x-forwarded-for': n })

test('criar evento: 30 por hora por IP, outro IP não é afetado, e volta depois de 1 hora', async () => {
  const app = criar({ ...LIMITES_PADRAO, criarEventoPorHora: 3 })
  const corpo = '{}'
  for (let i = 0; i < 3; i++) assert.equal((await chamar(app, 'POST', '/api/eventos', ip('1.1.1.1'), corpo)).status, 400) // chega na validação
  const bloqueado = await chamar(app, 'POST', '/api/eventos', ip('1.1.1.1'), corpo)
  assert.equal(bloqueado.status, 429)
  assert.equal(bloqueado.json.erro, 'muitas_requisicoes')
  assert.ok(Number(bloqueado.retryAfter) > 0)
  assert.equal((await chamar(app, 'POST', '/api/eventos', ip('2.2.2.2'), corpo)).status, 400)
  agora = new Date(agora.getTime() + 3_600_001)
  assert.equal((await chamar(app, 'POST', '/api/eventos', ip('1.1.1.1'), corpo)).status, 400)
})

test('IP vem do fim do X-Forwarded-For (o que o Caddy escreve), então forjar o começo não adianta', async () => {
  const app = criar({ ...LIMITES_PADRAO, criarEventoPorHora: 1 })
  assert.equal((await chamar(app, 'POST', '/api/eventos', { 'x-forwarded-for': '9.9.9.9, 3.3.3.3' }, '{}')).status, 400)
  assert.equal((await chamar(app, 'POST', '/api/eventos', { 'x-forwarded-for': '8.8.8.8, 3.3.3.3' }, '{}')).status, 429)
})

test('leituras com sucesso, mesmo 400 seguidas do mesmo IP, não são barradas', async () => {
  const app = criar()
  const mesmoWifi = ip('200.1.1.1')
  const saude = await Promise.all(Array.from({ length: 400 }, () => chamar(app, 'GET', '/api/saude', mesmoWifi)))
  assert.ok(saude.every((r) => r.status === 200))
})

test('falhas 401/404 por IP: depois de 600 por minuto, barra; sucesso nunca conta', async () => {
  const app = criar({ ...LIMITES_PADRAO, falhasPorMinuto: 5 })
  const de = ip('7.7.7.7')
  for (let i = 0; i < 20; i++) assert.equal((await chamar(app, 'GET', '/api/saude', de)).status, 200) // sucessos não contam
  for (let i = 0; i < 5; i++) assert.equal((await chamar(app, 'GET', '/api/rota-que-nao-existe', de)).status, 404)
  const barrado = await chamar(app, 'GET', '/api/saude', de) // até o que seria 200 espera
  assert.equal(barrado.status, 429)
  assert.ok(Number(barrado.retryAfter) > 0)
  assert.equal((await chamar(app, 'GET', '/api/saude', ip('7.7.7.8'))).status, 200) // outro IP segue normal
  agora = new Date(agora.getTime() + 61_000)
  assert.equal((await chamar(app, 'GET', '/api/saude', de)).status, 200)
})

test('upload: limite por aparelho, não por IP (vários convidados no mesmo Wi-Fi não se atrapalham)', async () => {
  const app = criar({ ...LIMITES_PADRAO, uploadsPorMinutoPorConvidado: 3 })
  const wifi = ip('200.2.2.2')
  const put = (token: string) =>
    chamar(app, 'PUT', `/api/eventos/ABCDEFGH/fotos/${randomUUID()}`, { ...wifi, 'x-convidado-token': token, 'content-type': 'image/jpeg' }, 'x')
  for (let i = 0; i < 3; i++) assert.notEqual((await put('tokenA')).status, 429)
  const barrado = await put('tokenA')
  assert.equal(barrado.status, 429)
  assert.match(barrado.json.mensagem, /tenta de novo sozinho/)
  for (let i = 0; i < 3; i++) assert.notEqual((await put('tokenB')).status, 429) // outro convidado, mesmo IP
  assert.equal((await put('tokenB')).status, 429)
})

test('limites desligados (RATE_LIMIT=off) não barram nada', async () => {
  const app = criar(null as never)
  for (let i = 0; i < 50; i++) assert.equal((await chamar(app, 'POST', '/api/eventos', ip('5.5.5.5'), '{}')).status, 400)
})

test('limites padrão são folgados para festa', () => {
  assert.ok(LIMITES_PADRAO.uploadsPorMinutoPorConvidado >= 120) // fila offline de 36 fotos + miniaturas
  assert.ok(LIMITES_PADRAO.falhasPorMinuto >= 300)
  assert.ok(LIMITES_PADRAO.criarEventoPorHora >= 10)
})
