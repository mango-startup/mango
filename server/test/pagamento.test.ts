import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { criarApp } from '../src/app.ts'
import { criarPool } from '../src/db.ts'
import { migrar } from '../src/migracoes.ts'
import { ErroAssinatura } from '../src/pagamento.ts'
import type { EventoDoGateway, NovaSessao, ProvedorPagamento, SessaoCheckout } from '../src/pagamento.ts'
import { criarServicos } from '../src/servicos.ts'

// Precisa de um Postgres descartável: TEST_DATABASE_URL. Sem ele, os testes são pulados.
// O Stripe é substituído por um provedor falso: aqui se testa a regra do Mango (quando o evento é liberado),
// não a rede. A assinatura real do SDK é testada em pagamento-assinatura.test.ts.
const url = process.env.TEST_DATABASE_URL
const opcoes = { skip: url ? false : 'defina TEST_DATABASE_URL para testar o pagamento' }
const pool = url ? criarPool(url) : undefined

class ProvedorFalso implements ProvedorPagamento {
  sessoes = new Map<string, SessaoCheckout>()
  porChave = new Map<string, string>()
  criadas: NovaSessao[] = []
  fora = false
  quebraAoBuscar = false

  async criarSessao(n: NovaSessao) {
    if (this.fora) throw new Error('sem rede')
    const existente = this.porChave.get(n.chaveIdempotencia)
    if (existente) return { ...this.sessoes.get(existente)! }
    const id = `cs_test_${this.sessoes.size + 1}`
    const sessao: SessaoCheckout = {
      id,
      url: `https://checkout.stripe.test/${id}`,
      status: 'open',
      payment_status: 'unpaid',
      amount_total: n.valorCentavos,
      currency: 'brl',
      client_reference_id: n.eventoId,
      payment_intent: null,
    }
    this.sessoes.set(id, sessao)
    this.porChave.set(n.chaveIdempotencia, id)
    this.criadas.push(n)
    return { ...sessao }
  }

  async buscarSessao(id: string) {
    if (this.quebraAoBuscar) throw new Error('stripe fora do ar')
    const s = this.sessoes.get(id)
    if (!s) throw new Error(`sessão ${id} não existe`)
    return { ...s }
  }

  verificarEvento(corpo: Buffer, assinatura: string | undefined): EventoDoGateway {
    if (assinatura !== 'assinado') throw new ErroAssinatura()
    return JSON.parse(corpo.toString()) as EventoDoGateway
  }

  /** O cliente pagou: a sessão fica completa e paga, e passa a ter o PaymentIntent. */
  pagar(id: string, intent = `pi_${id}`) {
    Object.assign(this.sessoes.get(id)!, { status: 'complete', payment_status: 'paid', url: null, payment_intent: intent })
  }
  /** Concluiu a página (Pix gerado), mas o dinheiro ainda não entrou. */
  concluirSemPagar(id: string, intent = `pi_${id}`) {
    Object.assign(this.sessoes.get(id)!, { status: 'complete', payment_status: 'unpaid', url: null, payment_intent: intent })
  }
}

let agora = new Date('2026-11-14T18:00:00Z')
const stripe = new ProvedorFalso()
const servicos = pool ? criarServicos(pool, () => agora, { provedor: stripe, appUrl: 'https://mango.test' }) : undefined
const app = pool && servicos ? criarApp(pool, {} as never, () => agora, null, servicos) : undefined
const semGateway = pool ? criarApp(pool, {} as never, () => agora, null, criarServicos(pool, () => agora)) : undefined
const h = (horas: number) => new Date(agora.getTime() + horas * 3600_000).toISOString()

before(async () => {
  if (!pool) return
  await pool.query('drop schema public cascade; create schema public')
  await migrar(pool)
  // A migração 009 tira os pacotes fixos de venda; estes testes cobrem o caminho antigo (pedidos com `pacote`).
  await pool.query("update pacotes set ativo = true where id in ('festa', 'celebracao', 'casamento')")
  await pool.query("insert into configuracoes (chave, valor) values ('pacotes_pagos_disponiveis', 'true')")
})
after(async () => {
  await pool?.end()
})

async function chamar(metodo: string, caminho: string, corpo?: unknown, cabecalhos: Record<string, string> = {}, alvo = app) {
  assert.ok(alvo)
  const r = await alvo.request(caminho, {
    method: metodo,
    headers: { 'content-type': 'application/json', ...cabecalhos },
    body: corpo === undefined ? undefined : JSON.stringify(corpo),
  })
  const texto = await r.text()
  return { status: r.status, json: texto ? JSON.parse(texto) : null }
}

