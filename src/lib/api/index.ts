// Ponto único de acesso aos dados para as telas.
// Produção usa a API real. No desenvolvimento, a simulada (sem rede) é o padrão;
// para usar a real: VITE_API=real npm run dev (o Vite repassa /api para MANGO_API, padrão localhost:3000).
import { persistenciaIdb } from './persistencia.ts'
import { criarApiReal } from './real.ts'
import { sessaoLocal } from './sessao.ts'
import { EM_LABORATORIO, ESPACO } from '../laboratorio.ts'
import { criarApiSimulada } from './simulada.ts'
import type { MangoApi } from './tipos.ts'

// No laboratório da câmera do admin a api é sempre a simulada, com dados e sessão à parte (prefixo `lab-`).
const modo = EM_LABORATORIO ? 'simulada' : (import.meta.env.VITE_API ?? (import.meta.env.PROD ? 'real' : 'simulada'))
const sessao = sessaoLocal(ESPACO)

const simulada = modo === 'simulada' ? criarApiSimulada({ persistencia: persistenciaIdb(`${ESPACO}mango-simulado`), sessao, atrasoMs: [150, 400] }) : null

export const api: MangoApi = simulada ?? criarApiReal({ sessao })

/** Resolve quando a api pode ser usada (a simulada cria os exemplos na primeira visita). */
export const apiPronta: Promise<void> = simulada
  ? simulada.preparar().catch((e: unknown) => {
      console.error('Falha ao preparar os dados simulados:', e)
    })
  : Promise.resolve()

// No console do navegador, com a simulada: mango.eventos(), mango.forcarEstado('ABERTA27', 'revelado'), mango.resetar()
if ((import.meta.env.DEV || EM_LABORATORIO) && simulada) Object.assign(window, { mango: simulada.dev })

export * from './tipos.ts'
