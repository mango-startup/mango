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

export interface EventoAdmin {
  id: string
  codigo: string
  nome: string
  anfitriao_email: string
  estado: string
  pacote: string
  limite_convidados: number
  convidados: number
  fotos: number
  armazenamento_bytes: number
  criado_em: string
}

export interface PaginaEventos {
  pagina: number
  limite: number
  total: number
  eventos: EventoAdmin[]
}

export interface FiltroEventos {
  estado?: string
  pacote?: string
  busca?: string
  ordem?: string
  de?: string
  ate?: string
}

export interface PagamentoAdmin {
  id: string
  evento_id: string
  evento_nome: string
  pacote: string
  valor_centavos: number
  status: string
  criado_em: string
}

export interface PaginaPagamentos {
  pagina: number
  limite: number
  total: number
  receita_centavos: number
  por_status: Record<string, { pagamentos: number; valor_centavos: number }>
  pagamentos: PagamentoAdmin[]
}

export interface Crescimento {
  dias: number
  totais: { eventos: number; convidados: number; fotos: number; receita_centavos: number }
  serie: { dia: string; eventos: number; convidados: number; fotos: number; receita_centavos: number }[]
}

export interface PedidoRemocaoAdmin {
  id: string
  evento_id: string
  evento_nome: string
  anfitriao_email: string
  foto_id: string
  motivo: string | null
  criado_em: string
}

export interface ModeracaoAdmin {
  pendentes: PedidoRemocaoAdmin[]
  resolvidos: { removida: number; mantida: number }
}

export interface AnfitriaoAdmin {
  anfitriao_email: string
  eventos: number
  fotos: number
  pago_centavos: number
  primeiro_evento_em: string
  ultimo_evento_em: string
}

export interface PaginaAnfitrioes {
  pagina: number
  limite: number
  total: number
  anfitrioes: AnfitriaoAdmin[]
}

export interface SaudeAdmin {
  banco: { ok: boolean; latencia_ms: number }
  fotos_aguardando_limpeza: number
  fotos_aguardando_limpeza_ha_mais_de_2_dias: number
  pagamentos_aprovados_sem_evento: number
  ultimo_webhook_do_stripe_em: string | null
  pedidos_de_remocao_pendentes_ha_mais_de_2_dias: number
}

export interface AoVivo {
  eventos: { id: string; nome: string; anfitriao_email: string; captura_fim: string; limite_convidados: number; convidados: number; fotos: number; fotos_ultima_hora: number }[]
}

export interface Retencao {
  anfitrioes: number
  recorrentes: number
  taxa_recorrencia: number | null
  dias_medios_entre_eventos: number | null
}

export interface Armazenamento {
  total_bytes: number
  bytes_por_evento: number
  bytes_por_semana_recente: number
  semanas: { semana: string; bytes: number; fotos: number }[]
}

export interface VistaAnfitriao {
  evento: {
    id: string
    codigo: string
    nome: string
    estado: string
    anfitriao_email: string | null
    album_privado: boolean
    captura_inicio: string | null
    captura_fim: string | null
    revelacao_em: string | null
    revelado_em: string | null
    expira_em: string | null
    poses_por_convidado: number
    limite_convidados: number
    convidados: number
    fotos: number
  }
  pedidos_de_remocao: { id: string; numero: number | null; motivo: string | null; criado_em: string }[]
}

export interface FotoAlbumAdmin {
  id: string
  numero: number
  apelido: string | null
  tirada_em: string | null
  tem_miniatura: boolean
}

export interface EmailEnviado {
  id: string
  usuario: string
  destinatario: string
  assunto: string
  corpo: string
  status: 'enviado' | 'falhou'
  erro: string | null
  criado_em: string
}

export interface SessaoAdmin {
  id: string
  atual: boolean
  criado_em: string
  expira_em: string
}

export interface Dupla {
  atual: number
  anterior: number
}

export interface Analise {
  dias: number
  periodo: { eventos: Dupla; convidados: Dupla; fotos: Dupla; pagamentos_aprovados: Dupla; receita_centavos: Dupla; ticket_medio_centavos: Dupla }
  funil: { criados: number; ativados: number; com_fotos: number; revelados: number; pagos_criados: number; pagos_ativados: number; conversao_paga: number | null }
  medias: { fotos_por_evento: number; convidados_por_evento: number; fotos_por_convidado: number; ocupacao_das_vagas: number | null; eventos_capturando_agora: number }
  pacotes: { id: string; nome: string; preco_centavos: number; eventos_no_periodo: number; eventos_total: number; receita_no_periodo_centavos: number; fotos: number; armazenamento_bytes: number }[]
  maiores_eventos: { id: string; nome: string; anfitriao_email: string; pacote: string; estado: string; fotos: number; convidados: number; armazenamento_bytes: number }[]
}

export interface EventoDetalhe {
  evento: {
    id: string
    codigo: string
    nome: string
    anfitriao_email: string
    estado: string
    pacote: string
    pacote_nome: string | null
    limite_convidados: number
    poses_por_convidado: number
    limite_fotos: number | null
    captura_inicio: string | null
    captura_fim: string | null
    revelacao_em: string | null
    revelado_em: string | null
    expira_em: string | null
    album_privado: boolean
    criado_em: string
    excluido_em: string | null
  }
  fotos: { total: number; removidas: number; armazenamento_bytes: number; primeira_em: string | null; ultima_em: string | null }
  convidados: { id: string; apelido: string | null; criado_em: string; fotos: number }[]
  pagamentos: { id: string; valor_centavos: number; status: string; criado_em: string }[]
  pedidos_de_remocao: { id: string; foto_id: string; motivo: string | null; resolucao: string | null; resolvido_em: string | null; criado_em: string }[]
}

