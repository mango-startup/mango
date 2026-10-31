import type { Pool } from 'pg'
import { avancarEstados } from './agendador.ts'
import { ServicoConfig } from './configuracao.ts'
import { ServicoPacotes } from './pacotes.ts'
import { ServicoPrecos } from './preco.ts'
import { ServicoPagamento } from './pagamento.ts'
import type { ProvedorPagamento } from './pagamento.ts'
import type { EnviadorEmail } from './email.ts'
import { COLUNAS_AVISO } from './avisos.ts'
import type { Avisador, DadosEvento, TipoAviso } from './avisos.ts'

/** Configuração e pacotes lidos do banco (com cache curto), compartilhados por todas as rotas. */
export interface Servicos {
  config: ServicoConfig
  pacotes: ServicoPacotes
  /** Preço dinâmico por participante, publicado pelo admin. */
  precos: ServicoPrecos
  /** Cobrança com o Stripe. `null` quando STRIPE_SECRET_KEY não está definida: só pacotes grátis funcionam. */
  pagamento: ServicoPagamento | null
  /** Envio de e-mail (Resend). `null` quando RESEND_API_KEY não está definida: o admin não consegue escrever aos anfitriões. */
  email: EnviadorEmail | null
  /** Endereço público do site (APP_URL), para montar os links dos e-mails. `null`: não dá para mandar link. */
  appUrl: string | null
  /** Avisos ao n8n (N8N_WEBHOOK_URL). `null`: desligado. */
  avisos: Avisador | null
  /** Avança os eventos pelo relógio usando a configuração atual (prazo dos rascunhos). */
  avancar(): Promise<void>
}

export interface Gateway {
  provedor: ProvedorPagamento
  /** Endereço público do site, sem barra no fim. */
  appUrl: string
}

export function criarServicos(pool: Pool, agora: () => Date = () => new Date(), gateway: Gateway | null = null, email: EnviadorEmail | null = null, appUrl: string | null = null, avisos: Avisador | null = null): Servicos {
  const config = new ServicoConfig(pool)
  const pacotes = new ServicoPacotes(pool)
  const avisarPorIds = (tipo: TipoAviso, ids: string[]) => {
    if (!avisos) return
    void pool
      .query<DadosEvento>(`select ${COLUNAS_AVISO} from eventos where id = any($1::uuid[])`, [ids])
      .then((r) => r.rows.forEach((e) => avisos.avisar(tipo, e)))
      .catch(() => {})
  }
  return {
    config,
    pacotes,
    precos: new ServicoPrecos(pool),
    email,
    avisos,
    appUrl: appUrl ?? gateway?.appUrl ?? null,
    pagamento: gateway ? new ServicoPagamento({ pool, provedor: gateway.provedor, pacotes, appUrl: gateway.appUrl, agora, avisos }) : null,
    async avancar() {
      const c = await config.valores()
      await avancarEstados(pool, agora(), {
        rascunhoDias: c.rascunho_validade_dias,
        aoRevelar: (ids) => avisarPorIds('album_revelado', ids),
        aoLembrar: (tipo, ids) => avisarPorIds(tipo, ids),
      })
    },
  }
}