const bearer = (token: string) => ({ authorization: `Bearer ${token}` })

async function criarEvento(pacote: 'festa' | 'teste' = 'festa') {
  const r = await chamar('POST', '/api/eventos', { nome: 'Casamento da Ana', pacote, captura_inicio: h(48), captura_fim: h(54) })
  assert.equal(r.status, 201, JSON.stringify(r.json))
  await pool!.query('update eventos set criado_em = $2 where id = $1', [r.json.evento.id, agora])
  return { id: r.json.evento.id as string, token: r.json.anfitriao_token as string }
}

let contadorEventos = 0
/** Manda um evento do Stripe ao webhook, com a assinatura certa por padrão. */
async function webhook(ev: Omit<EventoDoGateway, 'id'> & { id?: string }, assinatura: string | null = 'assinado') {
  const corpo = { id: `evt_${++contadorEventos}`, ...ev }
  // `null` = sem o cabeçalho de assinatura
  const cabecalhos: Record<string, string> = assinatura === null ? {} : { 'stripe-signature': assinatura }
  return chamar('POST', '/api/stripe/webhook', corpo, cabecalhos)
}

const estadoDe = async (id: string) => (await pool!.query<{ estado: string }>('select estado from eventos where id = $1', [id])).rows[0].estado
const pagamentosDe = async (id: string) => (await pool!.query<{ status: string; valor_centavos: number; stripe_session_id: string }>('select status, valor_centavos, stripe_session_id from pagamentos where evento_id = $1 order by criado_em', [id])).rows

/** Abre a cobrança e devolve a sessão criada. */
async function abrirCobranca(ev: { id: string; token: string }) {
  const r = await chamar('POST', '/api/anfitriao/evento/pagamento', undefined, bearer(ev.token))
  assert.equal(r.status, 200, JSON.stringify(r.json))
  const [pagamento] = (await pagamentosDe(ev.id)).slice(-1)
  return { resposta: r.json, sessaoId: pagamento.stripe_session_id }
}

test('abrir a cobrança devolve a página do Stripe com o preço do pacote e reaproveita a sessão aberta', opcoes, async () => {
  const ev = await criarEvento()
  assert.equal(await estadoDe(ev.id), 'aguardando_pagamento')
  const antes = stripe.criadas.length
  const primeira = await chamar('POST', '/api/anfitriao/evento/pagamento', undefined, bearer(ev.token))
  assert.equal(primeira.status, 200)
  assert.equal(primeira.json.status, 'pendente')
  assert.match(primeira.json.url, /^https:\/\/checkout\.stripe\.test\/cs_test_/)
  assert.equal(primeira.json.reaproveitada, false)

  const criada = stripe.criadas.at(-1)!
  assert.equal(criada.valorCentavos, 4900) // pacote Festa: o preço vem do banco, não do cliente
  assert.equal(criada.eventoId, ev.id)
  assert.equal(criada.successUrl, `https://mango.test/eventos/${ev.id}/pagamento?stripe=ok`)
  assert.equal(criada.cancelUrl, `https://mango.test/eventos/${ev.id}/pagamento?stripe=cancelado`)

  const segunda = await chamar('POST', '/api/anfitriao/evento/pagamento', undefined, bearer(ev.token))
  assert.equal(segunda.json.url, primeira.json.url)
  assert.equal(segunda.json.reaproveitada, true)
  assert.equal(stripe.criadas.length, antes + 1) // uma cobrança só
  assert.equal((await pagamentosDe(ev.id)).length, 1)
  assert.equal(await estadoDe(ev.id), 'aguardando_pagamento') // abrir a cobrança não libera nada
})

test('só o dono do evento abre a cobrança, e evento grátis não tem cobrança', opcoes, async () => {
  const a = await criarEvento()
  const b = await criarEvento()
  assert.equal((await chamar('POST', '/api/anfitriao/evento/pagamento')).status, 401)
  assert.equal((await chamar('POST', '/api/anfitriao/evento/pagamento', undefined, bearer('token-qualquer'))).status, 401)
  assert.equal((await chamar('GET', '/api/anfitriao/evento/pagamento')).status, 401)
  // o token de B só enxerga o evento de B
  const rb = await chamar('POST', '/api/anfitriao/evento/pagamento', undefined, bearer(b.token))
  assert.equal(rb.status, 200)
  assert.equal((await pagamentosDe(a.id)).length, 0)

  const gratis = await criarEvento('teste')
  const r = await chamar('POST', '/api/anfitriao/evento/pagamento', undefined, bearer(gratis.token))
  assert.equal(r.status, 409)
  assert.equal(r.json.erro, 'sem_cobranca_pendente')
})

