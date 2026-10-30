import type { Pool } from 'pg'

/**
 * Configurações de negócio que os admins editam (src/admin, tela /admin). O código guarda só o PADRÃO daqui;
 * o banco (`configuracoes`) guarda o que foi alterado. Cada chave tem tipo, faixa e descrição, e toda
 * alteração passa por `validarValor` e pela auditoria.
 */
export interface Config {
  // Eventos
  captura_max_horas: number
  revelacao_max_dias: number
  revelacao_padrao_horas: number
  poses_validas: number[]
  poses_padrao: number
  nome_evento_max: number
  apelido_max: number
  rascunho_validade_dias: number
  criacao_aberta: boolean
  pacotes_pagos_disponiveis: boolean
  preco_dinamico: boolean
  // Fotos
  foto_max_kb: number
  miniatura_max_kb: number
  envio_atrasado_horas: number
  album_pagina_padrao: number
  album_pagina_max: number
  foto_dimensao_max_px: number
  foto_qualidade_jpeg: number
  zip_max_gb: number
  // Financeiro (só o admin lê)
  taxa_stripe_percentual: number
  taxa_stripe_fixa_centavos: number
  meta_receita_mensal_centavos: number
  // Retenção e moderação
  remocao_arquivo_dias: number
  pedido_remocao_motivo_max: number
  // Limites de requisição
  rl_ativo: boolean
  rl_criar_evento_hora: number
  rl_upload_minuto: number
  rl_falhas_minuto: number
  rl_pedido_remocao_hora: number
  // Contato
  contato_suporte: string
  // Aviso
  aviso_global: string
}

export type Chave = keyof Config
export type Tipo = 'inteiro' | 'decimal' | 'booleano' | 'texto' | 'lista_inteiros'

export interface Definicao {
  chave: Chave
  grupo: string
  rotulo: string
  descricao: string
  tipo: Tipo
  padrao: Config[Chave]
  min?: number
  max?: number
  unidade?: string
  /** Vai em GET /api/config (o front usa). As demais são só do servidor. */
  publica: boolean
}

const d = (def: Definicao): Definicao => def

