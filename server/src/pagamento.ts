import Stripe from 'stripe'
import type { Pool, PoolClient } from 'pg'
import type { ServicoPacotes } from './pacotes.ts'

// Pagamento dos pacotes com o Stripe Checkout (página hospedada: nenhum dado de cartão passa por aqui).
// Regra central: o evento só sai de "aguardando pagamento" pelo WEBHOOK assinado, depois de reconsultar a sessão
// no Stripe e conferir valor, moeda e evento. O retorno do navegador (success_url) não libera nada.

export type StatusBanco = 'pendente' | 'aprovado' | 'recusado' | 'expirado' | 'estornado' | 'aprovado_orfao'
/** O que o front enxerga: três estados. */
export type StatusPublico = 'pendente' | 'aprovado' | 'recusado'

export interface SessaoCheckout {
  id: string
  /** Só existe enquanto a sessão está aberta. */
  url: string | null
  /** `open`, `complete` ou `expired` (o Stripe pode acrescentar valores novos: comparar só com os conhecidos). */
  status: string | null
  /** `paid`, `unpaid` ou `no_payment_required`. */
  payment_status: string | null
  amount_total: number | null
  currency: string | null
  client_reference_id: string | null
  payment_intent: string | null
}

/** O evento do gateway já reduzido ao que o servidor usa. */
export interface EventoDoGateway {
  id: string
  tipo: string
  sessaoId?: string
  paymentIntentId?: string
  /** `charge.refunded`: a cobrança foi estornada por inteiro. */
  estornoTotal?: boolean
}

export interface NovaSessao {
  eventoId: string
  nomeEvento: string
  nomePacote: string
  pacoteId: string
  valorCentavos: number
  successUrl: string
  cancelUrl: string
  /** Mesma chave = mesma sessão: repetir a chamada não cria cobrança em dobro. */
  chaveIdempotencia: string
}

export class ErroAssinatura extends Error {
  constructor() {
    super('Assinatura do webhook inválida.')
    this.name = 'ErroAssinatura'
  }
}

export interface ProvedorPagamento {
  criarSessao(nova: NovaSessao): Promise<SessaoCheckout>
  buscarSessao(id: string): Promise<SessaoCheckout>
  /** Confere a assinatura do corpo bruto. Lança ErroAssinatura se não bater. */
  verificarEvento(corpo: Buffer, assinatura: string | undefined): EventoDoGateway
}

/** Tipos de evento que o endpoint do webhook precisa receber (configurar no Dashboard do Stripe). */
export const EVENTOS_DO_STRIPE = [
  'checkout.session.completed',
  'checkout.session.async_payment_succeeded',
  'checkout.session.async_payment_failed',
  'checkout.session.expired',
  'charge.refunded',
] as const

function paraSessao(s: Stripe.Checkout.Session): SessaoCheckout {
  const pi = s.payment_intent
  return {
    id: s.id,
    url: s.url ?? null,
    status: s.status ?? null,
    payment_status: s.payment_status ?? null,
    amount_total: s.amount_total ?? null,
    currency: s.currency ?? null,
    client_reference_id: s.client_reference_id ?? null,
    payment_intent: typeof pi === 'string' ? pi : (pi?.id ?? null),
  }
}

const idDe = (v: unknown): string | undefined => (typeof v === 'string' ? v : v && typeof v === 'object' && 'id' in v ? String((v as { id: unknown }).id) : undefined)

/** Provedor real. A chave e o segredo vêm do ambiente e nunca vão para log nem para o repositório. */
export function criarProvedorStripe(chaveSecreta: string, segredoWebhook: string): ProvedorPagamento {
  const stripe = new Stripe(chaveSecreta, { maxNetworkRetries: 2, timeout: 15_000 })
  return {
    async criarSessao(n) {
      const sessao = await stripe.checkout.sessions.create(
        {
          mode: 'payment',
          // Sem payment_method_types: o Stripe mostra as formas ativas no Dashboard (cartão e, se habilitado, Pix).
          client_reference_id: n.eventoId,
          metadata: { evento_id: n.eventoId, pacote: n.pacoteId },
          line_items: [
            {
              quantity: 1,
              price_data: {
                currency: 'brl',
                unit_amount: n.valorCentavos,
                product_data: { name: `Mango · pacote ${n.nomePacote}`.slice(0, 120), description: n.nomeEvento.slice(0, 200) },
              },
            },
          ],
          payment_intent_data: { description: `Mango · ${n.nomeEvento}`.slice(0, 300), metadata: { evento_id: n.eventoId } },
          locale: 'pt-BR',
          success_url: n.successUrl,
          cancel_url: n.cancelUrl,
        },
        { idempotencyKey: n.chaveIdempotencia },
      )
      return paraSessao(sessao)
    },

    async buscarSessao(id) {
      return paraSessao(await stripe.checkout.sessions.retrieve(id))
    },

    verificarEvento(corpo, assinatura) {
      if (!assinatura) throw new ErroAssinatura()
      let ev: Stripe.Event
      try {
        ev = stripe.webhooks.constructEvent(corpo, assinatura, segredoWebhook)
      } catch {
        throw new ErroAssinatura()
      }
      const objeto = ev.data.object as unknown as { id?: string; payment_intent?: unknown; refunded?: boolean }
      if (ev.type.startsWith('checkout.session.')) return { id: ev.id, tipo: ev.type, sessaoId: objeto.id }
      if (ev.type === 'charge.refunded') {
        return { id: ev.id, tipo: ev.type, paymentIntentId: idDe(objeto.payment_intent), estornoTotal: objeto.refunded === true }
      }
      return { id: ev.id, tipo: ev.type }
    },
  }
}