test('a situação do pagamento começa sem cobrança e passa a pendente', opcoes, async () => {
  const ev = await criarEvento()
  const antes = await chamar('GET', '/api/anfitriao/evento/pagamento', undefined, bearer(ev.token))
  assert.deepEqual(antes.json, { status: null })
  await abrirCobranca(ev)
  const depois = await chamar('GET', '/api/anfitriao/evento/pagamento', undefined, bearer(ev.token))
  assert.equal(depois.json.status, 'pendente')
  assert.equal(depois.json.valor_centavos, 4900)
  assert.equal(depois.json.estornado, false)
})

test('webhook sem assinatura ou com assinatura errada é recusado e não altera nada', opcoes, async () => {
  const ev = await criarEvento()
  const { sessaoId } = await abrirCobranca(ev)
  stripe.pagar(sessaoId)
  const falso = { id: 'evt_forjado_1', tipo: 'checkout.session.completed', sessaoId }
  const semCabecalho = await webhook(falso, null)
  assert.equal(semCabecalho.status, 400)
  assert.equal(semCabecalho.json.erro, 'assinatura_invalida')
  const errada = await webhook(falso, 'assinatura-forjada')
  assert.equal(errada.status, 400)
  assert.equal(errada.json.erro, 'assinatura_invalida')
  assert.equal(await estadoDe(ev.id), 'aguardando_pagamento')
  assert.equal((await pagamentosDe(ev.id))[0].status, 'pendente')
  // A entrega forjada não deixa rastro: o id dela não foi gravado
  assert.equal((await pool!.query('select 1 from stripe_eventos where id = $1', [falso.id])).rowCount, 0)
  // A mesma entrega com a assinatura certa é aceita (o id não foi "queimado" pela forjada)
  assert.equal((await webhook(falso)).json.resultado, 'processado')
  assert.equal(await estadoDe(ev.id), 'pronto')
})

test('pagamento confirmado libera o evento uma vez, e a mesma entrega não se repete', opcoes, async () => {
  const ev = await criarEvento()
  const { sessaoId } = await abrirCobranca(ev)
  stripe.pagar(sessaoId)

  const entrega = { id: 'evt_liberar_1', tipo: 'checkout.session.completed', sessaoId }
  const primeira = await webhook(entrega)
  assert.equal(primeira.status, 200)
  assert.equal(primeira.json.resultado, 'processado')
  assert.equal(await estadoDe(ev.id), 'pronto')
  assert.equal((await pagamentosDe(ev.id))[0].status, 'aprovado')
  const painel = await chamar('GET', '/api/anfitriao/evento/pagamento', undefined, bearer(ev.token))
  assert.equal(painel.json.status, 'aprovado')

  // O Stripe reenvia a mesma entrega: nada muda
  await pool!.query("update eventos set estado = 'captura_aberta' where id = $1", [ev.id]) // avançou depois
  const repetida = await webhook(entrega)
  assert.equal(repetida.status, 200)
  assert.equal(repetida.json.resultado, 'duplicado')
  assert.equal(await estadoDe(ev.id), 'captura_aberta')

  // Outro evento do Stripe para a mesma sessão (ex.: async_payment_succeeded): também não volta o estado
  const outra = await webhook({ tipo: 'checkout.session.async_payment_succeeded', sessaoId })
  assert.equal(outra.status, 200)
  assert.equal(await estadoDe(ev.id), 'captura_aberta')
  assert.equal((await pagamentosDe(ev.id)).length, 1)
})

test('duas entregas simultâneas do mesmo evento do Stripe aplicam uma vez só', opcoes, async () => {
  const ev = await criarEvento()
  const { sessaoId } = await abrirCobranca(ev)
  stripe.pagar(sessaoId)
  const entrega = { id: 'evt_simultaneo_1', tipo: 'checkout.session.completed', sessaoId }
  const resultados = await Promise.all([webhook(entrega), webhook(entrega), webhook(entrega)])
  assert.ok(resultados.every((r) => r.status === 200))
  assert.deepEqual(resultados.map((r) => r.json.resultado).sort(), ['duplicado', 'duplicado', 'processado'])
  assert.equal(await estadoDe(ev.id), 'pronto')
})

