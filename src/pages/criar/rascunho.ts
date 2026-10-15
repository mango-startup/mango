// Rascunho da criação de evento, guardado só neste aparelho (conveniência: pode falhar sem problema).
const CHAVE = 'mango.rascunho-evento'

export function lerRascunho<T extends object>(): Partial<T> | null {
  try {
    const salvo = localStorage.getItem(CHAVE)
    return salvo ? (JSON.parse(salvo) as Partial<T>) : null
  } catch {
    return null
  }
}

export function guardarRascunho(valor: object | null) {
  try {
    if (valor) localStorage.setItem(CHAVE, JSON.stringify(valor))
    else localStorage.removeItem(CHAVE)
  } catch {
    // sem rascunho
  }
}