export class ErroPagamento extends Error {
  status: 409 | 503
  codigo: string
  extra: Record<string, unknown>
  constructor(status: 409 | 503, codigo: string, mensagem: string, extra: Record<string, unknown> = {}) {
    super(mensagem)
    this.name = 'ErroPagamento'
    this.status = status
    this.codigo = codigo
    this.extra = extra
  }
}

interface LinhaPagamento {
  id: string
  evento_id: string
  stripe_session_id: string
  valor_centavos: number
  status: StatusBanco
}

const PUBLICO: Record<StatusBanco, StatusPublico> = {
  pendente: 'pendente',
  aprovado: 'aprovado',
  aprovado_orfao: 'aprovado',
  estornado: 'aprovado',
  recusado: 'recusado',
  expirado: 'recusado',
}

export interface OpcoesServico {
  pool: Pool
  provedor: ProvedorPagamento
  pacotes: ServicoPacotes
  /** Endereço público do site, sem barra no fim. */
  appUrl: string
  agora?: () => Date
  /** Linha de log estruturada (padrão: console). Nunca recebe chave nem corpo de requisição. */
  log?: (nivel: 'info' | 'warn' | 'error', dados: Record<string, unknown>) => void
}

export class ServicoPagamento {
  private pool: Pool
  private provedor: ProvedorPagamento
  private pacotes: ServicoPacotes
  private appUrl: string
  private agora: () => Date
  private log: (nivel: 'info' | 'warn' | 'error', dados: Record<string, unknown>) => void

  constructor(o: OpcoesServico) {
    this.pool = o.pool
    this.provedor = o.provedor
    this.pacotes = o.pacotes
    this.appUrl = o.appUrl
    this.agora = o.agora ?? (() => new Date())
    this.log = o.log ?? ((nivel, dados) => console[nivel === 'info' ? 'log' : nivel](JSON.stringify({ origem: 'pagamento', nivel, ...dados })))
  }

  verificar(corpo: Buffer, assinatura: string | undefined): EventoDoGateway {
    return this.provedor.verificarEvento(corpo, assinatura)
  }

