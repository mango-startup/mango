/** Armazenamento de fotos. Troque a implementação (disco, R2) sem mexer no resto da API. */
export interface Storage {
  salvar(chave: string, dados: Uint8Array): Promise<void>
  /** Devolve null se a chave não existir. */
  ler(chave: string): Promise<Uint8Array | null>
  /** Apagar chave inexistente não é erro. */
  apagar(chave: string): Promise<void>
}