export const DEFINICOES: Definicao[] = [
  d({ chave: 'criacao_aberta', grupo: 'Operação', rotulo: 'Criação de eventos aberta', descricao: 'Desligue para pausar a criação de eventos novos (manutenção). Eventos existentes seguem funcionando.', tipo: 'booleano', padrao: true, publica: true }),
  d({ chave: 'aviso_global', grupo: 'Operação', rotulo: 'Aviso para todos os visitantes', descricao: 'Faixa no topo do site (ex.: manutenção programada). Deixe vazio para não mostrar nada.', tipo: 'texto', padrao: '', publica: true }),
  d({ chave: 'pacotes_pagos_disponiveis', grupo: 'Operação', rotulo: 'Pacotes pagos disponíveis', descricao: 'Ligue só quando o pagamento estiver funcionando. Desligado, só pacotes grátis podem ser criados.', tipo: 'booleano', padrao: false, publica: true }),
  d({ chave: 'preco_dinamico', grupo: 'Operação', rotulo: 'Preço por participante', descricao: 'Ligue só depois de testar um pagamento: a home e o /precos passam a mostrar o preço por participante e fotos, no lugar dos pacotes.', tipo: 'booleano', padrao: false, publica: true }),
  d({ chave: 'contato_suporte', grupo: 'Operação', rotulo: 'Contato de suporte', descricao: 'E-mail ou WhatsApp mostrado ao público (termos, ajuda).', tipo: 'texto', padrao: '', publica: true }),

  d({ chave: 'captura_max_horas', grupo: 'Eventos', rotulo: 'Câmera aberta, no máximo', descricao: 'Maior intervalo entre abrir e fechar a câmera de um evento.', tipo: 'inteiro', padrao: 48, min: 1, max: 168, unidade: 'horas', publica: true }),
  d({ chave: 'revelacao_max_dias', grupo: 'Eventos', rotulo: 'Revelação, no máximo depois do fim', descricao: 'Quantos dias depois de a câmera fechar a revelação pode ser agendada.', tipo: 'inteiro', padrao: 7, min: 1, max: 60, unidade: 'dias', publica: true }),
  d({ chave: 'revelacao_padrao_horas', grupo: 'Eventos', rotulo: 'Revelação padrão depois do fim', descricao: 'Usada quando o evento não informa o horário da revelação.', tipo: 'inteiro', padrao: 12, min: 0, max: 168, unidade: 'horas', publica: true }),
  d({ chave: 'poses_validas', grupo: 'Eventos', rotulo: 'Fotos por convidado (opções)', descricao: 'As opções que o anfitrião pode escolher; cada pacote limita pelo seu máximo de fotos. Ex.: 12, 24, 36.', tipo: 'lista_inteiros', padrao: [12, 24, 36], min: 1, max: 100, publica: true }),
  d({ chave: 'poses_padrao', grupo: 'Eventos', rotulo: 'Fotos por convidado (padrão)', descricao: 'Sugestão inicial. Precisa estar entre as opções acima.', tipo: 'inteiro', padrao: 24, min: 1, max: 100, publica: true }),
  d({ chave: 'nome_evento_max', grupo: 'Eventos', rotulo: 'Nome do evento, tamanho máximo', descricao: 'Caracteres.', tipo: 'inteiro', padrao: 80, min: 20, max: 200, unidade: 'caracteres', publica: true }),
  d({ chave: 'apelido_max', grupo: 'Eventos', rotulo: 'Apelido do convidado, tamanho máximo', descricao: 'Caracteres.', tipo: 'inteiro', padrao: 40, min: 10, max: 100, unidade: 'caracteres', publica: true }),
  d({ chave: 'rascunho_validade_dias', grupo: 'Eventos', rotulo: 'Pagamento não concluído some depois de', descricao: 'Evento em rascunho ou aguardando pagamento é excluído depois deste prazo.', tipo: 'inteiro', padrao: 7, min: 1, max: 60, unidade: 'dias', publica: false }),

  d({ chave: 'foto_max_kb', grupo: 'Fotos', rotulo: 'Foto, tamanho máximo no envio', descricao: 'O servidor recusa acima disso.', tipo: 'inteiro', padrao: 2048, min: 256, max: 10240, unidade: 'KB', publica: true }),
  d({ chave: 'miniatura_max_kb', grupo: 'Fotos', rotulo: 'Miniatura, tamanho máximo', descricao: 'Não pode passar do tamanho máximo da foto.', tipo: 'inteiro', padrao: 512, min: 32, max: 2048, unidade: 'KB', publica: true }),
  d({ chave: 'foto_dimensao_max_px', grupo: 'Fotos', rotulo: 'Foto, lado maior', descricao: 'O aparelho reduz a foto para este lado maior antes de enviar.', tipo: 'inteiro', padrao: 1600, min: 800, max: 4000, unidade: 'px', publica: true }),
  d({ chave: 'foto_qualidade_jpeg', grupo: 'Fotos', rotulo: 'Qualidade do JPEG', descricao: 'De 0,5 a 0,95. Mais alto = foto melhor e arquivo maior.', tipo: 'decimal', padrao: 0.8, min: 0.5, max: 0.95, publica: true }),
  d({ chave: 'envio_atrasado_horas', grupo: 'Fotos', rotulo: 'Envio depois de a câmera fechar', descricao: 'Fotos tiradas sem sinal ainda são aceitas por este tempo.', tipo: 'inteiro', padrao: 24, min: 0, max: 168, unidade: 'horas', publica: true }),
  d({ chave: 'album_pagina_padrao', grupo: 'Fotos', rotulo: 'Álbum, fotos por página (padrão)', descricao: 'Não pode passar do máximo abaixo.', tipo: 'inteiro', padrao: 60, min: 10, max: 200, publica: false }),
  d({ chave: 'album_pagina_max', grupo: 'Fotos', rotulo: 'Álbum, fotos por página (máximo)', descricao: 'Teto que o front pode pedir.', tipo: 'inteiro', padrao: 200, min: 20, max: 500, publica: false }),
  d({ chave: 'taxa_stripe_percentual', grupo: 'Financeiro', rotulo: 'Taxa do Stripe (percentual)', descricao: 'Usada só para estimar a receita líquida no admin. Confira a taxa do seu contrato no Stripe.', tipo: 'decimal', padrao: 3.99, min: 0, max: 20, unidade: '%', publica: false }),
  d({ chave: 'taxa_stripe_fixa_centavos', grupo: 'Financeiro', rotulo: 'Taxa do Stripe (fixa por pagamento)', descricao: 'Valor fixo cobrado em cada pagamento aprovado, em centavos (39 = R$ 0,39).', tipo: 'inteiro', padrao: 39, min: 0, max: 1000, unidade: 'centavos', publica: false }),
  d({ chave: 'meta_receita_mensal_centavos', grupo: 'Financeiro', rotulo: 'Meta de receita do mês', descricao: 'Em centavos (500000 = R$ 5.000,00). Zero desliga a barra de meta no admin.', tipo: 'inteiro', padrao: 0, min: 0, max: 1000000000, unidade: 'centavos', publica: false }),
  d({ chave: 'zip_max_gb', grupo: 'Fotos', rotulo: 'ZIP do álbum, tamanho máximo', descricao: 'Acima disso o anfitrião baixa as fotos pelo álbum. Limite técnico de 4 GB.', tipo: 'decimal', padrao: 4, min: 0.5, max: 4, unidade: 'GB', publica: false }),

  d({ chave: 'remocao_arquivo_dias', grupo: 'Retenção e moderação', rotulo: 'Arquivo apagado depois de', descricao: 'Foto removida ou evento excluído tem os arquivos apagados do armazenamento depois deste prazo.', tipo: 'inteiro', padrao: 30, min: 0, max: 365, unidade: 'dias', publica: false }),
  d({ chave: 'pedido_remocao_motivo_max', grupo: 'Retenção e moderação', rotulo: 'Motivo do pedido de remoção, tamanho máximo', descricao: 'Caracteres.', tipo: 'inteiro', padrao: 300, min: 50, max: 2000, unidade: 'caracteres', publica: true }),

  d({ chave: 'rl_ativo', grupo: 'Limites de requisição', rotulo: 'Limites de requisição ligados', descricao: 'Em emergência, desligar libera tudo. Deixe ligado.', tipo: 'booleano', padrao: true, publica: false }),
  d({ chave: 'rl_criar_evento_hora', grupo: 'Limites de requisição', rotulo: 'Criar evento, por IP', descricao: 'Eventos novos por hora por endereço.', tipo: 'inteiro', padrao: 30, min: 1, max: 100000, unidade: 'por hora', publica: false }),
  d({ chave: 'rl_upload_minuto', grupo: 'Limites de requisição', rotulo: 'Envio de foto, por convidado', descricao: 'Pensado para a fila offline despejando de uma vez. Não use por IP: vários convidados dividem o Wi-Fi.', tipo: 'inteiro', padrao: 300, min: 10, max: 100000, unidade: 'por minuto', publica: false }),
  d({ chave: 'rl_falhas_minuto', grupo: 'Limites de requisição', rotulo: 'Tentativas que falham, por IP', descricao: 'Só 401 e 404 contam; quem acerta nunca é barrado.', tipo: 'inteiro', padrao: 600, min: 20, max: 100000, unidade: 'por minuto', publica: false }),
  d({ chave: 'rl_pedido_remocao_hora', grupo: 'Limites de requisição', rotulo: 'Pedido de remoção, por IP', descricao: 'Pedidos por hora por endereço.', tipo: 'inteiro', padrao: 30, min: 1, max: 100000, unidade: 'por hora', publica: false }),
]

