// Gerador de QR Code (ISO/IEC 18004), modo byte, correção de erro M, versões 1 a 10 (até 213 bytes).
// Escrito aqui para o convite funcionar offline e sem dependência nova. Verificado contra um leitor
// independente (jsQR) nos testes de desenvolvimento.

// Por versão (1..10), nível M: palavras de código por bloco de dados em grupos [quantidade, tamanho] e ec por bloco
const VERSOES = [
  { ec: 10, grupos: [[1, 16]] },
  { ec: 16, grupos: [[1, 28]] },
  { ec: 26, grupos: [[1, 44]] },
  { ec: 18, grupos: [[2, 32]] },
  { ec: 24, grupos: [[2, 43]] },
  { ec: 16, grupos: [[4, 27]] },
  { ec: 18, grupos: [[4, 31]] },
  { ec: 22, grupos: [[2, 38], [2, 39]] },
  { ec: 22, grupos: [[3, 36], [2, 37]] },
  { ec: 26, grupos: [[4, 43], [1, 44]] },
] as const

const ALINHAMENTO: number[][] = [[], [6, 18], [6, 22], [6, 26], [6, 30], [6, 34], [6, 22, 38], [6, 24, 42], [6, 26, 46], [6, 28, 50]]

// Aritmética em GF(256), polinômio 0x11D
const EXP = new Uint8Array(512)
const LOG = new Uint8Array(256)
{
  let x = 1
  for (let i = 0; i < 255; i++) {
    EXP[i] = x
    LOG[x] = i
    x <<= 1
    if (x & 0x100) x ^= 0x11d
  }
  for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255]
}
const mul = (a: number, b: number) => (a === 0 || b === 0 ? 0 : EXP[LOG[a] + LOG[b]])

function geradorRS(grau: number): number[] {
  let poli = [1]
  for (let i = 0; i < grau; i++) {
    const prox = new Array<number>(poli.length + 1).fill(0)
    for (let j = 0; j < poli.length; j++) {
      prox[j] ^= poli[j]
      prox[j + 1] ^= mul(poli[j], EXP[i])
    }
    poli = prox
  }
  return poli
}

function restoRS(dados: number[], ec: number): number[] {
  const gerador = geradorRS(ec)
  const resto = new Array<number>(ec).fill(0)
  for (const d of dados) {
    const fator = d ^ resto[0]
    resto.shift()
    resto.push(0)
    for (let i = 0; i < ec; i++) resto[i] ^= mul(gerador[i + 1], fator)
  }
  return resto
}

function bch(valor: number, gerador: number, bitsGerador: number): number {
  let r = valor << (bitsGerador - 1)
  const topo = (n: number) => 31 - Math.clz32(n)
  while (topo(r) >= bitsGerador - 1 && r !== 0) r ^= gerador << (topo(r) - (bitsGerador - 1))
  return r
}

function bytesDoTexto(texto: string): number[] {
  return Array.from(new TextEncoder().encode(texto))
}

function codewordsDe(bytes: number[], versao: number): number[] {
  const { ec, grupos } = VERSOES[versao - 1]
  const totalDados = grupos.reduce((s, [n, t]) => s + n * t, 0)
  const bits: number[] = []
  const empurrar = (valor: number, qtd: number) => {
    for (let i = qtd - 1; i >= 0; i--) bits.push((valor >> i) & 1)
  }
  empurrar(0b0100, 4)
  empurrar(bytes.length, versao < 10 ? 8 : 16)
  for (const b of bytes) empurrar(b, 8)
  const capacidade = totalDados * 8
  for (let i = 0; i < 4 && bits.length < capacidade; i++) bits.push(0)
  while (bits.length % 8) bits.push(0)
  const dados: number[] = []
  for (let i = 0; i < bits.length; i += 8) dados.push(parseInt(bits.slice(i, i + 8).join(''), 2))
  for (let pad = 0; dados.length < totalDados; pad++) dados.push(pad % 2 === 0 ? 0xec : 0x11)

  const blocos: number[][] = []
  let pos = 0
  for (const [n, t] of grupos) {
    for (let i = 0; i < n; i++) {
      blocos.push(dados.slice(pos, pos + t))
      pos += t
    }
  }
  const ecs = blocos.map((b) => restoRS(b, ec))
  const saida: number[] = []
  const maior = Math.max(...blocos.map((b) => b.length))
  for (let i = 0; i < maior; i++) for (const b of blocos) if (i < b.length) saida.push(b[i])
  for (let i = 0; i < ec; i++) for (const e of ecs) saida.push(e[i])
  return saida
}

