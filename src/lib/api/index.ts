// Ponto único de acesso aos dados para as telas. Hoje usa a implementação simulada;
// quando a API real estiver pronta, troca-se só a linha que cria `api`.
import { persistenciaIdb } from './persistencia.ts'
import { sessaoLocal } from './sessao.ts'
import { criarApiSimulada } from './simulada.ts'
import type { MangoApi } from './tipos.ts'

const simulada = criarApiSimulada({
  persistencia: persistenciaIdb(),
  sessao: sessaoLocal(),
  atrasoMs: [150, 400],
})

export const api: MangoApi = simulada

/** Resolve quando a api pode ser usada (a simulada cria os exemplos na primeira visita). */
export const apiPronta: Promise<void> = simulada.preparar().catch((e: unknown) => {
  console.error('Falha ao preparar os dados simulados:', e)
})

// No console do navegador: mango.eventos(), mango.forcarEstado('ABERTA27', 'revelado'), mango.resetar()
if (import.meta.env.DEV) Object.assign(window, { mango: simulada.dev })

export * from './tipos.ts'