const POR_CHAVE = new Map<string, Definicao>(DEFINICOES.map((x) => [x.chave, x]))
export const definicaoDe = (chave: string): Definicao | undefined => POR_CHAVE.get(chave)

export const CONFIG_PADRAO = Object.fromEntries(DEFINICOES.map((x) => [x.chave, x.padrao])) as unknown as Config

export type ResultadoValor = { ok: true; valor: unknown } | { ok: false; mensagem: string }

function dentro(def: Definicao, n: number): string | null {
  if (def.min !== undefined && n < def.min) return `O mínimo é ${def.min}${def.unidade ? ' ' + def.unidade : ''}.`
  if (def.max !== undefined && n > def.max) return `O máximo é ${def.max}${def.unidade ? ' ' + def.unidade : ''}.`
  return null
}

/** Valida e normaliza o valor de UMA chave (tipo e faixa). */
export function validarValor(def: Definicao, valor: unknown): ResultadoValor {
  const falha = (mensagem: string): ResultadoValor => ({ ok: false, mensagem })
  switch (def.tipo) {
    case 'inteiro': {
      if (typeof valor !== 'number' || !Number.isInteger(valor)) return falha('Informe um número inteiro.')
      const erro = dentro(def, valor)
      return erro ? falha(erro) : { ok: true, valor }
    }
    case 'decimal': {
      if (typeof valor !== 'number' || !Number.isFinite(valor)) return falha('Informe um número.')
      const erro = dentro(def, valor)
      return erro ? falha(erro) : { ok: true, valor }
    }
    case 'booleano':
      return typeof valor === 'boolean' ? { ok: true, valor } : falha('Use verdadeiro ou falso.')
    case 'texto': {
      if (typeof valor !== 'string') return falha('Informe um texto.')
      const t = valor.trim()
      return t.length > 200 ? falha('No máximo 200 caracteres.') : { ok: true, valor: t }
    }
    case 'lista_inteiros': {
      if (!Array.isArray(valor) || valor.length < 1 || valor.length > 8) return falha('Informe de 1 a 8 números.')
      if (!valor.every((n) => typeof n === 'number' && Number.isInteger(n))) return falha('Só números inteiros.')
      const unicos = [...new Set(valor as number[])].sort((a, b) => a - b)
      for (const n of unicos) {
        const erro = dentro(def, n)
        if (erro) return falha(erro)
      }
      return { ok: true, valor: unicos }
    }
  }
}