test('valor, moeda ou evento diferentes do que foi cobrado não liberam', opcoes, async () => {
  for (const alteracao of [{ amount_total: 100 }, { currency: 'usd' }, { client_reference_id: 'outro-evento' }]) {
    const ev = await criarEvento()
    const { sessaoId } = await abrirCobranca(ev)
    stripe.pagar(sessaoId)
    Object.assign(stripe.sessoes.get(sessaoId)!, alteracao)
    const r = await webhook({ tipo: 'checkout.session.completed', sessaoId })
    assert.equal(r.status, 200)
    assert.equal(r.json.resultado, 'ignorado', JSON.stringify(alteracao))
    assert.equal(await estadoDe(ev.id), 'aguardando_pagamento', JSON.stringify(alteracao))
    assert.equal((await pagamentosDe(ev.id))[0].status, 'pendente')
  }
})

test('Pix: a sessão completa antes do dinheiro e só libera quando o pagamento é confirmado', opcoes, async () => {
  const ev = await criarEvento()
  const { sessaoId } = await abrirCobranca(ev)
  stripe.concluirSemPagar(sessaoId)

  await webhook({ tipo: 'checkout.session.completed', sessaoId })
  assert.equal(await estadoDe(ev.id), 'aguardando_pagamento') // completou, mas não pagou
  const andamento = await chamar('POST', '/api/anfitriao/evento/pagamento', undefined, bearer(ev.token))
  assert.equal(andamento.status, 409)
  assert.equal(andamento.json.erro, 'pagamento_em_andamento')

  stripe.pagar(sessaoId)
  const r = await webhook({ tipo: 'checkout.session.async_payment_succeeded', sessaoId })
  assert.equal(r.json.resultado, 'processado')
  assert.equal(await estadoDe(ev.id), 'pronto')
})

test('pagamento recusado ou expirado deixa tentar de novo com uma sessão nova', opcoes, async () => {
  const ev = await criarEvento()
  const primeira = await abrirCobranca(ev)
  await webhook({ tipo: 'checkout.session.async_payment_failed', sessaoId: primeira.sessaoId })
  assert.equal((await chamar('GET', '/api/anfitriao/evento/pagamento', undefined, bearer(ev.token))).json.status, 'recusado')
  assert.equal(await estadoDe(ev.id), 'aguardando_pagamento')

  const segunda = await abrirCobranca(ev)
  assert.notEqual(segunda.sessaoId, primeira.sessaoId)
  stripe.sessoes.get(segunda.sessaoId)!.status = 'expired'
  await webhook({ tipo: 'checkout.session.expired', sessaoId: segunda.sessaoId })
  const status = await chamar('GET', '/api/anfitriao/evento/pagamento', undefined, bearer(ev.token))
  assert.equal(status.json.status, 'recusado') // expirado aparece como recusado: dá para tentar de novo

  const terceira = await abrirCobranca(ev)
  assert.equal(terceira.resposta.reaproveitada, false)
  stripe.pagar(terceira.sessaoId)
  await webhook({ tipo: 'checkout.session.completed', sessaoId: terceira.sessaoId })
  assert.equal(await estadoDe(ev.id), 'pronto')
  assert.deepEqual((await pagamentosDe(ev.id)).map((p) => p.status), ['recusado', 'expirado', 'aprovado'])
})

test('sessão que o Mango não criou e eventos que não trata são ignorados com 200', opcoes, async () => {
  const desconhecida = await webhook({ tipo: 'checkout.session.completed', sessaoId: 'cs_de_outro_produto' })
  assert.equal(desconhecida.status, 200)
  assert.equal(desconhecida.json.resultado, 'ignorado')
  const outro = await webhook({ tipo: 'customer.created' })
  assert.equal(outro.status, 200)
  assert.equal(outro.json.resultado, 'ignorado')
})

