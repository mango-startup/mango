import { getConnInfo } from '@hono/node-server/conninfo'
import type { Context, MiddlewareHandler } from 'hono'
import { Limitador } from './limite.ts'
import { erro } from './rotas/util.ts'
import { hashToken } from './tokens.ts'

/**
 * Limites pensados para festa: dezenas de convidados no mesmo Wi-Fi compartilham UM IP, então
 * leitura e upload NÃO são limitados por IP. Só o que é abuso de verdade:
 * - criar evento (por IP, por hora);
 * - upload (por aparelho do convidado, por minuto: cobre a fila offline despejando de uma vez);
 * - tentativas que falham com 401/404 (por IP, por minuto): só falha conta, quem acerta nunca é barrado;
 * - pedidos de remoção de foto (por IP, por hora).
 */
export interface Limites {
  criarEventoPorHora: number
  uploadsPorMinutoPorConvidado: number
  falhasPorMinuto: number
  pedidosRemocaoPorHora: number
}

export const LIMITES_PADRAO: Limites = {
  criarEventoPorHora: 30,
  uploadsPorMinutoPorConvidado: 300,
  falhasPorMinuto: 600,
  pedidosRemocaoPorHora: 30,
}

const HORA = 3_600_000
const MINUTO = 60_000

/** IP real do cliente. O Caddy põe o IP dele no fim do X-Forwarded-For; sem proxy, vale o socket. */
export function ipDoCliente(c: Context): string {
  const encaminhado = c.req.header('x-forwarded-for')
  if (encaminhado) {
    const ultimo = encaminhado.split(',').pop()?.trim()
    if (ultimo) return ultimo
  }
  try {
    return getConnInfo(c).remote.address ?? 'desconhecido'
  } catch {
    return 'desconhecido'
  }
}

function recusar(c: Context, segundos: number, mensagem: string) {
  c.header('Retry-After', String(segundos))
  return erro(c, 429, 'muitas_requisicoes', mensagem, { retry_em_segundos: segundos })
}

/** Os valores vigentes, lidos a cada requisição (o admin muda na configuração). `null` = limites desligados. */
export type ProvedorLimites = () => Promise<Limites | null> | Limites | null

export function criarLimites(provedor: ProvedorLimites, agora: () => Date): MiddlewareHandler[] {
  const criar = new Limitador(LIMITES_PADRAO.criarEventoPorHora, HORA)
  const uploads = new Limitador(LIMITES_PADRAO.uploadsPorMinutoPorConvidado, MINUTO)
  const falhas = new Limitador(LIMITES_PADRAO.falhasPorMinuto, MINUTO)
  const remocoes = new Limitador(LIMITES_PADRAO.pedidosRemocaoPorHora, HORA)
  const agoraMs = () => agora().getTime()

  const porFalhas: MiddlewareHandler = async (c, next) => {
    const limites = await provedor()
    if (!limites) return next()
    const ip = ipDoCliente(c)
    const espera = falhas.espera(ip, agoraMs(), limites.falhasPorMinuto)
    if (espera) return recusar(c, espera, 'Muitas tentativas inválidas. Tente de novo em instantes.')
    await next()
    if (c.res.status === 401 || c.res.status === 404) falhas.registrar(ip, agoraMs())
  }

  const porCriacao: MiddlewareHandler = async (c, next) => {
    if (c.req.method !== 'POST' || new URL(c.req.url).pathname !== '/api/eventos') return next()
    const limites = await provedor()
    if (!limites) return next()
    const r = criar.consumir(ipDoCliente(c), agoraMs(), limites.criarEventoPorHora)
    if (!r.permitido) return recusar(c, r.retryEmSegundos, 'Muitos eventos criados deste endereço. Tente de novo mais tarde.')
    return next()
  }

  const porUpload: MiddlewareHandler = async (c, next) => {
    if (c.req.method !== 'PUT') return next()
    const limites = await provedor()
    if (!limites) return next()
    const token = c.req.header('x-convidado-token')
    const chave = token ? `t:${hashToken(token)}` : `ip:${ipDoCliente(c)}`
    const r = uploads.consumir(chave, agoraMs(), limites.uploadsPorMinutoPorConvidado)
    if (!r.permitido) return recusar(c, r.retryEmSegundos, 'Envios rápidos demais. O aparelho tenta de novo sozinho.')
    return next()
  }

  const porRemocao: MiddlewareHandler = async (c, next) => {
    if (c.req.method !== 'POST') return next()
    const limites = await provedor()
    if (!limites) return next()
    const r = remocoes.consumir(ipDoCliente(c), agoraMs(), limites.pedidosRemocaoPorHora)
    if (!r.permitido) return recusar(c, r.retryEmSegundos, 'Muitos pedidos de remoção deste endereço. Tente de novo mais tarde.')
    return next()
  }

  return [porFalhas, porCriacao, porUpload, porRemocao]
}
