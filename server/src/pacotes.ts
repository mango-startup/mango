import type { Pool } from 'pg'
import type { AdminRef } from './configuracao.ts'

/** Pacote como o servidor guarda (tabela `pacotes`). `gratis` é derivado: preço zero. */
export interface Pacote {
  id: string
  nome: string
  convidados: number
  preco_centavos: number
  retencao_dias: number
  poses_max: number
  ativo: boolean
  ordem: number
  gratis: boolean
}

/** O pacote de teste é a porta de entrada gratuita: o front e o plano contam com ele. Não pode ser desativado nem cobrado. */
export const PACOTE_PROTEGIDO = 'teste'

interface Linha {
  id: string
  nome: string
  convidados: number
  preco_centavos: number
  retencao_dias: number
  poses_max: number
  ativo: boolean
  ordem: number
}

const COLUNAS = 'id, nome, convidados, preco_centavos, retencao_dias, poses_max, ativo, ordem'
const paraPacote = (l: Linha): Pacote => ({ ...l, gratis: l.preco_centavos === 0 })

export type Erros = Record<string, string>

const inteiro = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v)

/** Valida os campos informados (criação exige todos; edição só o que veio). */
export function validarPacote(dados: Record<string, unknown>, opcoes: { completo: boolean; maiorPose: number }): Erros {
  const erros: Erros = {}
  const faixa = (campo: string, min: number, max: number, rotulo: string, obrigatorio = true) => {
    if (dados[campo] === undefined) {
      if (opcoes.completo && obrigatorio) erros[campo] = 'Obrigatório.'
      return
    }
    if (!inteiro(dados[campo])) erros[campo] = 'Informe um número inteiro.'
    else if ((dados[campo] as number) < min || (dados[campo] as number) > max) erros[campo] = `${rotulo}: de ${min} a ${max}.`
  }
  if (dados.nome === undefined) {
    if (opcoes.completo) erros.nome = 'Obrigatório.'
  } else if (typeof dados.nome !== 'string' || dados.nome.trim().length < 1 || dados.nome.trim().length > 40) {
    erros.nome = 'O nome precisa ter de 1 a 40 caracteres.'
  }
  faixa('convidados', 1, 5000, 'Convidados')
  faixa('preco_centavos', 0, 10_000_000, 'Preço em centavos')
  faixa('retencao_dias', 1, 3650, 'Retenção em dias')
  faixa('poses_max', 1, opcoes.maiorPose, `Poses máximas (não passa da maior opção de poses, ${opcoes.maiorPose})`)
  faixa('ordem', 0, 1000, 'Ordem', false)
  if (dados.ativo !== undefined && typeof dados.ativo !== 'boolean') erros.ativo = 'Use verdadeiro ou falso.'
  return erros
}

export class ServicoPacotes {
  private pool: Pool
  private ttlMs: number
  private cache: { em: number; lista: Pacote[] } | null = null

  constructor(pool: Pool, ttlMs = 10_000) {
    this.pool = pool
    this.ttlMs = ttlMs
  }

  invalidar(): void {
    this.cache = null
  }

  /** Todos, na ordem de exibição. */
  async listar(): Promise<Pacote[]> {
    if (this.cache && Date.now() - this.cache.em < this.ttlMs) return this.cache.lista
    const r = await this.pool.query<Linha>(`select ${COLUNAS} from pacotes order by ordem, id`)
    const lista = r.rows.map(paraPacote)
    this.cache = { em: Date.now(), lista }
    return lista
  }

  async obter(id: string): Promise<Pacote | null> {
    return (await this.listar()).find((p) => p.id === id) ?? null
  }

