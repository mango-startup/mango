// Onde a api simulada guarda o "banco" e os arquivos das fotos.
import { createStore, del, get, set } from 'idb-keyval'

export interface Persistencia {
  ler<T>(chave: string): Promise<T | undefined>
  gravar(chave: string, valor: unknown): Promise<void>
  apagar(chave: string): Promise<void>
}

/** IndexedDB do navegador, separado do banco 'mango-db' usado pela câmera do protótipo. */
export function persistenciaIdb(nome = 'mango-simulado'): Persistencia {
  const store = createStore(nome, 'dados')
  return {
    ler: (chave) => get(chave, store),
    gravar: (chave, valor) => set(chave, valor, store),
    apagar: (chave) => del(chave, store),
  }
}

export function persistenciaEmMemoria(): Persistencia {
  const dados = new Map<string, unknown>()
  // Copia na leitura e na escrita, como o IndexedDB faz
  const copia = (valor: unknown) => (valor instanceof Blob ? valor : structuredClone(valor))
  return {
    ler: async <T>(chave: string) => copia(dados.get(chave)) as T | undefined,
    gravar: async (chave, valor) => {
      dados.set(chave, copia(valor))
    },
    apagar: async (chave) => {
      dados.delete(chave)
    },
  }
}
