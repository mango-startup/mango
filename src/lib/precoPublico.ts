// Preço por participante que o admin publicou (GET /api/preco). Sem servidor ou sem publicação, valem os valores
// propostos, os mesmos do simulador. A conta é a de simuladorPreco.ts.
import { useEffect, useState } from 'react'
import { PARAMS_PADRAO, type ParamsPreco } from './simuladorPreco.ts'

let cache: ParamsPreco | null = null
let carregando: Promise<ParamsPreco> | null = null

function carregar(): Promise<ParamsPreco> {
  if (cache) return Promise.resolve(cache)
  carregando ??= fetch('/api/preco', { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(4000) })
    .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
    .then((corpo: { params?: ParamsPreco }) => (cache = corpo.params ?? PARAMS_PADRAO))
    .catch(() => PARAMS_PADRAO)
  return carregando
}

/** Os parâmetros de preço; começa nos valores propostos e troca pelos publicados quando a resposta chega. */
export function usePrecoPublico(): ParamsPreco {
  const [params, setParams] = useState<ParamsPreco>(cache ?? PARAMS_PADRAO)
  useEffect(() => {
    let ativo = true
    void carregar().then((p) => ativo && setParams(p))
    return () => {
      ativo = false
    }
  }, [])
  return params
}
