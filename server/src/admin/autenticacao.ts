import { randomBytes } from 'node:crypto'
import type { Pool } from 'pg'
import { hashToken } from '../tokens.ts'
import { conferirSenha, hashFalso, hashSenha, senhaTemporaria, validarSenhaNova } from './senha.ts'

// Constantes de segurança: ficam no código de propósito (não são "negócio" e não devem ser afrouxadas pela tela).
const MAX_FALHAS = 5
const BLOQUEIO_MS = 15 * 60_000
const SESSAO_MS = 8 * 3600_000

export interface Admin {
  id: string
  usuario: string
  nome: string
  trocar_senha: boolean
}

interface LinhaAdmin extends Admin {
  senha_hash: string
  tentativas_falhas: number
  bloqueado_ate: Date | null
}

export type ResultadoEntrada =
  | { ok: true; token: string; admin: Admin; expiraEm: Date }
  | { ok: false; erro: 'credenciais_invalidas' | 'conta_bloqueada'; retryEmSegundos?: number }

export class ServicoAdmin {
  private pool: Pool
  private agora: () => Date

  constructor(pool: Pool, agora: () => Date = () => new Date()) {
    this.pool = pool
    this.agora = agora
  }

  private async auditar(admin: { id: string | null; usuario: string }, acao: string, alvo?: string, depois?: unknown): Promise<void> {
    await this.pool.query(`insert into auditoria_admin (admin_id, usuario, acao, alvo, depois, criado_em) values ($1,$2,$3,$4,$5::jsonb,$6)`, [
      admin.id,
      admin.usuario,
      acao,
      alvo ?? null,
      depois === undefined ? null : JSON.stringify(depois),
      this.agora(),
    ])
  }

  /** Cria os admins que ainda não existem, todos com a senha inicial e troca obrigatória no primeiro login. Nunca altera quem já existe. */
  async garantirAdmins(usuarios: { usuario: string; nome: string }[], senhaInicial: string): Promise<string[]> {
    const criados: string[] = []
    for (const { usuario, nome } of usuarios) {
      const existe = await this.pool.query('select 1 from admins where usuario = $1', [usuario])
      if (existe.rowCount) continue
      await this.pool.query('insert into admins (usuario, nome, senha_hash, trocar_senha) values ($1,$2,$3,true)', [usuario, nome, await hashSenha(senhaInicial)])
      criados.push(usuario)
    }
    return criados
  }

  async entrar(usuarioBruto: string, senha: string): Promise<ResultadoEntrada> {
    const usuario = usuarioBruto.trim().toLowerCase()
    const agora = this.agora()
    const r = await this.pool.query<LinhaAdmin>(
      'select id, usuario, nome, trocar_senha, senha_hash, tentativas_falhas, bloqueado_ate from admins where usuario = $1',
      [usuario],
    )
    const admin = r.rows[0]
    if (!admin) {
      await conferirSenha(senha, await hashFalso()) // mesmo custo de tempo: não revela quem existe
      return { ok: false, erro: 'credenciais_invalidas' }
    }
    if (admin.bloqueado_ate && admin.bloqueado_ate > agora) {
      return { ok: false, erro: 'conta_bloqueada', retryEmSegundos: Math.ceil((admin.bloqueado_ate.getTime() - agora.getTime()) / 1000) }
    }
    if (!(await conferirSenha(senha, admin.senha_hash))) {
      const falhas = admin.tentativas_falhas + 1
      if (falhas >= MAX_FALHAS) {
        await this.pool.query('update admins set tentativas_falhas = 0, bloqueado_ate = $2 where id = $1', [admin.id, new Date(agora.getTime() + BLOQUEIO_MS)])
        await this.auditar(admin, 'admin.conta_bloqueada', admin.usuario)
      } else {
        await this.pool.query('update admins set tentativas_falhas = $2 where id = $1', [admin.id, falhas])
      }
      return { ok: false, erro: 'credenciais_invalidas' }
    }

    const token = randomBytes(32).toString('base64url')
    const expiraEm = new Date(agora.getTime() + SESSAO_MS)
    await this.pool.query('update admins set tentativas_falhas = 0, bloqueado_ate = null, ultimo_login_em = $2 where id = $1', [admin.id, agora])
    await this.pool.query('delete from admin_sessoes where admin_id = $1 and expira_em <= $2', [admin.id, agora])
    await this.pool.query('insert into admin_sessoes (token_hash, admin_id, criado_em, expira_em) values ($1,$2,$3,$4)', [hashToken(token), admin.id, agora, expiraEm])
    await this.auditar(admin, 'admin.entrar')
    return { ok: true, token, admin: { id: admin.id, usuario: admin.usuario, nome: admin.nome, trocar_senha: admin.trocar_senha }, expiraEm }
  }

