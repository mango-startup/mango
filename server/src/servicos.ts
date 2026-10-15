import type { Pool } from 'pg'
import { avancarEstados } from './agendador.ts'
import { ServicoConfig } from './configuracao.ts'
import { ServicoPacotes } from './pacotes.ts'

/** Configuração e pacotes lidos do banco (com cache curto), compartilhados por todas as rotas. */
export interface Servicos {
  config: ServicoConfig
  pacotes: ServicoPacotes
  /** Avança os eventos pelo relógio usando a configuração atual (prazo dos rascunhos). */
  avancar(): Promise<void>
}

export function criarServicos(pool: Pool, agora: () => Date = () => new Date()): Servicos {
  const config = new ServicoConfig(pool)
  const pacotes = new ServicoPacotes(pool)
  return {
    config,
    pacotes,
    async avancar() {
      const c = await config.valores()
      await avancarEstados(pool, agora(), { rascunhoDias: c.rascunho_validade_dias })
    },
  }
}