async function chamar<T>(metodo: 'GET' | 'POST' | 'PATCH' | 'DELETE', caminho: string, corpo?: unknown): Promise<T> {
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
  auditoria: (pagina = 1, limite = 50, filtro: { usuario?: string; acao?: string } = {}) => {
    const q = new URLSearchParams({ pagina: String(pagina), limite: String(limite) })
    for (const [k, v] of Object.entries(filtro)) if (v) q.set(k, v)
    return chamar<PaginaAuditoria>('GET', `/api/admin/auditoria?${q}`)
  },
  analise: (dias: number) => chamar<Analise>('GET', `/api/admin/analise?dias=${dias}`),
  evento: (id: string) => chamar<EventoDetalhe>('GET', `/api/admin/eventos/${encodeURIComponent(id)}`),
  eventos: (filtro: FiltroEventos = {}, pagina = 1) => {
    const q = new URLSearchParams({ pagina: String(pagina) })
    for (const [k, v] of Object.entries(filtro)) if (v) q.set(k, v)
    return chamar<PaginaEventos>('GET', `/api/admin/eventos?${q}`)
  },
  crescimento: (dias: number) => chamar<Crescimento>('GET', `/api/admin/crescimento?dias=${dias}`),
  moderacao: () => chamar<ModeracaoAdmin>('GET', '/api/admin/moderacao'),
  anfitrioes: (busca = '', pagina = 1) => chamar<PaginaAnfitrioes>('GET', `/api/admin/anfitrioes?pagina=${pagina}${busca ? `&busca=${encodeURIComponent(busca)}` : ''}`),
  aoVivo: () => chamar<AoVivo>('GET', '/api/admin/ao-vivo'),
  retencao: () => chamar<Retencao>('GET', '/api/admin/retencao'),
  armazenamento: () => chamar<Armazenamento>('GET', '/api/admin/armazenamento'),
  estenderCamera: (id: string, minutos: number) => chamar<{ captura_fim: string; revelacao_em: string | null }>('POST', `/api/admin/eventos/${encodeURIComponent(id)}/estender-camera`, { minutos }),
  resolverPedidos: (ids: string[], resolucao: 'removida' | 'mantida') => chamar<{ resolvidos: number }>('POST', '/api/admin/moderacao/resolver', { ids, resolucao }),
  reverterAuditoria: (id: string) => chamar<{ ok: boolean; chave: string }>('POST', `/api/admin/auditoria/${encodeURIComponent(id)}/reverter`),
  sessoes: () => chamar<{ sessoes: SessaoAdmin[] }>('GET', '/api/admin/sessoes').then((r) => r.sessoes),
  encerrarSessao: (id: string) => chamar<void>('DELETE', `/api/admin/sessoes/${encodeURIComponent(id)}`),
  comoAnfitriao: (id: string) => chamar<VistaAnfitriao>('GET', `/api/admin/eventos/${encodeURIComponent(id)}/como-anfitriao`),
  albumDoEvento: (id: string, pagina = 1) => chamar<{ pagina: number; limite: number; total: number; fotos: FotoAlbumAdmin[] }>('GET', `/api/admin/eventos/${encodeURIComponent(id)}/album?pagina=${pagina}&limite=48`),
  emails: (id: string) => chamar<{ configurado: boolean; emails: EmailEnviado[] }>('GET', `/api/admin/eventos/${encodeURIComponent(id)}/emails`),
  enviarEmail: (id: string, assunto: string, texto: string) => chamar<{ ok: boolean; destinatario: string }>('POST', `/api/admin/eventos/${encodeURIComponent(id)}/emails`, { assunto, texto }),
  saude: () => chamar<SaudeAdmin>('GET', '/api/admin/saude'),
  pagamentos: (status = '', pagina = 1) => chamar<PaginaPagamentos>('GET', `/api/admin/pagamentos?pagina=${pagina}${status ? `&status=${encodeURIComponent(status)}` : ''}`),
  administradores: () => chamar<{ administradores: Administrador[] }>('GET', '/api/admin/administradores').then((r) => r.administradores),
  redefinirSenha: (id: string) => chamar<{ usuario: string; senha_temporaria: string }>('POST', `/api/admin/administradores/${id}/redefinir-senha`),
}

/** Endereço da planilha (o navegador manda o cookie de sessão sozinho). */
/** Miniatura de uma foto do álbum, só para admin (o cookie de sessão vai sozinho). */
export const urlMiniaturaAdmin = (eventoId: string, fotoId: string) => `/api/admin/eventos/${eventoId}/fotos/${fotoId}/miniatura`

export function urlCsv(recurso: 'eventos' | 'pagamentos', filtro: Record<string, string | undefined> = {}): string {
  const q = new URLSearchParams({ formato: 'csv' })
  for (const [k, v] of Object.entries(filtro)) if (v) q.set(k, v)
  return `/api/admin/${recurso}?${q}`
}

/** "49,90" ou "49.90" → 4990. Vazio ou inválido → null. */
export function reaisParaCentavos(texto: string): number | null {
  const limpo = texto.trim().replace(/^R\$\s*/, '').replace(/\./g, '').replace(',', '.')
  if (!/^\d+(\.\d{1,2})?$/.test(limpo)) return null
  return Math.round(Number(limpo) * 100)
}

/** 4990 → "R$ 49,90". */
export function formatarReais(centavos: number): string {
  return (centavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
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
