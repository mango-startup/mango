const reais = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })

/** 4900 → "R$ 49" */
export function precoEmReais(centavos: number): string {
  return reais.format(centavos / 100)
}

/** Copia para a área de transferência; devolve false se o navegador não deixar. */
export async function copiar(texto: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(texto)
    return true
  } catch {
    return false
  }
}
