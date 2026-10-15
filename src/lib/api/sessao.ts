// Tokens guardados neste aparelho: o do anfitrião (um por evento criado aqui) e o do convidado
// (um por código de evento). Valem para a api simulada e para a real.

export interface Sessao {
  /** id do evento → token do anfitrião */
  tokensDoAnfitriao(): Record<string, string>
  guardarTokenDoAnfitriao(eventoId: string, token: string): void
  esquecerEvento(eventoId: string): void
  tokenDoConvidado(codigo: string): string | null
  guardarTokenDoConvidado(codigo: string, token: string): void
}

const CHAVE_ANFITRIAO = 'mango.anfitriao'
const chaveConvidado = (codigo: string) => `mango.convidado.${codigo.toUpperCase()}`

/** localStorage pode falhar (aba anônima, armazenamento bloqueado); nesse caso a sessão vive só na memória. */
export function sessaoLocal(): Sessao {
  const memoria = new Map<string, string>()

  function ler(chave: string): string | null {
    try {
      return localStorage.getItem(chave) ?? memoria.get(chave) ?? null
    } catch {
      return memoria.get(chave) ?? null
    }
  }

  function gravar(chave: string, valor: string) {
    memoria.set(chave, valor)
    try {
      localStorage.setItem(chave, valor)
    } catch {
      // segue só com a memória
    }
  }

  function anfitriao(): Record<string, string> {
    try {
      return JSON.parse(ler(CHAVE_ANFITRIAO) ?? '{}') as Record<string, string>
    } catch {
      return {}
    }
  }

  return {
    tokensDoAnfitriao: anfitriao,
    guardarTokenDoAnfitriao(eventoId, token) {
      gravar(CHAVE_ANFITRIAO, JSON.stringify({ ...anfitriao(), [eventoId]: token }))
    },
    esquecerEvento(eventoId) {
      const { [eventoId]: _removido, ...resto } = anfitriao()
      gravar(CHAVE_ANFITRIAO, JSON.stringify(resto))
    },
    tokenDoConvidado: (codigo) => ler(chaveConvidado(codigo)),
    guardarTokenDoConvidado: (codigo, token) => gravar(chaveConvidado(codigo), token),
  }
}

export function sessaoEmMemoria(): Sessao {
  let anfitriao: Record<string, string> = {}
  const convidado = new Map<string, string>()
  return {
    tokensDoAnfitriao: () => ({ ...anfitriao }),
    guardarTokenDoAnfitriao(eventoId, token) {
      anfitriao = { ...anfitriao, [eventoId]: token }
    },
    esquecerEvento(eventoId) {
      const { [eventoId]: _removido, ...resto } = anfitriao
      anfitriao = resto
    },
    tokenDoConvidado: (codigo) => convidado.get(codigo.toUpperCase()) ?? null,
    guardarTokenDoConvidado: (codigo, token) => convidado.set(codigo.toUpperCase(), token),
  }
}
