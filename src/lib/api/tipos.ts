// Contrato da API usado pelas telas. Os formatos seguem o contrato do servidor (server/openapi.json),
// para trocar a implementação simulada pela real sem mexer nas telas.
// O que ainda não existe no servidor está marcado com "só na simulada"; o que é só do aparelho, com "local".

export type Estado =
  | 'rascunho'
  | 'aguardando_pagamento'
  | 'pronto'
  | 'captura_aberta'
  | 'captura_encerrada'
  | 'revelado'
  | 'expirado'
  | 'cancelado'

/** Id do pacote. Os pacotes são editados e criados pelos admins (`teste`, `festa`, `celebracao` e `casamento` vêm de fábrica). */
export type Pacote = string

export interface DefinicaoPacote {
  id: Pacote
  nome: string
  convidados: number
  gratis: boolean
  /** Dias de álbum depois da revelação. */
  retencao_dias: number
  poses_max: number
  poses_opcoes: number[]
  /** Hipótese de preço do plano (seção 3.2), a validar nas entrevistas. */
  preco_centavos: number
}

/** Datas em ISO 8601, como chegam no JSON. */
export interface Evento {
  id: string
  codigo: string
  nome: string
  estado: Estado
  pacote: Pacote
  limite_convidados: number
  poses_por_convidado: number
  limite_fotos: number | null
  captura_inicio: string | null
  captura_fim: string | null
  revelacao_em: string | null
  revelacao_manual: boolean
  album_privado: boolean
  revelado_em: string | null
  expira_em: string | null
}

/** O que o convidado vê no link /c/:codigo. */
export interface EventoPublico {
  nome: string
  estado: Estado
  poses_por_convidado: number
  captura_inicio: string | null
  captura_fim: string | null
  revelacao_em: string | null
  revelacao_manual: boolean
  revelado_em: string | null
  expira_em: string | null
  album_privado: boolean
  lotado: boolean
  /** Total de fotos no rolo. Só na simulada por enquanto (pedido ao back na #63). */
  fotos?: number
}

export interface NovoEvento {
  nome: string
  pacote?: Pacote
  poses_por_convidado?: number
  /** Preço por participante (com `preco_dinamico` ligado): no lugar de `pacote` e `poses_por_convidado`. */
  participantes?: number
  fotos?: number | 'ilimitado'
  captura_inicio: string
  captura_fim: string
  /** Sem valor e sem revelacao_manual: 12 h depois do fim. */
  revelacao_em?: string
  revelacao_manual?: boolean
}

/** PATCH /api/anfitriao/evento. Nome, poses e horários só antes de a câmera abrir; álbum privado a qualquer momento. */
export interface EdicaoEvento {
  nome?: string
  poses_por_convidado?: number
  captura_inicio?: string
  captura_fim?: string
  /** Mudou os horários sem informar a revelação: volta ao padrão (12 h depois do fim). */
  revelacao_em?: string
  revelacao_manual?: boolean
  album_privado?: boolean
}

export interface PainelEvento {
  evento: Evento
  convidados: number
  fotos: number
}

export interface Entrada {
  convidado_id: string
  apelido: string | null
  poses_restantes: number
}

export interface Eu {
  convidado_id: string
  apelido: string | null
  estado: Estado
  poses_restantes: number
  /** Ids das fotos que o servidor já tem, para a fila de envio sincronizar. */
  fotos: string[]
}

export interface InfoFoto {
  largura?: number
  altura?: number
  tirada_em?: string
}

export interface EnvioFoto {
  foto_id: string
  repetida: boolean
}

/** Foto da folha de contato (GET /api/eventos/:codigo/album). */
export interface FotoAlbum {
  id: string
  /** Posição no álbum inteiro, na ordem em que as fotos foram tiradas, a partir de 1. */
  numero: number
  apelido: string | null
  tirada_em: string | null
  largura: number | null
  altura: number | null
  tem_miniatura: boolean
  /** Endereços prontos para <img>, montados pela api (não vêm no JSON do servidor). */
  url: string
  miniatura_url: string
}

export interface PaginaAlbum {
  evento: { nome: string; expira_em: string | null; estado: Estado }
  pagina: number
  limite: number
  total: number
  fotos: FotoAlbum[]
}

export interface OpcoesAlbum {
  /** Só as fotos deste aparelho; exige ter entrado como convidado. */
  minhas?: boolean
  /** A partir de 1. */
  pagina?: number
  /** Padrão 60, máximo 200. */
  limite?: number
}

export interface PedidoRemocao {
  id: string
  foto_id: string
  /** Número do quadro no álbum. */
  numero: number
  motivo: string | null
  criado_em: string
}

