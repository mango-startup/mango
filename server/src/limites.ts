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
 * - tentativas que falham com 401/404 (por IP, por minuto): só falha conta, quem acerta nunca é barrado.
 */
export interface Limites {
  criarEventoPorHora: number
  uploadsPorMinutoPorConvidado: number
  falhasPorMinuto: number
}

export const LIMITES_PADRAO: Limites = {
  criarEventoPorHora: 30,
  uploadsPorMinutoPorConvidado: 300,
  falhasPorMinuto: 600,
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

export function criarLimites(limites: Limites, agora: () => Date): MiddlewareHandler[] {
  const criar = new Limitador(limites.criarEventoPorHora, HORA)
  const uploads = new Limitador(limites.uploadsPorMinutoPorConvidado, MINUTO)
  const falhas = new Limitador(limites.falhasPorMinuto, MINUTO)
  const agoraMs = () => agora().getTime()

  const porFalhas: MiddlewareHandler = async (c, next) => {
    const ip = ipDoCliente(c)
    const espera = falhas.espera(ip, agoraMs())
    if (espera) return recusar(c, espera, 'Muitas tentativas inválidas. Tente de novo em instantes.')
    await next()
    if (c.res.status === 401 || c.res.status === 404) falhas.registrar(ip, agoraMs())
  }

  const porCriacao: MiddlewareHandler = async (c, next) => {
    if (c.req.method !== 'POST' || new URL(c.req.url).pathname !== '/api/eventos') return next()
    const r = criar.consumir(ipDoCliente(c), agoraMs())
    if (!r.permitido) return recusar(c, r.retryEmSegundos, 'Muitos eventos criados deste endereço. Tente de novo mais tarde.')
    return next()
  }

  const porUpload: MiddlewareHandler = async (c, next) => {
    if (c.req.method !== 'PUT') return next()
    const token = c.req.header('x-convidado-token')
    const chave = token ? `t:${hashToken(token)}` : `ip:${ipDoCliente(c)}`
    const r = uploads.consumir(chave, agoraMs())
    if (!r.permitido) return recusar(c, r.retryEmSegundos, 'Envios rápidos demais. O aparelho tenta de novo sozinho.')
    return next()
  }

  return [porFalhas, porCriacao, porUpload]
}