  async criar(dados: Record<string, unknown>, admin: AdminRef, maiorPose: number): Promise<{ ok: true; pacote: Pacote } | { ok: false; status: 400 | 409; erros: Erros }> {
    const erros = validarPacote(dados, { completo: true, maiorPose })
    const id = typeof dados.id === 'string' ? dados.id : ''
    if (!/^[a-z][a-z0-9_]{1,29}$/.test(id)) erros.id = 'Use letras minúsculas, números e _ (2 a 30 caracteres, começando por letra).'
    if (Object.keys(erros).length) return { ok: false, status: 400, erros }
    if (await this.obter(id)) return { ok: false, status: 409, erros: { id: 'Já existe um pacote com esse id.' } }

    const ordem = (dados.ordem as number | undefined) ?? (await this.listar()).reduce((m, p) => Math.max(m, p.ordem), 0) + 1
    const cliente = await this.pool.connect()
    try {
      await cliente.query('begin')
      const r = await cliente.query<Linha>(
        `insert into pacotes (id, nome, convidados, preco_centavos, retencao_dias, poses_max, ativo, ordem)
         values ($1,$2,$3,$4,$5,$6,$7,$8) returning ${COLUNAS}`,
        [id, (dados.nome as string).trim(), dados.convidados, dados.preco_centavos, dados.retencao_dias, dados.poses_max, dados.ativo ?? true, ordem],
      )
      await cliente.query(`insert into auditoria_admin (admin_id, usuario, acao, alvo, antes, depois) values ($1,$2,'pacote.criar',$3,null,$4::jsonb)`, [
        admin.id,
        admin.usuario,
        id,
        JSON.stringify(paraPacote(r.rows[0])),
      ])
      await cliente.query('commit')
      this.invalidar()
      return { ok: true, pacote: paraPacote(r.rows[0]) }
    } catch (e) {
      await cliente.query('rollback').catch(() => {})
      throw e
    } finally {
      cliente.release()
    }
  }

  /** Eventos já criados não mudam: convidados e retenção ficam gravados no evento. */
  async atualizar(id: string, dados: Record<string, unknown>, admin: AdminRef, maiorPose: number): Promise<{ ok: true; pacote: Pacote } | { ok: false; status: 400 | 404 | 409; erros: Erros }> {
    const atual = await this.obter(id)
    if (!atual) return { ok: false, status: 404, erros: { id: 'Pacote não encontrado.' } }
    const permitidos = ['nome', 'convidados', 'preco_centavos', 'retencao_dias', 'poses_max', 'ativo', 'ordem']
    const erros = validarPacote(dados, { completo: false, maiorPose })
    for (const k of Object.keys(dados)) if (!permitidos.includes(k)) erros[k] = 'Este campo não pode ser alterado.'
    if (id === PACOTE_PROTEGIDO) {
      if (dados.ativo === false) erros.ativo = 'O pacote de teste não pode ser desativado.'
      if (typeof dados.preco_centavos === 'number' && dados.preco_centavos !== 0) erros.preco_centavos = 'O pacote de teste é grátis.'
    }
    if (Object.keys(dados).length === 0) erros.corpo = 'Nada para alterar.'
    if (Object.keys(erros).length) return { ok: false, status: 400, erros }

    const novo = { ...atual, ...dados, nome: typeof dados.nome === 'string' ? dados.nome.trim() : atual.nome } as Pacote
    const mudou = (['nome', 'convidados', 'preco_centavos', 'retencao_dias', 'poses_max', 'ativo', 'ordem'] as const).some((k) => novo[k] !== atual[k])
    if (!mudou) return { ok: true, pacote: atual }

    const cliente = await this.pool.connect()
    try {
      await cliente.query('begin')
      const r = await cliente.query<Linha>(
        `update pacotes set nome=$2, convidados=$3, preco_centavos=$4, retencao_dias=$5, poses_max=$6, ativo=$7, ordem=$8, atualizado_em=now()
         where id=$1 returning ${COLUNAS}`,
        [id, novo.nome, novo.convidados, novo.preco_centavos, novo.retencao_dias, novo.poses_max, novo.ativo, novo.ordem],
      )
      await cliente.query(`insert into auditoria_admin (admin_id, usuario, acao, alvo, antes, depois) values ($1,$2,'pacote.alterar',$3,$4::jsonb,$5::jsonb)`, [
        admin.id,
        admin.usuario,
        id,
        JSON.stringify(atual),
        JSON.stringify(paraPacote(r.rows[0])),
      ])
      await cliente.query('commit')
      this.invalidar()
      return { ok: true, pacote: paraPacote(r.rows[0]) }
    } catch (e) {
      await cliente.query('rollback').catch(() => {})
      throw e
    } finally {
      cliente.release()
    }
  }
}
