import assert from 'node:assert/strict'
import { test } from 'node:test'
import Stripe from 'stripe'
import { lerConfig } from '../src/config.ts'
import { ErroAssinatura, criarProvedorStripe } from '../src/pagamento.ts'

// Não precisa de banco nem de rede: a assinatura é conferida localmente com o SDK oficial.
const segredo = 'whsec_teste_unitario'
const provedor = criarProvedorStripe('sk_test_nao_usada', segredo)
const sdk = new Stripe('sk_test_nao_usada')

const evento = (extra: Record<string, unknown>) => JSON.stringify({ id: 'evt_1', object: 'event', ...extra })
const assinar = (payload: string, opcoes: { secret?: string; timestamp?: number } = {}) =>
  sdk.webhooks.generateTestHeaderString({ payload, secret: opcoes.secret ?? segredo, timestamp: opcoes.timestamp })

test('assinatura válida: o evento da sessão é reduzido ao id e ao tipo', () => {
  const corpo = evento({ type: 'checkout.session.completed', data: { object: { id: 'cs_test_1', object: 'checkout.session' } } })
  assert.deepEqual(provedor.verificarEvento(Buffer.from(corpo), assinar(corpo)), { id: 'evt_1', tipo: 'checkout.session.completed', sessaoId: 'cs_test_1' })
})

test('charge.refunded: só o estorno total conta e o PaymentIntent vem como texto ou objeto', () => {
  const total = evento({ type: 'charge.refunded', data: { object: { id: 'ch_1', payment_intent: 'pi_1', refunded: true } } })
  assert.deepEqual(provedor.verificarEvento(Buffer.from(total), assinar(total)), { id: 'evt_1', tipo: 'charge.refunded', paymentIntentId: 'pi_1', estornoTotal: true })
  const parcial = evento({ type: 'charge.refunded', data: { object: { id: 'ch_1', payment_intent: { id: 'pi_2' }, refunded: false } } })
  const r = provedor.verificarEvento(Buffer.from(parcial), assinar(parcial))
  assert.equal(r.paymentIntentId, 'pi_2')
  assert.equal(r.estornoTotal, false)
})

test('evento de outro tipo passa pela assinatura mas não traz sessão', () => {
  const corpo = evento({ type: 'customer.created', data: { object: { id: 'cus_1' } } })
  assert.deepEqual(provedor.verificarEvento(Buffer.from(corpo), assinar(corpo)), { id: 'evt_1', tipo: 'customer.created' })
})

test('corpo adulterado, segredo errado, sem cabeçalho ou repetição antiga são recusados', () => {
  const corpo = evento({ type: 'checkout.session.completed', data: { object: { id: 'cs_test_1' } } })
  const valida = assinar(corpo)
  assert.throws(() => provedor.verificarEvento(Buffer.from(corpo.replace('cs_test_1', 'cs_test_2')), valida), ErroAssinatura)
  assert.throws(() => provedor.verificarEvento(Buffer.from(corpo), assinar(corpo, { secret: 'whsec_outro' })), ErroAssinatura)
  assert.throws(() => provedor.verificarEvento(Buffer.from(corpo), undefined), ErroAssinatura)
  assert.throws(() => provedor.verificarEvento(Buffer.from(corpo), ''), ErroAssinatura)
  const seisMinutosAtras = Math.floor(Date.now() / 1000) - 6 * 60
  assert.throws(() => provedor.verificarEvento(Buffer.from(corpo), assinar(corpo, { timestamp: seisMinutosAtras })), ErroAssinatura) // ataque de repetição
})

test('configuração do Stripe: sem chave o pagamento fica desligado; com chave exige o resto', () => {
  const base = { DATABASE_URL: 'postgres://x' }
  const desligado = lerConfig(base)
  assert.equal(desligado.stripeSecretKey, null)
  assert.equal(desligado.stripeWebhookSecret, null)

  const completo = lerConfig({ ...base, STRIPE_SECRET_KEY: 'sk_test_abc123', STRIPE_WEBHOOK_SECRET: 'whsec_abc', APP_URL: 'https://mango.razielhub.cloud/' })
  assert.equal(completo.appUrl, 'https://mango.razielhub.cloud') // sem a barra do fim

  assert.throws(() => lerConfig({ ...base, STRIPE_SECRET_KEY: 'sk_test_abc123', APP_URL: 'https://x.com' }), /STRIPE_WEBHOOK_SECRET/)
  assert.throws(() => lerConfig({ ...base, STRIPE_SECRET_KEY: 'sk_test_abc123', STRIPE_WEBHOOK_SECRET: 'whsec_abc' }), /APP_URL/)
  assert.throws(() => lerConfig({ ...base, STRIPE_SECRET_KEY: 'pk_test_publica', STRIPE_WEBHOOK_SECRET: 'whsec_abc', APP_URL: 'https://x.com' }), /inválida/)
  // A chave nunca aparece na mensagem de erro
  try {
    lerConfig({ ...base, STRIPE_SECRET_KEY: 'pk_test_segredo_visivel', STRIPE_WEBHOOK_SECRET: 'whsec_abc', APP_URL: 'https://x.com' })
  } catch (e) {
    assert.ok(!(e as Error).message.includes('segredo_visivel'))
  }
})
