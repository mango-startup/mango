// Roteiro de verificação do Stripe em MODO TESTE (sem dependência nova; Node 24 roda TypeScript).
//   cd server && STRIPE_SECRET_KEY=sk_test_... node scripts/smoke-stripe.ts
// Abre uma sessão de pagamento de teste pelo mesmo código do servidor, confere o que o Stripe devolveu,
// mostra quais formas de pagamento a sessão oferece (para saber se o Pix está ligado) e expira a sessão.
// Não cobra ninguém, não grava nada no banco e RECUSA chaves de produção.
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import Stripe from 'stripe'
import { criarProvedorStripe } from '../src/pagamento.ts'

const chave = process.env.STRIPE_SECRET_KEY ?? ''
if (!/^(sk|rk)_test_\S+$/.test(chave)) {
  throw new Error('Defina STRIPE_SECRET_KEY com uma chave de TESTE (sk_test_...). Chaves de produção são recusadas aqui.')
}

const provedor = criarProvedorStripe(chave, 'whsec_nao_usado_neste_roteiro')
const stripe = new Stripe(chave)
const eventoId = randomUUID()
let passos = 0
const ok = (nome: string) => console.log(`  ✔ ${nome}`) || passos++

const pedido = {
  eventoId,
  nomeEvento: 'Roteiro de verificação (pode ignorar)',
  nomePacote: 'Festa',
  pacoteId: 'festa',
  valorCentavos: 4900,
  successUrl: 'https://mango.exemplo.test/eventos/x/pagamento?stripe=ok',
  cancelUrl: 'https://mango.exemplo.test/eventos/x/pagamento?stripe=cancelado',
  chaveIdempotencia: `smoke-${eventoId}`,
}

const sessao = await provedor.criarSessao(pedido)
try {
  assert.match(sessao.id, /^cs_test_/)
  assert.ok(sessao.url?.startsWith('https://checkout.stripe.com/'), `url inesperada: ${sessao.url}`)
  ok('a sessão de pagamento foi criada')

  const repetida = await provedor.criarSessao(pedido)
  assert.equal(repetida.id, sessao.id)
  ok('repetir a chamada com a mesma chave devolve a mesma sessão (sem cobrança em dobro)')

  const lida = await provedor.buscarSessao(sessao.id)
  assert.equal(lida.amount_total, 4900)
  assert.equal(lida.currency, 'brl')
  assert.equal(lida.client_reference_id, eventoId)
  assert.equal(lida.payment_status, 'unpaid')
  assert.equal(lida.status, 'open')
  ok('a reconsulta confere valor (R$ 49,00), moeda (brl), evento e que ainda não foi pago')

  const completa = await stripe.checkout.sessions.retrieve(sessao.id)
  const formas = completa.payment_method_types ?? []
  console.log(`  ℹ formas de pagamento oferecidas: ${formas.join(', ') || '(nenhuma informada)'}`)
  console.log(formas.includes('pix') ? '  ℹ Pix: ligado nesta conta' : '  ℹ Pix: NÃO apareceu. Ligue em Dashboard > Configurações > Formas de pagamento (o Pix só aparece para clientes elegíveis).')
  console.log(`  ℹ para pagar de teste, abra: ${sessao.url}`)
  console.log('    cartão 4242 4242 4242 4242, validade futura e CVC qualquer; no Pix de teste use o e-mail succeed_immediately@example.com')
} finally {
  await stripe.checkout.sessions.expire(sessao.id).catch(() => {})
  ok('a sessão de teste foi expirada (limpeza)')
}
console.log(`\nOK: ${passos} verificações do Stripe em modo teste.`)