const MASCARAS: ((i: number, j: number) => boolean)[] = [
  (i, j) => (i + j) % 2 === 0,
  (i) => i % 2 === 0,
  (_i, j) => j % 3 === 0,
  (i, j) => (i + j) % 3 === 0,
  (i, j) => (Math.floor(i / 2) + Math.floor(j / 3)) % 2 === 0,
  (i, j) => ((i * j) % 2) + ((i * j) % 3) === 0,
  (i, j) => (((i * j) % 2) + ((i * j) % 3)) % 2 === 0,
  (i, j) => (((i + j) % 2) + ((i * j) % 3)) % 2 === 0,
]

function penalidade(m: boolean[][]): number {
  const n = m.length
  let p = 0
  // Regra 1: sequências de 5 ou mais módulos iguais
  for (let eixo = 0; eixo < 2; eixo++) {
    for (let a = 0; a < n; a++) {
      let corrida = 1
      for (let b = 1; b < n; b++) {
        const atual = eixo === 0 ? m[a][b] : m[b][a]
        const anterior = eixo === 0 ? m[a][b - 1] : m[b - 1][a]
        if (atual === anterior) corrida++
        else {
          if (corrida >= 5) p += 3 + (corrida - 5)
          corrida = 1
        }
      }
      if (corrida >= 5) p += 3 + (corrida - 5)
    }
  }
  // Regra 2: blocos 2x2
  for (let i = 0; i < n - 1; i++) {
    for (let j = 0; j < n - 1; j++) {
      if (m[i][j] === m[i][j + 1] && m[i][j] === m[i + 1][j] && m[i][j] === m[i + 1][j + 1]) p += 3
    }
  }
  // Regra 3: padrão parecido com o localizador (1:1:3:1:1) com 4 claros de um lado
  const padrao = [true, false, true, true, true, false, true]
  for (let eixo = 0; eixo < 2; eixo++) {
    for (let a = 0; a < n; a++) {
      for (let b = 0; b <= n - 7; b++) {
        const celula = (k: number) => (eixo === 0 ? m[a][b + k] : m[b + k][a])
        if (!padrao.every((v, k) => celula(k) === v)) continue
        const claros = (de: number, ate: number) => {
          for (let k = de; k < ate; k++) {
            if (k < 0 || k >= n) continue
            if ((eixo === 0 ? m[a][k] : m[k][a]) !== false) return false
          }
          return true
        }
        if (claros(b - 4, b) || claros(b + 7, b + 11)) p += 40
      }
    }
  }
  // Regra 4: equilíbrio entre claros e escuros
  let escuros = 0
  for (const linha of m) for (const c of linha) if (c) escuros++
  p += Math.floor(Math.abs((escuros * 100) / (n * n) - 50) / 5) * 10
  return p
}

