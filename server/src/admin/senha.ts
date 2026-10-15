import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto'

// scrypt (nativo do Node, sem dependência): custo 2^15, salt de 16 bytes por senha.
const N = 32768
const R = 8
const P = 1
const TAM = 64

function derivar(senha: string, salt: Buffer, n: number, r: number, p: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(senha, salt, TAM, { N: n, r, p, maxmem: 128 * n * r * 2 }, (erro, chave) => (erro ? reject(erro) : resolve(chave)))
  })
}

/** Formato `scrypt$N$r$p$salt$hash` (base64): guarda os parâmetros, então dá para subir o custo depois. */
export async function hashSenha(senha: string): Promise<string> {
  const salt = randomBytes(16)
  const chave = await derivar(senha, salt, N, R, P)
  return `scrypt$${N}$${R}$${P}$${salt.toString('base64')}$${chave.toString('base64')}`
}

export async function conferirSenha(senha: string, guardado: string): Promise<boolean> {
  const partes = guardado.split('$')
  if (partes.length !== 6 || partes[0] !== 'scrypt') return false
  const [, n, r, p, salt, hash] = partes
  try {
    const esperado = Buffer.from(hash, 'base64')
    const obtido = await derivar(senha, Buffer.from(salt, 'base64'), Number(n), Number(r), Number(p))
    return obtido.length === esperado.length && timingSafeEqual(obtido, esperado)
  } catch {
    return false
  }
}

/** Hash de uma senha qualquer, para gastar o mesmo tempo quando o usuário não existe (não revela quem existe). */
let falso: Promise<string> | null = null
export function hashFalso(): Promise<string> {
  falso ??= hashSenha('senha-que-ninguem-usa')
  return falso
}

/** Regras da senha nova. Devolve a mensagem de erro, ou null se está boa. */
export function validarSenhaNova(nova: string, contexto: { usuario: string; atual?: string }): string | null {
  if (nova.length < 10) return 'A senha precisa ter pelo menos 10 caracteres.'
  if (nova.length > 128) return 'A senha pode ter no máximo 128 caracteres.'
  if (!/[a-zA-Z]/.test(nova) || !/[0-9]/.test(nova)) return 'Use letras e números.'
  if (contexto.atual !== undefined && nova === contexto.atual) return 'A senha nova precisa ser diferente da atual.'
  if (nova.toLowerCase().includes(contexto.usuario.toLowerCase())) return 'A senha não pode conter o seu usuário.'
  return null
}

const ALFABETO_TEMP = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'

/** Senha temporária legível (sem caracteres ambíguos), para a redefinição entre admins. */
export function senhaTemporaria(tamanho = 14): string {
  const bytes = randomBytes(tamanho)
  let s = ''
  for (const b of bytes) s += ALFABETO_TEMP[b % ALFABETO_TEMP.length]
  // garante letra e número mesmo no caso (raro) de o sorteio não trazer
  return /[0-9]/.test(s) ? s : s.slice(0, -1) + '7'
}
