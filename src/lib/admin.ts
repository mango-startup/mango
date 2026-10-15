// Cliente da área de admin (/api/admin/*, contrato em server/openapi.json). A sessão é um cookie HttpOnly que o
// navegador manda sozinho; tudo que muda estado leva o header X-Mango-Admin (anti-CSRF). Não passa pela api do MangoApi.
import { ErroApi } from './api/tipos.ts'

export interface AdminEu {
  usuario: string
  nome: string
  trocar_senha: boolean
}

export interface Resumo {
  eventos_por_estado: Record<string, number>
  eventos_ultimos_7_dias: number
  convidados: number
  fotos: number
  fotos_ultimas_24_horas: number
  armazenamento_bytes: number
  pedidos_de_remocao_pendentes: number
}

export interface PacoteAdmin {
  id: string
  nome: string
  convidados: number
  preco_centavos: number
  retencao_dias: number
  poses_max: number
  ativo: boolean
  ordem: number
  gratis: boolean
  eventos?: number
}

export type NovoPacote = Pick<PacoteAdmin, 'id' | 'nome' | 'convidados' | 'preco_centavos' | 'retencao_dias' | 'poses_max'> & { ativo?: boolean; ordem?: number }
export type EdicaoPacote = Partial<Omit<PacoteAdmin, 'id' | 'gratis' | 'eventos'>>

export type TipoConfig = 'inteiro' | 'decimal' | 'booleano' | 'texto' | 'lista_inteiros'
export type ValorConfig = number | boolean | string | number[]

export interface ItemConfig {
  chave: string
  rotulo: string
  descricao: string
  tipo: TipoConfig
  unidade: string | null
  min: number | null
  max: number | null
  valor: ValorConfig
  padrao: ValorConfig
  personalizado: boolean
  atualizado_em: string | null
  publica: boolean
}

export interface GrupoConfig {
  nome: string
  itens: ItemConfig[]
}

export interface RegistroAuditoria {
  id: string
  usuario: string
  acao: string
  alvo: string | null
  antes: unknown
  depois: unknown
  criado_em: string
}

export interface PaginaAuditoria {
  pagina: number
  limite: number
  total: number
  registros: RegistroAuditoria[]
}

export interface Administrador {
  id: string
  usuario: string
  nome: string
  trocar_senha: boolean
  ultimo_login_em: string | null
}

async function chamar<T>(metodo: 'GET' | 'POST' | 'PATCH', caminho: string, corpo?: unknown): Promise<T> {
  const cabecalhos: Record<string, string> = {}
  if (metodo !== 'GET') cabecalhos['X-Mango-Admin'] = '1'
  if (corpo !== undefined) cabecalhos['Content-Type'] = 'application/json'
  const r = await fetch(caminho, { method: metodo, headers: cabecalhos, body: corpo === undefined ? undefined : JSON.stringify(corpo), credentials: 'same-origin' })
  if (r.status === 204) return undefined as T
  const dados = (await r.json().catch(() => null)) as (Record<string, unknown> & { erro?: string; mensagem?: string }) | null
  if (!r.ok) {
    const { erro, mensagem, ...extra } = dados ?? {}
    throw new ErroApi(r.status, typeof erro === 'string' ? erro : 'erro_interno', typeof mensagem === 'string' ? mensagem : 'O servidor teve um problema. Tente de novo.', extra)
  }
  return dados as T
}

/** Mensagens de campo que o servidor manda em `erros` (por campo ou por chave de configuração). */
export function errosDeCampo(e: unknown): Record<string, string> {
  if (e instanceof ErroApi && e.extra.erros && typeof e.extra.erros === 'object') return e.extra.erros as Record<string, string>
  return {}
}

export const admin = {
  eu: () => chamar<{ admin: AdminEu }>('GET', '/api/admin/eu').then((r) => r.admin),
  entrar: (usuario: string, senha: string) => chamar<{ admin: AdminEu }>('POST', '/api/admin/entrar', { usuario, senha }).then((r) => r.admin),
  sair: () => chamar<void>('POST', '/api/admin/sair'),
  trocarSenha: (senhaAtual: string, novaSenha: string) => chamar<{ ok: boolean }>('POST', '/api/admin/trocar-senha', { senha_atual: senhaAtual, nova_senha: novaSenha }),
  resumo: () => chamar<Resumo>('GET', '/api/admin/resumo'),
  pacotes: () => chamar<{ pacotes: PacoteAdmin[] }>('GET', '/api/admin/pacotes').then((r) => r.pacotes),
  criarPacote: (dados: NovoPacote) => chamar<{ pacote: PacoteAdmin }>('POST', '/api/admin/pacotes', dados).then((r) => r.pacote),
  editarPacote: (id: string, dados: EdicaoPacote) => chamar<{ pacote: PacoteAdmin }>('PATCH', `/api/admin/pacotes/${encodeURIComponent(id)}`, dados).then((r) => r.pacote),
  configuracoes: () => chamar<{ grupos: GrupoConfig[] }>('GET', '/api/admin/configuracoes').then((r) => r.grupos),
  /** `null` volta a chave ao padrão. Tudo ou nada. */
  salvarConfiguracoes: (mudancas: Record<string, ValorConfig | null>) => chamar<{ ok: boolean }>('PATCH', '/api/admin/configuracoes', mudancas),
  auditoria: (pagina = 1, limite = 50) => chamar<PaginaAuditoria>('GET', `/api/admin/auditoria?pagina=${pagina}&limite=${limite}`),
  administradores: () => chamar<{ administradores: Administrador[] }>('GET', '/api/admin/administradores').then((r) => r.administradores),
  redefinirSenha: (id: string) => chamar<{ usuario: string; senha_temporaria: string }>('POST', `/api/admin/administradores/${id}/redefinir-senha`),
}

/** "49,90" ou "49.90" → 4990. Vazio ou inválido → null. */
export function reaisParaCentavos(texto: string): number | null {
  const limpo = texto.trim().replace(/^R\$\s*/, '').replace(/\./g, '').replace(',', '.')
  if (!/^\d+(\.\d{1,2})?$/.test(limpo)) return null
  return Math.round(Number(limpo) * 100)
}

/** 4990 → "49,90". */
export function centavosParaCampo(centavos: number): string {
  return (centavos / 100).toFixed(2).replace('.', ',')
}

export function formatarBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  const unidades = ['KB', 'MB', 'GB', 'TB']
  let valor = bytes / 1024
  let i = 0
  while (valor >= 1024 && i < unidades.length - 1) {
    valor /= 1024
    i++
  }
  return `${valor.toFixed(valor < 10 ? 1 : 0).replace('.', ',')} ${unidades[i]}`
}
