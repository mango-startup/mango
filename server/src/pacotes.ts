// Pacotes de docs/PLANO-MVP.md seção 3.2. O preço (e o pagamento) entram depois; o servidor é a fonte dos limites.
export type Pacote = 'teste' | 'festa' | 'celebracao' | 'casamento'

export interface DefinicaoPacote {
  convidados: number
  gratis: boolean
  /** Preço em centavos de real. Hipótese do plano (seção 3.2), a validar nas entrevistas (#57). */
  precoCentavos: number
  /** Dias de álbum depois da revelação. */
  retencaoDias: number
  posesMax: number
}

export const PACOTES: Record<Pacote, DefinicaoPacote> = {
  teste: { convidados: 10, gratis: true, precoCentavos: 0, retencaoDias: 30, posesMax: 12 },
  festa: { convidados: 30, gratis: false, precoCentavos: 4900, retencaoDias: 365, posesMax: 36 },
  celebracao: { convidados: 80, gratis: false, precoCentavos: 9900, retencaoDias: 365, posesMax: 36 },
  casamento: { convidados: 200, gratis: false, precoCentavos: 19900, retencaoDias: 365, posesMax: 36 },
}

export const POSES_VALIDAS = [12, 24, 36]

export function ehPacote(valor: unknown): valor is Pacote {
  return typeof valor === 'string' && Object.hasOwn(PACOTES, valor)
}