  async porToken(token: string): Promise<Admin | null> {
    const r = await this.pool.query<Admin>(
      `select a.id, a.usuario, a.nome, a.trocar_senha from admin_sessoes s join admins a on a.id = s.admin_id
       where s.token_hash = $1 and s.expira_em > $2`,
      [hashToken(token), this.agora()],
    )
    return r.rows[0] ?? null
  }

  async sair(token: string): Promise<void> {
    await this.pool.query('delete from admin_sessoes where token_hash = $1', [hashToken(token)])
  }

  /** Troca a própria senha. Encerra as outras sessões deste admin (a atual continua). */
  async trocarSenha(admin: Admin, atual: string, nova: string, tokenAtual: string): Promise<{ ok: true } | { ok: false; erro: string; mensagem: string }> {
    const r = await this.pool.query<{ senha_hash: string }>('select senha_hash from admins where id = $1', [admin.id])
    if (!r.rows[0] || !(await conferirSenha(atual, r.rows[0].senha_hash))) {
      return { ok: false, erro: 'senha_atual_incorreta', mensagem: 'A senha atual não confere.' }
    }
    const problema = validarSenhaNova(nova, { usuario: admin.usuario, atual })
    if (problema) return { ok: false, erro: 'senha_fraca', mensagem: problema }
    await this.pool.query('update admins set senha_hash = $2, trocar_senha = false, tentativas_falhas = 0, bloqueado_ate = null where id = $1', [admin.id, await hashSenha(nova)])
    await this.pool.query('delete from admin_sessoes where admin_id = $1 and token_hash <> $2', [admin.id, hashToken(tokenAtual)])
    await this.auditar(admin, 'admin.trocar_senha')
    return { ok: true }
  }

  async listar(): Promise<{ id: string; usuario: string; nome: string; trocar_senha: boolean; ultimo_login_em: Date | null }[]> {
    const r = await this.pool.query('select id, usuario, nome, trocar_senha, ultimo_login_em from admins order by usuario')
    return r.rows
  }

  /** Outro admin esqueceu a senha: gera uma temporária (mostrada uma vez) e obriga a trocar no próximo login. */
  async redefinir(alvoId: string, por: Admin): Promise<{ ok: true; usuario: string; senha: string } | { ok: false; status: 400 | 404; erro: string; mensagem: string }> {
    if (alvoId === por.id) return { ok: false, status: 400, erro: 'redefinir_a_si_mesmo', mensagem: 'Para mudar a sua senha use "Trocar senha".' }
    const r = await this.pool.query<{ usuario: string }>('select usuario from admins where id = $1', [alvoId])
    if (!r.rows[0]) return { ok: false, status: 404, erro: 'nao_encontrado', mensagem: 'Administrador não encontrado.' }
    const senha = senhaTemporaria()
    await this.pool.query('update admins set senha_hash = $2, trocar_senha = true, tentativas_falhas = 0, bloqueado_ate = null where id = $1', [alvoId, await hashSenha(senha)])
    await this.pool.query('delete from admin_sessoes where admin_id = $1', [alvoId])
    await this.auditar(por, 'admin.redefinir_senha', r.rows[0].usuario)
    return { ok: true, usuario: r.rows[0].usuario, senha }
  }
}
