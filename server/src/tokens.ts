import { createHash, randomBytes, randomInt } from 'node:crypto'

// Sem caracteres ambíguos (0/O, 1/I/L) para o código poder ser lido em QR impresso ou ditado.
const ALFABETO_CODIGO = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'

export function gerarCodigo(tamanho = 8): string {
  let codigo = ''
  for (let i = 0; i < tamanho; i++) codigo += ALFABETO_CODIGO[randomInt(ALFABETO_CODIGO.length)]
  return codigo
}

/** Token secreto (anfitrião ou aparelho do convidado). Vai ao cliente uma vez; no banco fica só o hash. */
export function gerarToken(): string {
  return randomBytes(24).toString('base64url')
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}
