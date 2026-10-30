// Fila de envio das fotos do convidado. A foto é guardada no aparelho antes de qualquer envio,
// então falta de sinal, aba fechada ou bateria acabando não perdem a foto: ela sobe quando der.
import { createStore, del, entries, set } from 'idb-keyval'
import { ErroApi, api } from './api'
import { ESPACO } from './laboratorio'
import type { FotoParaEnvio } from './compress'

interface ItemFila {
  id: string
  codigo: string
  foto: Blob
  miniatura: Blob
  largura: number
  altura: number
  tirada_em: string
  /** A foto já chegou ao servidor; falta só a miniatura. */
  fotoEnviada: boolean
}

const store = createStore(`${ESPACO}mango-fila`, 'envios')

/** Erros em que tentar de novo não adianta: a foto não vai ser aceita. */
const ERROS_DEFINITIVOS = new Set(['sem_poses', 'evento_cheio', 'captura_fechada', 'id_em_uso', 'tipo_invalido', 'arquivo_grande', 'id_invalido', 'nao_encontrado'])

export type Recusa = 'sem_poses' | 'captura_fechada' | 'outro'

export interface ResultadoEnvio {
  /** Fotos que continuam esperando (sem conexão ou servidor fora). */
  pendentes: number
  /** Fotos descartadas porque o servidor recusou de vez. */
  recusadas: Recusa[]
  /** O aparelho perdeu o acesso ao evento e não conseguiu entrar de novo: as fotos ficam guardadas. */
  semAcesso: boolean
}

async function itensDo(codigo: string): Promise<ItemFila[]> {
  const todos = await entries<string, ItemFila>(store)
  return todos
    .map(([, item]) => item)
    .filter((item) => item.codigo === codigo.toUpperCase())
    .sort((a, b) => a.tirada_em.localeCompare(b.tirada_em))
}

export async function enfileirar(codigo: string, foto: FotoParaEnvio): Promise<string> {
  const item: ItemFila = {
    id: crypto.randomUUID(),
    codigo: codigo.toUpperCase(),
    foto: foto.blob,
    miniatura: foto.miniatura,
    largura: foto.width,
    altura: foto.height,
    tirada_em: new Date().toISOString(),
    fotoEnviada: false,
  }
  await set(item.id, item, store)
  return item.id
}

/** Quantas fotos deste evento ainda não chegaram ao servidor (para descontar das poses). */
export async function naoEnviadas(codigo: string): Promise<number> {
  return (await itensDo(codigo)).filter((item) => !item.fotoEnviada).length
}

function recusa(erro: string): Recusa {
  if (erro === 'sem_poses' || erro === 'evento_cheio') return 'sem_poses'
  if (erro === 'captura_fechada') return 'captura_fechada'
  return 'outro'
}

let emAndamento: Promise<ResultadoEnvio> | null = null

/**
 * Envia o que estiver na fila, uma foto por vez, na ordem em que foram tiradas.
 * Seguro chamar várias vezes: chamadas simultâneas reaproveitam o mesmo envio.
 */
export function enviarPendentes(codigo: string): Promise<ResultadoEnvio> {
  emAndamento ??= processar(codigo).finally(() => {
    emAndamento = null
  })
  return emAndamento
}

async function processar(codigo: string): Promise<ResultadoEnvio> {
  const recusadas: Recusa[] = []
  let pendentes = 0
  // O servidor diz quais fotos já tem: um envio pode ter chegado sem a resposta voltar.
  const noServidor = new Set<string>()
  const itens = await itensDo(codigo)
  try {
    for (const id of (await api.eu(codigo)).fotos) noServidor.add(id)
  } catch (e) {
    if (e instanceof ErroApi && e.status === 401 && itens.length > 0) {
      // O token do aparelho sumiu (dados do navegador limpos): entra de novo no evento e envia com o rolo novo.
      // As fotos são só deste aparelho, então ficam na fila até dar certo; nada é descartado.
      try {
        await api.entrar(codigo)
      } catch (e2) {
        if (e2 instanceof ErroApi) return { pendentes: itens.length, recusadas, semAcesso: true }
      }
    }
    // sem conexão: tenta assim mesmo, o envio é idempotente
  }

  for (const [i, item] of itens.entries()) {
    try {
      if (!item.fotoEnviada && !noServidor.has(item.id)) {
        await api.enviarFoto(codigo, item.id, item.foto, { largura: item.largura, altura: item.altura, tirada_em: item.tirada_em })
      }
      if (!item.fotoEnviada) {
        item.fotoEnviada = true
        await set(item.id, item, store)
      }
      try {
        await api.enviarMiniatura(codigo, item.id, item.miniatura)
      } catch (e) {
        // Sem miniatura o álbum usa a foto original; só vale insistir se for falha de conexão.
        if (!(e instanceof ErroApi)) throw e
      }
      await del(item.id, store)
    } catch (e) {
      if (e instanceof ErroApi && e.status === 401) return { pendentes: itens.length - i, recusadas, semAcesso: true }
      if (e instanceof ErroApi && ERROS_DEFINITIVOS.has(e.erro)) {
        if (!item.fotoEnviada) recusadas.push(recusa(e.erro))
        await del(item.id, store)
      } else {
        // Sem conexão ou servidor fora: as próximas também falhariam. Tenta tudo de novo depois.
        pendentes = itens.length - i
        break
      }
    }
  }
  return { pendentes, recusadas, semAcesso: false }
}
