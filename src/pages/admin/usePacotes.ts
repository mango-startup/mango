import { useEffect, useState } from 'react'
import { admin } from '../../lib/admin.ts'

let cache: Record<string, string> | null = null

/** id do pacote → nome ("celebracao" → "Celebração"). Busca uma vez e reaproveita; enquanto não chega, mostra o id. */
export function useNomesPacotes(): (id: string) => string {
  const [nomes, setNomes] = useState<Record<string, string>>(cache ?? {})
  useEffect(() => {
    if (cache) return
    let ativo = true
    admin
      .pacotes()
      .then((l) => {
        cache = Object.fromEntries(l.map((p) => [p.id, p.nome]))
        if (ativo) setNomes(cache)
      })
      .catch(() => {})
    return () => {
      ativo = false
    }
  }, [])
  return (id) => nomes[id] ?? id
}
