import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import type { Storage } from './storage.ts'

const chaveValida = /^[a-zA-Z0-9_-]+(\/[a-zA-Z0-9_.-]+)*$/

export class StorageDisco implements Storage {
  private raiz: string

  constructor(raiz: string) {
    this.raiz = path.resolve(raiz)
  }

  private caminho(chave: string): string {
    if (!chaveValida.test(chave) || chave.split('/').includes('..')) throw new Error(`Chave inválida: ${chave}`)
    return path.join(this.raiz, chave)
  }

  async salvar(chave: string, dados: Uint8Array): Promise<void> {
    const destino = this.caminho(chave)
    await mkdir(path.dirname(destino), { recursive: true })
    await writeFile(destino, dados)
  }

  async ler(chave: string): Promise<Uint8Array | null> {
    try {
      return await readFile(this.caminho(chave))
    } catch (erro) {
      if ((erro as NodeJS.ErrnoException).code === 'ENOENT') return null
      throw erro
    }
  }

  async apagar(chave: string): Promise<void> {
    await rm(this.caminho(chave), { force: true })
  }
}