  /** Abre a cobrança do evento e devolve a página de pagamento. Reaproveita a sessão aberta, se houver. */
  async iniciar(eventoId: string): Promise<{ url: string; reaproveitada: boolean }> {
    const evento = (
      await this.pool.query<{ id: string; nome: string; estado: string; pacote: string }>(
        'select id, nome, estado, pacote from eventos where id = $1 and excluido_em is null',
        [eventoId],
      )
    ).rows[0]
    if (!evento) throw new ErroPagamento(409, 'nao_encontrado', 'Evento não encontrado.')
    if (evento.estado !== 'aguardando_pagamento' && evento.estado !== 'rascunho') {
      throw new ErroPagamento(409, 'sem_cobranca_pendente', 'Este evento não está aguardando pagamento.', { estado: evento.estado })
    }
    const pacote = await this.pacotes.obter(evento.pacote)
    if (!pacote || pacote.gratis || pacote.preco_centavos <= 0) throw new ErroPagamento(409, 'pacote_gratis', 'Este pacote não tem cobrança.')

    const anteriores = (
      await this.pool.query<LinhaPagamento>('select id, evento_id, stripe_session_id, valor_centavos, status from pagamentos where evento_id = $1 order by criado_em desc', [evento.id])
    ).rows
    const ultima = anteriores[0]
    if (ultima?.status === 'pendente') {
      const aberta = await this.consultar(ultima.stripe_session_id)
      if (aberta.status === 'open' && aberta.url) return { url: aberta.url, reaproveitada: true }
      if (aberta.status === 'expired') await this.pool.query("update pagamentos set status = 'expirado', atualizado_em = $2 where id = $1 and status = 'pendente'", [ultima.id, this.agora()])
      else if (aberta.status === 'complete') {
        // O cliente já concluiu a página (Pix gerado, aguardando o banco): não dá para reabrir. Espera o Stripe avisar.
        throw new ErroPagamento(409, 'pagamento_em_andamento', 'Seu pagamento ainda está aguardando a confirmação. Se o Pix expirou, tente de novo em alguns minutos.')
      }
    }

    const sessao = await this.chamar(() =>
      this.provedor.criarSessao({
        eventoId: evento.id,
        nomeEvento: evento.nome,
        nomePacote: pacote.nome,
        pacoteId: pacote.id,
        valorCentavos: pacote.preco_centavos,
        successUrl: `${this.appUrl}/eventos/${evento.id}/pagamento?stripe=ok`,
        cancelUrl: `${this.appUrl}/eventos/${evento.id}/pagamento?stripe=cancelado`,
        chaveIdempotencia: `mango-checkout-${evento.id}-${anteriores.length + 1}`,
      }),
    )
    if (!sessao.url) throw new ErroPagamento(503, 'pagamento_indisponivel', 'Não foi possível abrir a página de pagamento. Tente de novo.')
    await this.pool.query(
      `insert into pagamentos (evento_id, stripe_session_id, valor_centavos, moeda) values ($1, $2, $3, 'brl')
       on conflict (stripe_session_id) do nothing`,
      [evento.id, sessao.id, pacote.preco_centavos],
    )
    return { url: sessao.url, reaproveitada: false }
  }

  /** Situação do pagamento mais recente do evento. */
  async status(eventoId: string): Promise<{ status: StatusPublico | null; valor_centavos?: number; estornado?: boolean }> {
    const p = (
      await this.pool.query<LinhaPagamento>('select id, evento_id, stripe_session_id, valor_centavos, status from pagamentos where evento_id = $1 order by criado_em desc limit 1', [eventoId])
    ).rows[0]
    if (!p) return { status: null }
    return { status: PUBLICO[p.status], valor_centavos: p.valor_centavos, estornado: p.status === 'estornado' }
  }

  /**
   * Aplica um evento do Stripe. Tudo numa transação: se algo falhar, o id do evento não fica registrado
   * e o Stripe repete a entrega. O mesmo id nunca é aplicado duas vezes.
   */
  async processar(ev: EventoDoGateway): Promise<'processado' | 'duplicado' | 'ignorado'> {
    const cliente = await this.pool.connect()
    try {
      await cliente.query('begin')
      const novo = await cliente.query('insert into stripe_eventos (id, tipo) values ($1, $2) on conflict (id) do nothing returning id', [ev.id, ev.tipo])
      if (!novo.rowCount) {
        await cliente.query('rollback')
        return 'duplicado'
      }
      const resultado = await this.aplicar(cliente, ev)
      await cliente.query('commit')
      return resultado
    } catch (e) {
      await cliente.query('rollback').catch(() => {})
      throw e
    } finally {
      cliente.release()
    }
  }

  private async aplicar(cliente: PoolClient, ev: EventoDoGateway): Promise<'processado' | 'ignorado'> {
    switch (ev.tipo) {
      case 'checkout.session.completed':
      case 'checkout.session.async_payment_succeeded':
        return ev.sessaoId ? this.aplicarSessao(cliente, ev.id, ev.sessaoId) : 'ignorado'
      case 'checkout.session.async_payment_failed':
        return ev.sessaoId ? this.marcar(cliente, ev.sessaoId, 'recusado') : 'ignorado'
      case 'checkout.session.expired':
        return ev.sessaoId ? this.marcar(cliente, ev.sessaoId, 'expirado') : 'ignorado'
      case 'charge.refunded':
        return ev.paymentIntentId && ev.estornoTotal ? this.aplicarEstorno(cliente, ev.paymentIntentId) : 'ignorado'
      default:
        return 'ignorado'
    }
  }

