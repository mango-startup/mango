import type { Pool } from 'pg'
import type { AdminRef } from './configuracao.ts'

// Preço dinâmico por participante (#169). Mesma conta do simulador do admin (src/lib/simuladorPreco.ts no front):
// quem mexer aqui precisa mexer lá, e o teste de preço guarda os valores de referência dos dois.

export interface Degrau {
  /** Último participante (número total) coberto por este preço; null = sem limite. */
  ate: number | null
  centavos: number
}

export interface ParamsPreco {
  gratis: number
  cobrarTodos: boolean
  fotosTeste: number
  fotosLimitadas: number
  fotosBase: number
  fotoExtraCentavos: number
  degraus: Degrau[]
  ilimitadoCentavos: number
  tetoIlimitado: number
  pisoCentavos: number
  arredondar90: boolean
}

export const PARAMS_PADRAO: ParamsPreco = {
  gratis: 5,
  cobrarTodos: true,
  fotosTeste: 10,
  fotosLimitadas: 10,
  fotosBase: 10,
  fotoExtraCentavos: 6,
  degraus: [
    { ate: 50, centavos: 150 },
    { ate: 100, centavos: 120 },
    { ate: null, centavos: 100 },
  ],
  ilimitadoCentavos: 450,
  tetoIlimitado: 100,
  pisoCentavos: 1490,
  arredondar90: true,
}

/** Valor em centavos para `participantes` com `fotos` por pessoa (ou ilimitadas). Até `gratis` participantes, zero. */
export function calcularPreco(participantes: number, p: ParamsPreco, fotos: number | 'ilimitado'): number {
  const total = Math.max(0, Math.floor(participantes))
  if (total <= p.gratis) return 0
  const pagos = p.cobrarTodos ? total : total - p.gratis
  let porDegrau = 0
  let inicio = p.cobrarTodos ? 0 : p.gratis
  for (const d of p.degraus) {
    const fim = d.ate ?? Infinity
    porDegrau += Math.max(0, Math.min(total, fim) - inicio) * d.centavos
    inicio = Math.max(inicio, fim)
  }
  const bruto = fotos === 'ilimitado' ? pagos * p.ilimitadoCentavos : porDegrau + pagos * Math.max(0, fotos - p.fotosBase) * p.fotoExtraCentavos
  const comPiso = Math.max(bruto, p.pisoCentavos)
  return p.arredondar90 ? Math.ceil((comPiso - 90) / 100) * 100 + 90 : comPiso
}

export type Erros = Record<string, string>

const inteiro = (v: unknown, min: number, max: number): v is number => typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max