test('estorno total cancela o evento sem fotos; com fotos o evento continua', opcoes, async () => {
  // sem fotos
  const a = await criarEvento()
  const sa = await abrirCobranca(a)
  stripe.pagar(sa.sessaoId, 'pi_estorno_a')
  await webhook({ tipo: 'checkout.session.completed', sessaoId: sa.sessaoId })
  assert.equal(await estadoDe(a.id), 'pronto')
  const parcial = await webhook({ tipo: 'charge.refunded', paymentIntentId: 'pi_estorno_a', estornoTotal: false })
  assert.equal(parcial.json.resultado, 'ignorado') // estorno parcial não mexe no evento
  assert.equal(await estadoDe(a.id), 'pronto')
  const total = await webhook({ tipo: 'charge.refunded', paymentIntentId: 'pi_estorno_a', estornoTotal: true })
  assert.equal(total.json.resultado, 'processado')
  assert.equal(await estadoDe(a.id), 'cancelado')
  const statusA = await chamar('GET', '/api/anfitriao/evento/pagamento', undefined, bearer(a.token))
  assert.equal(statusA.json.estornado, true)

  // com fotos
  const b = await criarEvento()
  const sb = await abrirCobranca(b)
  stripe.pagar(sb.sessaoId, 'pi_estorno_b')
  await webhook({ tipo: 'checkout.session.completed', sessaoId: sb.sessaoId })
  const conv = await pool!.query<{ id: string }>("insert into convidados (evento_id, token_hash) values ($1, 'hash-estorno-b') returning id", [b.id])
  await pool!.query("insert into fotos (evento_id, convidado_id, chave_storage, tipo_mime, tamanho_bytes) values ($1, $2, 'estorno-b.jpg', 'image/jpeg', 100)", [b.id, conv.rows[0].id])
  await webhook({ tipo: 'charge.refunded', paymentIntentId: 'pi_estorno_b', estornoTotal: true })
  assert.equal(await estadoDe(b.id), 'pronto') // já tinha foto: decisão humana
  assert.equal((await pagamentosDe(b.id))[0].status, 'estornado')
})

test('dinheiro recebido por um evento que já foi apagado vira pagamento órfão', opcoes, async () => {
  const ev = await criarEvento()
  const { sessaoId } = await abrirCobranca(ev)
  await chamar('DELETE', '/api/anfitriao/evento', undefined, bearer(ev.token))
  stripe.pagar(sessaoId)
  const r = await webhook({ tipo: 'checkout.session.completed', sessaoId })
  assert.equal(r.status, 200)
  assert.equal((await pagamentosDe(ev.id))[0].status, 'aprovado_orfao')
  assert.notEqual(await estadoDe(ev.id), 'pronto')
})

test('falha ao reconsultar o Stripe devolve 500 sem gravar o evento, e a repetição funciona', opcoes, async () => {
  const ev = await criarEvento()
  const { sessaoId } = await abrirCobranca(ev)
  stripe.pagar(sessaoId)
  const entrega = { id: 'evt_repetir_1', tipo: 'checkout.session.completed', sessaoId }

  stripe.quebraAoBuscar = true
  const falha = await webhook(entrega)
  stripe.quebraAoBuscar = false
  assert.equal(falha.status, 500)
  assert.equal(await estadoDe(ev.id), 'aguardando_pagamento')
  assert.equal((await pool!.query('select 1 from stripe_eventos where id = $1', [entrega.id])).rowCount, 0) // não ficou registrado

  const repeticao = await webhook(entrega)
  assert.equal(repeticao.status, 200)
  assert.equal(repeticao.json.resultado, 'processado')
  assert.equal(await estadoDe(ev.id), 'pronto')
})

test('Stripe fora do ar vira 503 amigável, e sem gateway configurado o pagamento fica desligado', opcoes, async () => {
  const ev = await criarEvento()
  stripe.fora = true
  const fora = await chamar('POST', '/api/anfitriao/evento/pagamento', undefined, bearer(ev.token))
  stripe.fora = false
  assert.equal(fora.status, 503)
  assert.equal(fora.json.erro, 'pagamento_indisponivel')
  assert.ok(!JSON.stringify(fora.json).includes('sem rede')) // o detalhe técnico não vaza
  assert.equal((await pagamentosDe(ev.id)).length, 0)

  const iniciar = await chamar('POST', '/api/anfitriao/evento/pagamento', undefined, bearer(ev.token), semGateway)
  assert.equal(iniciar.status, 503)
  const status = await chamar('GET', '/api/anfitriao/evento/pagamento', undefined, bearer(ev.token), semGateway)
  assert.deepEqual(status.json, { status: null })
  const hook = await chamar('POST', '/api/stripe/webhook', {}, { 'stripe-signature': 'assinado' }, semGateway)
  assert.equal(hook.status, 503)
})
