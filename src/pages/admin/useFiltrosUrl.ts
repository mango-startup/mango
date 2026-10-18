import { useSearchParams } from 'react-router-dom'

/**
 * Filtros guardados na URL: dá para compartilhar, recarregar e voltar sem perder o contexto.
 * Só o que difere do padrão vai para o endereço. Mudar qualquer filtro volta para a página 1.
 */
export function useFiltrosUrl<T extends Record<string, string>>(padrao: T) {
  const [params, setParams] = useSearchParams()
  const valores = Object.fromEntries(Object.keys(padrao).map((k) => [k, params.get(k) ?? padrao[k]])) as T

  const definir = (mudancas: Partial<T>) =>
    setParams(
      (atual) => {
        const novo = new URLSearchParams(atual)
        for (const [k, v] of Object.entries(mudancas) as [string, string][]) {
          if (!v || v === padrao[k]) novo.delete(k)
          else novo.set(k, v)
        }
        if (!('pagina' in mudancas)) novo.delete('pagina')
        return novo
      },
      { replace: true },
    )

  const limpar = () => setParams({}, { replace: true })
  const ativos = Object.keys(padrao).filter((k) => k !== 'pagina' && valores[k] !== padrao[k]).length
  return { valores, definir, limpar, ativos }
}
