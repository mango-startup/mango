const reais = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })

const reaisComCentavos = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

/** 4690 → "R$ 46,90" (o preço por participante termina em ,90, então não pode arredondar). */
export function precoExato(centavos: number): string {
  return reaisComCentavos.format(centavos / 100)
}

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
