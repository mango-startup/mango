import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { avancarEstados } from '../src/agendador.ts'
import { criarApp } from '../src/app.ts'
import { criarPool } from '../src/db.ts'
import { migrar } from '../src/migracoes.ts'

// Precisa de um Postgres descartável: TEST_DATABASE_URL. Sem ele, os testes são pulados.
const url = process.env.TEST_DATABASE_URL
const opcoes = { skip: url ? false : 'defina TEST_DATABASE_URL para testar eventos' }
const pool = url ? criarPool(url) : undefined

let agora = new Date('2026-11-14T18:00:00Z')
const app = pool ? criarApp(pool, () => agora) : undefined
const h = (horas: number) => new Date(agora.getTime() + horas * 3600_000).toISOString()

before(async () => {
  if (!pool) return
  await pool.query('drop schema public cascade; create schema public')
  await migrar(pool)
})
after(async () => {
  await pool?.end()
})

async function chamar(metodo: string, caminho: string, corpo?: unknown, cabecalhos: Record<string, string> = {}) {
  assert.ok(app)
  const r = await app.request(caminho, {
    method: metodo,
    headers: { 'content-type': 'application/json', ...cabecalhos },
    body: corpo === undefined ? undefined : JSON.stringify(corpo),
  })
  const texto = await r.text()
  return { status: r.status, json: texto ? JSON.parse(texto) : null }
}

async function criarEvento(extra: Record<string, unknown> = {}) {
  const r = await chamar('POST', '/api/eventos', { nome: 'Festa da Ana', captura_inicio: h(1), captura_fim: h(7), ...extra })
  assert.equal(r.status, 201, JSON.stringify(r.json))
  return { codigo: r.json.evento.codigo as string, token: r.json.anfitriao_token as string, evento: r.json.evento }
}

test('criar evento grátis nasce pronto e devolve o token do anfitrião uma vez', opcoes, async () => {
  const { codigo, token, evento } = await criarEvento()
  assert.match(codigo, /^[A-Z2-9]{8}$/)
  assert.ok(token.length > 20)
  assert.equal(evento.estado, 'pronto')
  assert.equal(evento.limite_convidados, 10)
  assert.equal(evento.limite_fotos, 120) // 10 convidados x 12 poses
  const [linha] = (await pool!.query('select anfitriao_token_hash from eventos where codigo = $1', [codigo])).rows
  assert.notEqual(linha.anfitriao_token_hash, token) // só o hash fica no banco
})

test('pacote pago fica aguardando pagamento', opcoes, async () => {
  const { evento } = await criarEvento({ pacote: 'festa' })
  assert.equal(evento.estado, 'aguardando_pagamento')
  assert.equal(evento.limite_convidados, 30)
})

test('validações da criação', opcoes, async () => {
  const base = { nome: 'X', captura_inicio: h(1), captura_fim: h(7) }
  for (const [corpo, erro] of [
    [{ ...base, nome: '' }, 'nome_invalido'],
    [{ ...base, pacote: 'grande' }, 'pacote_invalido'],
    [{ ...base, poses_por_convidado: 24, pacote: 'teste' }, 'poses_invalidas'],
    [{ ...base, captura_fim: h(60) }, 'periodo_longo'],
    [{ ...base, captura_fim: h(0.5) }, 'periodo_invalido'],
    [{ ...base, captura_inicio: h(-10), captura_fim: h(-5) }, 'fim_no_passado'],
    [{ ...base, revelacao_em: h(7 + 24 * 8) }, 'revelacao_fora_do_prazo'],
  ] as const) {
    const r = await chamar('POST', '/api/eventos', corpo)
    assert.equal(r.status, 400)
    assert.equal(r.json.erro, erro)
  }
  assert.equal((await chamar('POST', '/api/eventos', 'lixo' as never)).status, 400)
})

test('estado público não vaza dados do anfitrião e 404 para código desconhecido', opcoes, async () => {
  const { codigo } = await criarEvento()
  const r = await chamar('GET', `/api/eventos/${codigo.toLowerCase()}`)
  assert.equal(r.status, 200)
  assert.equal(r.json.nome, 'Festa da Ana')
  assert.equal(r.json.lotado, false)
  assert.equal(r.json.anfitriao_token_hash, undefined)
  assert.equal(r.json.codigo, undefined)
  assert.equal((await chamar('GET', '/api/eventos/ZZZZZZZZ')).status, 404)
})