  private async aplicarSessao(cliente: PoolClient, eventoStripe: string, sessaoId: string): Promise<'processado' | 'ignorado'> {
    const pag = (
      await cliente.query<LinhaPagamento>('select id, evento_id, stripe_session_id, valor_centavos, status from pagamentos where stripe_session_id = $1 for update', [sessaoId])
    ).rows[0]
    if (!pag) {
      this.log('warn', { aviso: 'sessao_desconhecida', stripe_evento: eventoStripe, sessao: sessaoId })
      return 'ignorado'
    }
    // Reconsulta no Stripe: o corpo do webhook não é a fonte da verdade do valor nem do estado do pagamento.
    const sessao = await this.provedor.buscarSessao(sessaoId)
    if (sessao.client_reference_id !== pag.evento_id || sessao.amount_total !== pag.valor_centavos || sessao.currency !== 'brl') {
      this.log('error', { aviso: 'pagamento_divergente', stripe_evento: eventoStripe, sessao: sessaoId, evento: pag.evento_id, esperado: pag.valor_centavos, recebido: sessao.amount_total, moeda: sessao.currency })
      return 'ignorado'
    }
    if (sessao.payment_intent) {
      await cliente.query('update pagamentos set stripe_payment_intent_id = $2, atualizado_em = $3 where id = $1', [pag.id, sessao.payment_intent, this.agora()])
    }
    // Pix e outras formas com confirmação tardia: a sessão completa antes do dinheiro entrar.
    if (sessao.payment_status !== 'paid') return 'processado'
    if (pag.status === 'aprovado' || pag.status === 'estornado' || pag.status === 'aprovado_orfao') return 'processado'

    await cliente.query("update pagamentos set status = 'aprovado', atualizado_em = $2 where id = $1", [pag.id, this.agora()])
    const liberado = await cliente.query(
      `update eventos set estado = 'pronto', atualizado_em = $2
       where id = $1 and estado in ('aguardando_pagamento', 'rascunho') and excluido_em is null returning id`,
      [pag.evento_id, this.agora()],
    )
    if (!liberado.rowCount) {
      const e = (await cliente.query<{ estado: string; excluido_em: Date | null }>('select estado, excluido_em from eventos where id = $1', [pag.evento_id])).rows[0]
      if (!e || e.excluido_em || e.estado === 'cancelado' || e.estado === 'expirado') {
        // Dinheiro recebido por um evento que não existe mais (apagado antes de pagar): precisa de estorno manual.
        await cliente.query("update pagamentos set status = 'aprovado_orfao', atualizado_em = $2 where id = $1", [pag.id, this.agora()])
        this.log('error', { aviso: 'pagamento_sem_evento', stripe_evento: eventoStripe, sessao: sessaoId, evento: pag.evento_id, valor_centavos: pag.valor_centavos })
      }
    }
    return 'processado'
  }

  private async marcar(cliente: PoolClient, sessaoId: string, status: 'recusado' | 'expirado'): Promise<'processado' | 'ignorado'> {
    const r = await cliente.query("update pagamentos set status = $2, atualizado_em = $3 where stripe_session_id = $1 and status = 'pendente' returning id", [sessaoId, status, this.agora()])
    return r.rowCount ? 'processado' : 'ignorado'
  }

  private async aplicarEstorno(cliente: PoolClient, paymentIntentId: string): Promise<'processado' | 'ignorado'> {
    const pag = (
      await cliente.query<LinhaPagamento>('select id, evento_id, stripe_session_id, valor_centavos, status from pagamentos where stripe_payment_intent_id = $1 for update', [paymentIntentId])
    ).rows[0]
    if (!pag) return 'ignorado'
    await cliente.query("update pagamentos set status = 'estornado', atualizado_em = $2 where id = $1", [pag.id, this.agora()])
    // Estorno antes da primeira foto cancela o evento. Com fotos, o dinheiro voltou mas o evento segue: decisão humana.
    const cancelado = await cliente.query(
      `update eventos set estado = 'cancelado', atualizado_em = $2
       where id = $1 and estado = 'pronto' and excluido_em is null
         and not exists (select 1 from fotos where evento_id = $1) returning id`,
      [pag.evento_id, this.agora()],
    )
    if (!cancelado.rowCount) this.log('warn', { aviso: 'estorno_sem_cancelar', evento: pag.evento_id, sessao: pag.stripe_session_id })
    return 'processado'
  }

  /** Falha de rede ou do Stripe vira 503 amigável; o detalhe vai só para o log. */
  private async chamar<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await fn()
    } catch (e) {
      this.log('error', { aviso: 'stripe_falhou', tipo: (e as { type?: string }).type ?? (e as Error).name, mensagem: (e as Error).message })
      throw new ErroPagamento(503, 'pagamento_indisponivel', 'Não foi possível falar com o serviço de pagamento agora. Tente de novo em instantes.')
    }
  }

  private consultar(id: string): Promise<SessaoCheckout> {
    return this.chamar(() => this.provedor.buscarSessao(id))
  }
}