/** Aceita só o formato completo e coerente; devolve os erros por campo. */
export function validarParams(dados: unknown): { ok: true; params: ParamsPreco } | { ok: false; erros: Erros } {
  const erros: Erros = {}
  const d = (dados && typeof dados === 'object' ? dados : {}) as Record<string, unknown>
  const centavos = (campo: string, max = 10_000_000) => {
    if (!inteiro(d[campo], 0, max)) erros[campo] = `Informe um número inteiro de centavos, de 0 a ${max}.`
  }
  if (!inteiro(d.gratis, 0, 1000)) erros.gratis = 'Informe um inteiro de 0 a 1000.'
  if (typeof d.cobrarTodos !== 'boolean') erros.cobrarTodos = 'Use verdadeiro ou falso.'
  if (typeof d.arredondar90 !== 'boolean') erros.arredondar90 = 'Use verdadeiro ou falso.'
  for (const campo of ['fotosTeste', 'fotosLimitadas', 'fotosBase', 'tetoIlimitado']) {
    if (!inteiro(d[campo], 1, 500)) erros[campo] = 'Informe um inteiro de 1 a 500.'
  }
  centavos('fotoExtraCentavos', 100_000)
  centavos('ilimitadoCentavos', 100_000)
  centavos('pisoCentavos')
  const degraus = d.degraus
  if (!Array.isArray(degraus) || degraus.length < 1 || degraus.length > 6) {
    erros.degraus = 'Informe de 1 a 6 degraus.'
  } else {
    let anterior = typeof d.gratis === 'number' ? (d.cobrarTodos === false ? d.gratis : 0) : 0
    degraus.forEach((g, i) => {
      const ultimo = i === degraus.length - 1
      const item = (g && typeof g === 'object' ? g : {}) as Record<string, unknown>
      if (!inteiro(item.centavos, 0, 100_000)) erros[`degraus.${i}.centavos`] = 'Informe o preço em centavos.'
      if (ultimo) {
        if (item.ate !== null) erros[`degraus.${i}.ate`] = 'O último degrau não tem limite (null).'
      } else if (!inteiro(item.ate, anterior + 1, 100_000)) {
        erros[`degraus.${i}.ate`] = `O limite precisa ser maior que ${anterior}.`
      } else {
        anterior = item.ate
      }
    })
  }
  if (Object.keys(erros).length) return { ok: false, erros }
  const g = degraus as Degrau[]
  return {
    ok: true,
    params: {
      gratis: d.gratis as number,
      cobrarTodos: d.cobrarTodos as boolean,
      fotosTeste: d.fotosTeste as number,
      fotosLimitadas: d.fotosLimitadas as number,
      fotosBase: d.fotosBase as number,
      fotoExtraCentavos: d.fotoExtraCentavos as number,
      degraus: g.map((x) => ({ ate: x.ate, centavos: x.centavos })),
      ilimitadoCentavos: d.ilimitadoCentavos as number,
      tetoIlimitado: d.tetoIlimitado as number,
      pisoCentavos: d.pisoCentavos as number,
      arredondar90: d.arredondar90 as boolean,
    },
  }
}

export interface PrecoPublicado {
  /** false enquanto o admin nunca publicou: valem os valores propostos. */
  publicado: boolean
  params: ParamsPreco
  atualizado_em: string | null
  atualizado_por: string | null
}

export class ServicoPrecos {
  private pool: Pool

  constructor(pool: Pool) {
    this.pool = pool
  }

  async obter(): Promise<PrecoPublicado> {
    const r = await this.pool.query<{ params: unknown; atualizado_em: Date; atualizado_por: string }>('select params, atualizado_em, atualizado_por from preco_modelo where id = 1')
    const linha = r.rows[0]
    if (!linha) return { publicado: false, params: PARAMS_PADRAO, atualizado_em: null, atualizado_por: null }
    const v = validarParams(linha.params)
    return { publicado: v.ok, params: v.ok ? v.params : PARAMS_PADRAO, atualizado_em: linha.atualizado_em.toISOString(), atualizado_por: linha.atualizado_por }
  }

  async publicar(dados: unknown, admin: AdminRef): Promise<{ ok: true; preco: PrecoPublicado } | { ok: false; erros: Erros }> {
    const v = validarParams(dados)
    if (!v.ok) return v
    const antes = await this.obter()
    const cliente = await this.pool.connect()
    try {
      await cliente.query('begin')
      await cliente.query(
        `insert into preco_modelo (id, params, atualizado_por) values (1, $1::jsonb, $2)
         on conflict (id) do update set params = excluded.params, atualizado_em = now(), atualizado_por = excluded.atualizado_por`,
        [JSON.stringify(v.params), admin.usuario],
      )
      await cliente.query(`insert into auditoria_admin (admin_id, usuario, acao, alvo, antes, depois) values ($1,$2,'preco.publicar','preco_modelo',$3::jsonb,$4::jsonb)`, [
        admin.id,
        admin.usuario,
        antes.publicado ? JSON.stringify(antes.params) : null,
        JSON.stringify(v.params),
      ])
      await cliente.query('commit')
    } catch (e) {
      await cliente.query('rollback').catch(() => {})
      throw e
    } finally {
      cliente.release()
    }
    return { ok: true, preco: await this.obter() }
  }
}