/** Regras que envolvem mais de uma chave. Devolve a mensagem de erro (por chave) ou null. */
export function validarConjunto(c: Config): Partial<Record<Chave, string>> | null {
  const erros: Partial<Record<Chave, string>> = {}
  if (!c.poses_validas.includes(c.poses_padrao)) erros.poses_padrao = 'Precisa estar entre as opções de fotos.'
  if (c.album_pagina_padrao > c.album_pagina_max) erros.album_pagina_padrao = 'Não pode passar do máximo por página.'
  if (c.miniatura_max_kb > c.foto_max_kb) erros.miniatura_max_kb = 'Não pode passar do tamanho máximo da foto.'
  return Object.keys(erros).length ? erros : null
}

export interface AdminRef {
  id: string
  usuario: string
}

export interface LinhaConfig {
  definicao: Definicao
  valor: unknown
  personalizado: boolean
  atualizado_em: Date | null
}

export class ServicoConfig {
  private pool: Pool
  private ttlMs: number
  private cache: { em: number; config: Config; linhas: Map<string, { valor: unknown; atualizado_em: Date }> } | null = null

  constructor(pool: Pool, ttlMs = 10_000) {
    this.pool = pool
    this.ttlMs = ttlMs
  }

  invalidar(): void {
    this.cache = null
  }

  private async carregar() {
    if (this.cache && Date.now() - this.cache.em < this.ttlMs) return this.cache
    let r: { rows: { chave: string; valor: unknown; atualizado_em: Date }[] }
    try {
      r = await this.pool.query<{ chave: string; valor: unknown; atualizado_em: Date }>('select chave, valor, atualizado_em from configuracoes')
    } catch (erro) {
      // Banco fora: segue com o último valor conhecido (ou o padrão) em vez de derrubar tudo junto.
      if (this.cache) return this.cache
      console.warn('Não consegui ler a configuração; usando os padrões:', erro instanceof Error ? erro.message : erro)
      return { em: 0, config: { ...CONFIG_PADRAO }, linhas: new Map() }
    }
    const config = { ...CONFIG_PADRAO } as Record<string, unknown>
    const linhas = new Map<string, { valor: unknown; atualizado_em: Date }>()
    for (const linha of r.rows) {
      const def = definicaoDe(linha.chave)
      if (!def) continue // chave que não existe mais
      const v = validarValor(def, linha.valor)
      if (!v.ok) {
        console.warn(`Configuração ${linha.chave} inválida no banco (${v.mensagem}); usando o padrão.`)
        continue
      }
      config[linha.chave] = v.valor
      linhas.set(linha.chave, { valor: v.valor, atualizado_em: linha.atualizado_em })
    }
    this.cache = { em: Date.now(), config: config as unknown as Config, linhas }
    return this.cache
  }