export interface ResultadoPedido {
  pedido_id?: string
  /** A mesma pessoa já tinha pedido a remoção desta foto. */
  repetido: boolean
}

/** Situação do pagamento do evento. `recusado` inclui a sessão expirada: dá para tentar de novo. */
export type StatusPagamento = 'pendente' | 'aprovado' | 'recusado'

export interface PagamentoIniciado {
  status: StatusPagamento
  /** Página de pagamento do Stripe: redirecionar o navegador para ela. Na simulada não existe (`null`). */
  url: string | null
  /** Já havia uma sessão aberta e ela foi devolvida, sem criar outra cobrança. */
  reaproveitada?: boolean
}

/** Erro no formato do servidor: `{ erro: "codigo", mensagem: "..." }`. */
export class ErroApi extends Error {
  readonly status: number
  readonly erro: string
  readonly extra: Record<string, unknown>

  constructor(status: number, erro: string, mensagem: string, extra: Record<string, unknown> = {}) {
    super(mensagem)
    this.name = 'ErroApi'
    this.status = status
    this.erro = erro
    this.extra = extra
  }
}

export interface MangoApi {
  pacotes(): Promise<DefinicaoPacote[]>

  // Anfitrião. No piloto não há login: criar o evento devolve um token secreto,
  // que a api guarda neste aparelho. As telas só usam o id do evento.
  criarEvento(dados: NovoEvento): Promise<Evento>
  /** Local: se este aparelho guarda acesso de anfitrião a algum evento (sem ir ao servidor). */
  anfitriaoNesteAparelho(): boolean
  meusEventos(): Promise<PainelEvento[]>
  painel(eventoId: string): Promise<PainelEvento>
  /** Local: link secreto que dá acesso de anfitrião em outro aparelho. */
  linkDoAnfitriao(eventoId: string): Promise<string>
  /** Local + GET /api/anfitriao/evento: guarda neste aparelho o acesso vindo do link secreto. */
  entrarComoAnfitriao(token: string): Promise<Evento>
  editarEvento(eventoId: string, edicao: EdicaoEvento): Promise<{ evento: Evento; album_privado: boolean }>
  encerrar(eventoId: string): Promise<Evento>
  revelar(eventoId: string): Promise<Evento>
  excluir(eventoId: string): Promise<void>
  /** Só antes da primeira foto. */
  cancelar(eventoId: string): Promise<Evento>
  /** O link e o QR antigos param de funcionar. */
  trocarCodigo(eventoId: string): Promise<{ codigo: string }>
  /** O anfitrião vê o álbum em qualquer estado (para moderar), menos expirado. */
  albumDoAnfitriao(eventoId: string, opcoes?: Omit<OpcoesAlbum, 'minhas'>): Promise<PaginaAlbum>
  /** ZIP com todas as fotos, só depois de revelado. */
  baixarAlbum(eventoId: string): Promise<Blob>
  /** A foto some do álbum na hora; pedidos de remoção dela ficam resolvidos. */
  apagarFoto(eventoId: string, fotoId: string): Promise<void>
  /** Só os pendentes. */
  pedidosDeRemocao(eventoId: string): Promise<PedidoRemocao[]>
  /** O anfitrião decide manter a foto: o pedido sai da fila. */
  manterFoto(eventoId: string, pedidoId: string): Promise<void>
  // Pagamento com Stripe (#37). Quem libera o evento é o webhook do Stripe, nunca o retorno do navegador:
  // depois de pagar, a tela só consulta `statusPagamento` e o estado do evento até ele sair de aguardando_pagamento.
  iniciarPagamento(eventoId: string): Promise<PagamentoIniciado>
  /** `null` = ainda não houve cobrança. */
  statusPagamento(eventoId: string): Promise<StatusPagamento | null>

  // Convidado. O token do aparelho também fica guardado pela api.
  eventoPublico(codigo: string): Promise<EventoPublico>
  entrar(codigo: string, apelido?: string): Promise<Entrada>
  eu(codigo: string): Promise<Eu>
  enviarFoto(codigo: string, fotoId: string, foto: Blob, info?: InfoFoto): Promise<EnvioFoto>
  enviarMiniatura(codigo: string, fotoId: string, miniatura: Blob): Promise<void>
  /** Só depois de revelado e se o álbum não for privado. */
  album(codigo: string, opcoes?: OpcoesAlbum): Promise<PaginaAlbum>
  /** Mesmo acesso do álbum. Um pedido por pessoa e foto (repetir não duplica). */
  pedirRemocao(codigo: string, fotoId: string, motivo?: string): Promise<ResultadoPedido>
}
