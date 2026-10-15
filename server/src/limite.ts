/**
 * Contador por janela fixa, em memória (a API roda numa instância só).
 * Feito para NUNCA atrapalhar uso legítimo: quem estoura recebe 429 com o tempo de espera e,
 * se a tabela crescer demais, ela é esvaziada (falha aberta) em vez de derrubar a API.
 */
const MAX_CHAVES = 100_000

interface Janela {
  n: number
  fim: number
}

export class Limitador {
  private janelas = new Map<string, Janela>()
  private chamadas = 0

  private max: number
  private janelaMs: number

  constructor(max: number, janelaMs: number) {
    this.max = max
    this.janelaMs = janelaMs
  }

  private janela(chave: string, agora: number): Janela {
    if (++this.chamadas % 500 === 0) this.varrer(agora)
    const atual = this.janelas.get(chave)
    if (atual && atual.fim > agora) return atual
    const nova = { n: 0, fim: agora + this.janelaMs }
    this.janelas.set(chave, nova)
    return nova
  }

  private varrer(agora: number) {
    for (const [chave, j] of this.janelas) if (j.fim <= agora) this.janelas.delete(chave)
    if (this.janelas.size > MAX_CHAVES) this.janelas.clear()
  }

  /** Conta uma tentativa. `permitido: false` quando a janela já está cheia (e não conta a recusada). */
  consumir(chave: string, agora: number, max: number = this.max): { permitido: boolean; retryEmSegundos: number } {
    const j = this.janela(chave, agora)
    if (j.n >= max) return { permitido: false, retryEmSegundos: Math.max(1, Math.ceil((j.fim - agora) / 1000)) }
    j.n++
    return { permitido: true, retryEmSegundos: 0 }
  }

  /** Só consulta, sem contar. */
  espera(chave: string, agora: number, max: number = this.max): number {
    const j = this.janelas.get(chave)
    if (!j || j.fim <= agora || j.n < max) return 0
    return Math.max(1, Math.ceil((j.fim - agora) / 1000))
  }

  /** Conta sem checar (usado para falhas, que são contadas depois da resposta). */
  registrar(chave: string, agora: number): void {
    this.janela(chave, agora).n++
  }
}