  async valores(): Promise<Config> {
    return (await this.carregar()).config
  }

  /** Todas as chaves com o valor atual, o padrão e se foram alteradas (para a tela de admin). */
  async linhas(): Promise<LinhaConfig[]> {
    const { config, linhas } = await this.carregar()
    return DEFINICOES.map((definicao) => ({
      definicao,
      valor: config[definicao.chave],
      personalizado: linhas.has(definicao.chave),
      atualizado_em: linhas.get(definicao.chave)?.atualizado_em ?? null,
    }))
  }

  /** Só o que o front pode ver. */
  async publicas(): Promise<Partial<Config>> {
    const config = await this.valores()
    return Object.fromEntries(DEFINICOES.filter((x) => x.publica).map((x) => [x.chave, config[x.chave]])) as Partial<Config>
  }

  /**
   * Aplica um conjunto de alterações de uma vez (tudo ou nada). `null` volta a chave ao padrão.
   * Registra cada mudança na auditoria.
   */
  async atualizar(mudancas: Record<string, unknown>, admin: AdminRef): Promise<{ ok: true; config: Config } | { ok: false; erros: Record<string, string> }> {
    const atual = await this.valores()
    const erros: Record<string, string> = {}
    const candidato = { ...atual } as Record<string, unknown>
    const alteradas: { chave: Chave; antes: unknown; depois: unknown; restaurar: boolean }[] = []

    for (const [chave, valor] of Object.entries(mudancas)) {
      const def = definicaoDe(chave)
      if (!def) {
        erros[chave] = 'Configuração desconhecida.'
        continue
      }
      if (valor === null) {
        candidato[chave] = def.padrao
        alteradas.push({ chave: def.chave, antes: atual[def.chave], depois: def.padrao, restaurar: true })
        continue
      }
      const v = validarValor(def, valor)
      if (!v.ok) {
        erros[chave] = v.mensagem
        continue
      }
      candidato[chave] = v.valor
      alteradas.push({ chave: def.chave, antes: atual[def.chave], depois: v.valor, restaurar: false })
    }
    if (Object.keys(erros).length === 0) {
      const cruzados = validarConjunto(candidato as unknown as Config)
      if (cruzados) Object.assign(erros, cruzados)
    }
    if (Object.keys(erros).length) return { ok: false, erros }

    const mudou = alteradas.filter((a) => JSON.stringify(a.antes) !== JSON.stringify(a.depois))
    if (mudou.length) {
      const cliente = await this.pool.connect()
      try {
        await cliente.query('begin')
        for (const a of mudou) {
          if (a.restaurar) await cliente.query('delete from configuracoes where chave = $1', [a.chave])
          else {
            await cliente.query(
              `insert into configuracoes (chave, valor, atualizado_em, atualizado_por) values ($1, $2::jsonb, now(), $3)
               on conflict (chave) do update set valor = excluded.valor, atualizado_em = now(), atualizado_por = excluded.atualizado_por`,
              [a.chave, JSON.stringify(a.depois), admin.id],
            )
          }
          await cliente.query(
            `insert into auditoria_admin (admin_id, usuario, acao, alvo, antes, depois) values ($1, $2, $3, $4, $5::jsonb, $6::jsonb)`,
            [admin.id, admin.usuario, a.restaurar ? 'config.restaurar' : 'config.alterar', a.chave, JSON.stringify(a.antes), JSON.stringify(a.depois)],
          )
        }
        await cliente.query('commit')
      } catch (e) {
        await cliente.query('rollback').catch(() => {})
        throw e
      } finally {
        cliente.release()
      }
      this.invalidar()
    }
    return { ok: true, config: await this.valores() }
  }
}
