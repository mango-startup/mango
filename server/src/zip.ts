import { crc32 } from 'node:zlib'

export interface EntradaZip {
  nome: string
  ler: () => Promise<Uint8Array | null>
}

const SEM_COMPRESSAO = 0
const FLAG_DESCRITOR_E_UTF8 = 0x0008 | 0x0800
// 2020-01-01 em formato DOS, só para o arquivo não ficar com data zero.
const DOS_DATA = ((2020 - 1980) << 9) | (1 << 5) | 1

function u16(v: number): Uint8Array {
  const b = new Uint8Array(2)
  new DataView(b.buffer).setUint16(0, v, true)
  return b
}
function u32(v: number): Uint8Array {
  const b = new Uint8Array(4)
  new DataView(b.buffer).setUint32(0, v >>> 0, true)
  return b
}
function juntar(...partes: Uint8Array[]): Uint8Array {
  const total = partes.reduce((s, p) => s + p.length, 0)
  const saida = new Uint8Array(total)
  let pos = 0
  for (const p of partes) {
    saida.set(p, pos)
    pos += p.length
  }
  return saida
}

/**
 * ZIP sem compressão (JPEG já é comprimido), gerado em streaming: uma foto na memória por vez.
 * Usa "data descriptor", então não precisa saber tamanho nem CRC antes de enviar o arquivo.
 * Sem ZIP64: até 65.535 arquivos e 4 GB (quem chama confere o limite antes).
 */
export function criarZip(entradas: EntradaZip[]): ReadableStream<Uint8Array> {
  const codificador = new TextEncoder()
  const central: Uint8Array[] = []
  let deslocamento = 0
  let indice = 0

  async function* partes(): AsyncGenerator<Uint8Array> {
    for (const entrada of entradas) {
      const dados = await entrada.ler()
      if (!dados) continue // arquivo sumiu do disco: pula em vez de quebrar o ZIP inteiro
      const nome = codificador.encode(entrada.nome)
      const crc = crc32(dados)
      const cabecalho = juntar(
        u32(0x04034b50), u16(20), u16(FLAG_DESCRITOR_E_UTF8), u16(SEM_COMPRESSAO), u16(0), u16(DOS_DATA),
        u32(0), u32(0), u32(0), u16(nome.length), u16(0), nome,
      )
      yield cabecalho
      yield dados
      yield juntar(u32(0x08074b50), u32(crc), u32(dados.length), u32(dados.length))
      central.push(
        juntar(
          u32(0x02014b50), u16(20), u16(20), u16(FLAG_DESCRITOR_E_UTF8), u16(SEM_COMPRESSAO), u16(0), u16(DOS_DATA),
          u32(crc), u32(dados.length), u32(dados.length), u16(nome.length), u16(0), u16(0), u16(0), u16(0),
          u32(0), u32(deslocamento), nome,
        ),
      )
      deslocamento += cabecalho.length + dados.length + 16
      indice++
    }
    const diretorio = juntar(...central)
    yield diretorio
    yield juntar(u32(0x06054b50), u16(0), u16(0), u16(indice), u16(indice), u32(diretorio.length), u32(deslocamento), u16(0))
  }

  const iterador = partes()
  return new ReadableStream<Uint8Array>({
    async pull(controle) {
      const r = await iterador.next()
      if (r.done) controle.close()
      else controle.enqueue(r.value)
    },
    async cancel() {
      await iterador.return(undefined)
    },
  })
}
