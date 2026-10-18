import { Hono } from 'hono'
import { bodyLimit } from 'hono/body-limit'
import type { Pool } from 'pg'
import { ErroAssinatura, ErroPagamento } from '../pagamento.ts'
import type { Servicos } from '../servicos.ts'
import { criarAcesso } from './acesso.ts'
import { erro } from './util.ts'

/** Pagamento do pacote com o Stripe (ver server/src/pagamento.ts e docs/PAGAMENTO-STRIPE.md). */
export function rotasPagamento(pool: Pool, servicos: Servicos): Hono {
  const app = new Hono()
  const { anfitriao } = criarAcesso(pool, servicos)

  // O anfitrião abre a cobrança e recebe a página de pagamento do Stripe. Repetir reaproveita a sessão aberta.
  app.post('/api/anfitriao/evento/pagamento', async (c) => {
    const e = await anfitriao(c)
    if (!e) return erro(c, 401, 'nao_autorizado', 'Token do anfitrião inválido.')
    const pagamento = servicos.pagamento
    if (!pagamento) return erro(c, 503, 'pagamento_indisponivel', 'O pagamento ainda não está disponível.')
    try {
      const { url, reaproveitada } = await pagamento.iniciar(e.id)
      return c.json({ status: 'pendente', url, reaproveitada })
    } catch (falha) {
      if (falha instanceof ErroPagamento) return erro(c, falha.status, falha.codigo, falha.message, falha.extra)
      throw falha
    }
  })

  // Situação do pagamento mais recente: a tela de pagamento consulta enquanto espera o webhook.
  app.get('/api/anfitriao/evento/pagamento', async (c) => {
    const e = await anfitriao(c)
    if (!e) return erro(c, 401, 'nao_autorizado', 'Token do anfitrião inválido.')
    const pagamento = servicos.pagamento
    if (!pagamento) return c.json({ status: null })
    return c.json(await pagamento.status(e.id))
  })

  // Quem chama é o Stripe. A assinatura é conferida sobre o corpo BRUTO; sem ela, nada é lido nem alterado.
  app.post(
    '/api/stripe/webhook',
    bodyLimit({ maxSize: 512 * 1024, onError: (c) => erro(c, 400, 'corpo_grande', 'Corpo grande demais.') }),
    async (c) => {
      const pagamento = servicos.pagamento
      if (!pagamento) return erro(c, 503, 'pagamento_indisponivel', 'O pagamento não está configurado.')
      const corpo = Buffer.from(await c.req.arrayBuffer())
      let evento
      try {
        evento = pagamento.verificar(corpo, c.req.header('stripe-signature'))
      } catch (falha) {
        if (falha instanceof ErroAssinatura) return erro(c, 400, 'assinatura_invalida', 'Assinatura inválida.')
        throw falha
      }
      try {
        const resultado = await pagamento.processar(evento)
        return c.json({ recebido: true, resultado })
      } catch (falha) {
        // 500: o Stripe repete a entrega por até três dias. O id do evento não foi gravado (transação desfeita).
        console.error(JSON.stringify({ origem: 'pagamento', nivel: 'error', aviso: 'webhook_falhou', stripe_evento: evento.id, tipo: evento.tipo, mensagem: (falha as Error).message }))
        return c.json({ erro: 'falha_ao_processar', mensagem: 'Não deu para processar o evento agora.' }, 500)
      }
    },
  )

  return app
}
