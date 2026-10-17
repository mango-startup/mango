import type { Pool } from 'pg'
import { avancarEstados } from './agendador.ts'
import { ServicoConfig } from './configuracao.ts'
import { ServicoPacotes } from './pacotes.ts'
import { ServicoPagamento } from './pagamento.ts'
import type { ProvedorPagamento } from './pagamento.ts'

/** Configuração e pacotes lidos do banco (com cache curto), compartilhados por todas as rotas. */
export interface Servicos {
  config: ServicoConfig
  pacotes: ServicoPacotes
  /** Cobrança com o Stripe. `null` quando STRIPE_SECRET_KEY não está definida: só pacotes grátis funcionam. */
  pagamento: ServicoPagamento | null
  /** Avança os eventos pelo relógio usando a configuração atual (prazo dos rascunhos). */
  avancar(): Promise<void>
}

export interface Gateway {
  provedor: ProvedorPagamento
  /** Endereço público do site, sem barra no fim. */
  appUrl: string
}

export function criarServicos(pool: Pool, agora: () => Date = () => new Date(), gateway: Gateway | null = null): Servicos {
  const config = new ServicoConfig(pool)
  const pacotes = new ServicoPacotes(pool)
  return {
    config,
    pacotes,
    pagamento: gateway ? new ServicoPagamento({ pool, provedor: gateway.provedor, pacotes, appUrl: gateway.appUrl, agora }) : null,
    async avancar() {
      const c = await config.valores()
      await avancarEstados(pool, agora(), { rascunhoDias: c.rascunho_validade_dias })
    },
  }
}