test('convidado só entra com a câmera aberta, recebe token e reentra com o mesmo', opcoes, async () => {
  const { codigo } = await criarEvento()
  const antes = await chamar('POST', `/api/eventos/${codigo}/entrar`, {})
  assert.equal(antes.status, 409)
  assert.equal(antes.json.erro, 'captura_fechada')

  agora = new Date(agora.getTime() + 2 * 3600_000) // passou o início
  const entrou = await chamar('POST', `/api/eventos/${codigo}/entrar`, { apelido: ' Marina ' })
  assert.equal(entrou.status, 201)
  assert.equal(entrou.json.apelido, 'Marina')
  assert.equal(entrou.json.poses_restantes, 12)

  const de_novo = await chamar('POST', `/api/eventos/${codigo}/entrar`, {}, { 'x-convidado-token': entrou.json.convidado_token })
  assert.equal(de_novo.status, 200)
  assert.equal(de_novo.json.convidado_id, entrou.json.convidado_id)
  assert.equal(de_novo.json.convidado_token, undefined)
  agora = new Date(agora.getTime() - 2 * 3600_000)
})

test('limite de convidados é imposto no servidor, inclusive em paralelo', opcoes, async () => {
  const { codigo } = await criarEvento() // teste = 10 convidados
  agora = new Date(agora.getTime() + 2 * 3600_000)
  const rs = await Promise.all(Array.from({ length: 14 }, () => chamar('POST', `/api/eventos/${codigo}/entrar`, {})))
  assert.equal(rs.filter((r) => r.status === 201).length, 10)
  assert.equal(rs.filter((r) => r.json.erro === 'lotado').length, 4)
  assert.equal((await chamar('GET', `/api/eventos/${codigo}`)).json.lotado, true)
  agora = new Date(agora.getTime() - 2 * 3600_000)
})

test('anfitrião: sem token ou com token errado é 401; encerra e revela só na ordem certa', opcoes, async () => {
  const { codigo, token } = await criarEvento()
  assert.equal((await chamar('GET', '/api/anfitriao/evento')).status, 401)
  assert.equal((await chamar('GET', '/api/anfitriao/evento', undefined, { authorization: 'Bearer errado' })).status, 401)
  const auth = { authorization: `Bearer ${token}` }

  assert.equal((await chamar('POST', '/api/anfitriao/evento/encerrar', undefined, auth)).json.erro, 'transicao_invalida')

  agora = new Date(agora.getTime() + 2 * 3600_000) // câmera abre
  await chamar('POST', `/api/eventos/${codigo}/entrar`, {})
  const painel = await chamar('GET', '/api/anfitriao/evento', undefined, auth)
  assert.equal(painel.json.evento.estado, 'captura_aberta')
  assert.equal(painel.json.convidados, 1)

  assert.equal((await chamar('POST', '/api/anfitriao/evento/revelar', undefined, auth)).status, 409)
  const enc = await chamar('POST', '/api/anfitriao/evento/encerrar', undefined, auth)
  assert.equal(enc.json.evento.estado, 'captura_encerrada')
  assert.equal((await chamar('POST', `/api/eventos/${codigo}/entrar`, {})).json.erro, 'captura_fechada')

  const rev = await chamar('POST', '/api/anfitriao/evento/revelar', undefined, auth)
  assert.equal(rev.json.evento.estado, 'revelado')
  assert.ok(rev.json.evento.expira_em)
  agora = new Date(agora.getTime() - 2 * 3600_000)
})

test('agendador avança pelo relógio e é idempotente', opcoes, async () => {
  const { codigo } = await criarEvento()
  const estado = async () => (await chamar('GET', `/api/eventos/${codigo}`)).json.estado
  const original = agora
  assert.equal(await estado(), 'pronto')
  agora = new Date(original.getTime() + 3 * 3600_000)
  assert.equal(await estado(), 'captura_aberta')
  agora = new Date(original.getTime() + 8 * 3600_000) // depois do fim (+7h), antes da revelação (+19h)
  assert.equal(await estado(), 'captura_encerrada')
  agora = new Date(original.getTime() + 20 * 3600_000)
  assert.equal(await estado(), 'revelado')
  await avancarEstados(pool!, agora)
  await avancarEstados(pool!, agora)
  assert.equal(await estado(), 'revelado')
  agora = new Date(original.getTime() + 20 * 3600_000 + 31 * 24 * 3600_000)
  assert.equal(await estado(), 'expirado')
  agora = original
})

test('revelação manual não revela sozinha; excluir tira o evento do ar', opcoes, async () => {
  const { codigo, token } = await criarEvento({ revelacao_manual: true })
  const original = agora
  agora = new Date(original.getTime() + 24 * 3600_000)
  assert.equal((await chamar('GET', `/api/eventos/${codigo}`)).json.estado, 'captura_encerrada')
  const del = await chamar('DELETE', '/api/anfitriao/evento', undefined, { authorization: `Bearer ${token}` })
  assert.equal(del.status, 204)
  assert.equal((await chamar('GET', `/api/eventos/${codigo}`)).status, 404)
  assert.equal((await chamar('GET', '/api/anfitriao/evento', undefined, { authorization: `Bearer ${token}` })).status, 401)
  agora = original
})