function montar(versao: number, codewords: number[]): boolean[][] {
  const n = 17 + 4 * versao
  const m: boolean[][] = Array.from({ length: n }, () => new Array<boolean>(n).fill(false))
  const reservado: boolean[][] = Array.from({ length: n }, () => new Array<boolean>(n).fill(false))
  const pôr = (i: number, j: number, v: boolean) => {
    m[i][j] = v
    reservado[i][j] = true
  }

  // Localizadores com separador
  for (const [ci, cj] of [[0, 0], [0, n - 7], [n - 7, 0]]) {
    for (let i = -1; i <= 7; i++) {
      for (let j = -1; j <= 7; j++) {
        const ii = ci + i
        const jj = cj + j
        if (ii < 0 || jj < 0 || ii >= n || jj >= n) continue
        const dentro = i >= 0 && i <= 6 && j >= 0 && j <= 6
        const escuro = dentro && (i === 0 || i === 6 || j === 0 || j === 6 || (i >= 2 && i <= 4 && j >= 2 && j <= 4))
        pôr(ii, jj, escuro)
      }
    }
  }
  // Alinhamento
  const pos = ALINHAMENTO[versao - 1]
  for (const ci of pos) {
    for (const cj of pos) {
      if (reservado[ci][cj]) continue
      for (let i = -2; i <= 2; i++) {
        for (let j = -2; j <= 2; j++) pôr(ci + i, cj + j, Math.max(Math.abs(i), Math.abs(j)) !== 1)
      }
    }
  }
  // Temporização
  for (let k = 8; k < n - 8; k++) {
    if (!reservado[6][k]) pôr(6, k, k % 2 === 0)
    if (!reservado[k][6]) pôr(k, 6, k % 2 === 0)
  }
  // Áreas de formato e de versão ficam reservadas
  for (let k = 0; k < 9; k++) {
    reservado[8][k] = true
    reservado[k][8] = true
  }
  for (let k = 0; k < 8; k++) {
    reservado[8][n - 1 - k] = true
    reservado[n - 1 - k][8] = true
  }
  if (versao >= 7) {
    for (let i = 0; i < 6; i++) {
      for (let j = 0; j < 3; j++) {
        reservado[i][n - 11 + j] = true
        reservado[n - 11 + j][i] = true
      }
    }
  }
  pôr(n - 8, 8, true) // módulo escuro

  // Dados em zigue-zague, de baixo para cima, pulando a coluna de temporização
  const bits: boolean[] = []
  for (const c of codewords) for (let i = 7; i >= 0; i--) bits.push(((c >> i) & 1) === 1)
  let k = 0
  let sobe = true
  for (let x = n - 1; x > 0; x -= 2) {
    if (x === 6) x = 5
    for (let passo = 0; passo < n; passo++) {
      const i = sobe ? n - 1 - passo : passo
      for (const j of [x, x - 1]) {
        if (reservado[i][j]) continue
        m[i][j] = k < bits.length ? bits[k] : false
        k++
      }
    }
    sobe = !sobe
  }

  function aplicar(mascara: number): boolean[][] {
    const copia = m.map((l) => l.slice())
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) if (!reservado[i][j] && MASCARAS[mascara](i, j)) copia[i][j] = !copia[i][j]
    }
    // Formato: nível M (00) + máscara
    const formato = ((((0 << 3) | mascara) << 10) | bch((0 << 3) | mascara, 0x537, 11)) ^ 0x5412
    for (let i = 0; i < 15; i++) {
      const bit = ((formato >> i) & 1) === 1
      if (i < 6) copia[i][8] = bit
      else if (i < 8) copia[i + 1][8] = bit
      else copia[n - 15 + i][8] = bit
      if (i < 8) copia[8][n - i - 1] = bit
      else if (i < 9) copia[8][15 - i - 1 + 1] = bit
      else copia[8][15 - i - 1] = bit
    }
    copia[n - 8][8] = true
    if (versao >= 7) {
      const info = (versao << 12) | bch(versao, 0x1f25, 13)
      for (let i = 0; i < 18; i++) {
        const bit = ((info >> i) & 1) === 1
        copia[Math.floor(i / 3)][(i % 3) + n - 11] = bit
        copia[(i % 3) + n - 11][Math.floor(i / 3)] = bit
      }
    }
    return copia
  }

  let melhor = aplicar(0)
  let menor = penalidade(melhor)
  for (let mascara = 1; mascara < 8; mascara++) {
    const candidata = aplicar(mascara)
    const p = penalidade(candidata)
    if (p < menor) {
      menor = p
      melhor = candidata
    }
  }
  return melhor
}

/** Matriz do QR (true = módulo escuro). Dispara erro se o texto não couber nas versões 1 a 10. */
export function gerarQr(texto: string): boolean[][] {
  const bytes = bytesDoTexto(texto)
  for (let versao = 1; versao <= VERSOES.length; versao++) {
    const totalDados = VERSOES[versao - 1].grupos.reduce((s, [n, t]) => s + n * t, 0)
    if (4 + (versao < 10 ? 8 : 16) + bytes.length * 8 <= totalDados * 8) return montar(versao, codewordsDe(bytes, versao))
  }
  throw new Error('Texto grande demais para o QR (máximo de 213 bytes).')
}
