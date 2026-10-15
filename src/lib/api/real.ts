// Implementação da api que fala com o servidor (server/openapi.json; guia em docs/API-PARA-O-FRONT.md).
// Caminhos relativos /api/...: em produção é o mesmo domínio; no desenvolvimento, o proxy do Vite.
import type { Sessao } from './sessao.ts'
import {
  ErroApi,
  type DefinicaoPacote,
  type Entrada,
  type Evento,
  type EventoPublico,
  type FotoAlbum,
  type MangoApi,
  type PainelEvento,
  type PaginaAlbum,
  type PedidoRemocao,
  type OpcoesAlbum,
} from './tipos.ts'

export interface OpcoesReal {
  sessao: Sessao
  /** Prefixo das rotas: vazio usa o mesmo domínio (padrão). */
  base?: string
  /** Origem do link de anfitrião (padrão: a do navegador). */
  origem?: string
}

type FotoDoServidor = Omit<FotoAlbum, 'url' | 'miniatura_url'>
type PaginaDoServidor = Omit<PaginaAlbum, 'fotos'> & { fotos: FotoDoServidor[] }

interface Pedido {
  metodo?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  json?: unknown
  corpo?: Blob
  cabecalhos?: Record<string, string>
  /** Token do anfitrião (Authorization: Bearer). */
  anfitriao?: string
  /** Código do evento para mandar o token do convidado (X-Convidado-Token), se houver. */
  convidado?: string
  /** Ler a resposta como arquivo. */
  arquivo?: boolean
}

/** Converte a resposta de erro do servidor em ErroApi. Erro sem JSON é falha inesperada. */
async function erroDa(resposta: Response): Promise<ErroApi> {
  try {
    const { erro, mensagem, ...extra } = (await resposta.json()) as { erro?: unknown; mensagem?: unknown } & Record<string, unknown>
    if (typeof erro === 'string' && typeof mensagem === 'string') {
      const retry = resposta.headers.get('retry-after')
      return new ErroApi(resposta.status, erro, mensagem, retry ? { ...extra, retry_after: Number(retry) } : extra)
    }
  } catch {
    // corpo não é JSON
  }
  return new ErroApi(resposta.status, 'falha_inesperada', 'Algo deu errado do nosso lado. Tente de novo em instantes.')
}

export function criarApiReal({ sessao, base = '', origem = globalThis.location?.origin ?? '' }: OpcoesReal): MangoApi {
  // Falha de rede (sem sinal) chega como TypeError do fetch, não como ErroApi: a fila de envio trata como "tentar depois".
  async function chamar<T>(caminho: string, p: Pedido = {}): Promise<T> {
    const cabecalhos: Record<string, string> = { ...p.cabecalhos }
    if (p.anfitriao) cabecalhos.authorization = `Bearer ${p.anfitriao}`
    if (p.convidado) {
      const token = sessao.tokenDoConvidado(p.convidado)
      if (token) cabecalhos['x-convidado-token'] = token
    }
    let body: BodyInit | undefined
    if (p.json !== undefined) {
      cabecalhos['content-type'] = 'application/json'
      body = JSON.stringify(p.json)
    } else if (p.corpo) {
      body = p.corpo
    }
    const resposta = await fetch(`${base}${caminho}`, { method: p.metodo ?? 'GET', headers: cabecalhos, body })
    if (!resposta.ok) throw await erroDa(resposta)
    if (p.arquivo) return (await resposta.blob()) as T
    if (resposta.status === 204) return undefined as T
    return (await resposta.json()) as T
  }

  function tokenDe(eventoId: string): string {
    const token = sessao.tokensDoAnfitriao()[eventoId]
    if (!token) throw new ErroApi(401, 'nao_autorizado', 'Token do anfitrião inválido.')
    return token
  }

  // async: sem token, o erro vira promise rejeitada (como as outras chamadas), não exceção síncrona
  const doEvento = async (eventoId: string) => chamar<PainelEvento>('/api/anfitriao/evento', { anfitriao: tokenDe(eventoId) })

  const codigo = (c: string) => encodeURIComponent(c.toUpperCase())
  const urlDaFoto = (c: string, id: string, qual: 'arquivo' | 'miniatura') => `${base}/api/eventos/${codigo(c)}/fotos/${id}/${qual}`

  function consulta(opcoes: OpcoesAlbum): string {
    const q = new URLSearchParams()
    if (opcoes.pagina) q.set('pagina', String(opcoes.pagina))
    if (opcoes.limite) q.set('limite', String(opcoes.limite))
    if (opcoes.minhas) q.set('minhas', '1')
    const texto = q.toString()
    return texto ? `?${texto}` : ''
  }

  /** Álbum público: <img> busca direto pelo caminho. */
  function comUrls(c: string, pagina: PaginaDoServidor): PaginaAlbum {
    return {
      ...pagina,
      fotos: pagina.fotos.map((f) => ({ ...f, url: urlDaFoto(c, f.id, 'arquivo'), miniatura_url: urlDaFoto(c, f.id, 'miniatura') })),
    }
  }

  // Antes da revelação (ou com álbum privado) a foto só abre com o Bearer, que <img> não manda:
  // baixa a miniatura com fetch e entrega um blob: URL. Guardadas por foto para não baixar de novo.
  const blobs = new Map<string, string>()
  async function miniaturaComToken(c: string, id: string, token: string): Promise<string> {
    const pronta = blobs.get(id)
    if (pronta) return pronta
    try {
      const arquivo = await chamar<Blob>(`/api/eventos/${codigo(c)}/fotos/${id}/miniatura`, { anfitriao: token, arquivo: true })
      const url = URL.createObjectURL(arquivo)
      blobs.set(id, url)
      return url
    } catch {
      return ''
    }
  }

  async function emLotes<T, R>(itens: T[], tamanho: number, fn: (item: T) => Promise<R>): Promise<R[]> {
    const saida: R[] = []
    for (let i = 0; i < itens.length; i += tamanho) saida.push(...(await Promise.all(itens.slice(i, i + tamanho).map(fn))))
    return saida
  }

  return {
    async pacotes() {
      return (await chamar<{ pacotes: DefinicaoPacote[] }>('/api/pacotes')).pacotes
    },

    async criarEvento(dados) {
      const { evento, anfitriao_token } = await chamar<{ evento: Evento; anfitriao_token: string }>('/api/eventos', { metodo: 'POST', json: dados })
      sessao.guardarTokenDoAnfitriao(evento.id, anfitriao_token)
      return evento
    },

    anfitriaoNesteAparelho: () => Object.keys(sessao.tokensDoAnfitriao()).length > 0,

    async meusEventos() {
      const tokens = Object.entries(sessao.tokensDoAnfitriao())
      const paineis = await Promise.all(
        tokens.map(async ([id, token]) => {
          try {
            return await chamar<PainelEvento>('/api/anfitriao/evento', { anfitriao: token })
          } catch (e) {
            // Token que não vale mais (evento excluído): esquece neste aparelho.
            if (e instanceof ErroApi && e.status === 401) sessao.esquecerEvento(id)
            if (e instanceof ErroApi) return null
            throw e
          }
        }),
      )
      return paineis
        .filter((p): p is PainelEvento => p !== null)
        .sort((a, b) => (b.evento.captura_inicio ?? '').localeCompare(a.evento.captura_inicio ?? ''))
    },

    painel: doEvento,

    async linkDoAnfitriao(eventoId) {
      return `${origem}/anfitriao#${tokenDe(eventoId)}`
    },

    async entrarComoAnfitriao(token) {
      const { evento } = await chamar<PainelEvento>('/api/anfitriao/evento', { anfitriao: token })
      sessao.guardarTokenDoAnfitriao(evento.id, token)
      return evento
    },

    async editarEvento(eventoId, edicao) {
      return chamar<{ evento: Evento; album_privado: boolean }>('/api/anfitriao/evento', { metodo: 'PATCH', json: edicao, anfitriao: tokenDe(eventoId) })
    },

    async encerrar(eventoId) {
      return (await chamar<{ evento: Evento }>('/api/anfitriao/evento/encerrar', { metodo: 'POST', anfitriao: tokenDe(eventoId) })).evento
    },

    async revelar(eventoId) {
      return (await chamar<{ evento: Evento }>('/api/anfitriao/evento/revelar', { metodo: 'POST', anfitriao: tokenDe(eventoId) })).evento
    },

    async excluir(eventoId) {
      await chamar<void>('/api/anfitriao/evento', { metodo: 'DELETE', anfitriao: tokenDe(eventoId) })
      sessao.esquecerEvento(eventoId)
    },

    async cancelar(eventoId) {
      return (await chamar<{ evento: Evento }>('/api/anfitriao/evento/cancelar', { metodo: 'POST', anfitriao: tokenDe(eventoId) })).evento
    },

    async trocarCodigo(eventoId) {
      return chamar<{ codigo: string }>('/api/anfitriao/evento/novo-codigo', { metodo: 'POST', anfitriao: tokenDe(eventoId) })
    },

    async albumDoAnfitriao(eventoId, opcoes = {}) {
      const token = tokenDe(eventoId)
      const { evento } = await doEvento(eventoId)
      const pagina = await chamar<PaginaDoServidor>(`/api/eventos/${codigo(evento.codigo)}/album${consulta(opcoes)}`, { anfitriao: token })
      if (evento.estado === 'revelado' && !evento.album_privado) return comUrls(evento.codigo, pagina)
      // Sem acesso público: só a miniatura, baixada com o token (a moderação não usa a original).
      const fotos = await emLotes(pagina.fotos, 6, async (f) => {
        const mini = await miniaturaComToken(evento.codigo, f.id, token)
        return { ...f, url: mini, miniatura_url: mini }
      })
      return { ...pagina, fotos }
    },

    async baixarAlbum(eventoId) {
      return chamar<Blob>('/api/anfitriao/album.zip', { anfitriao: tokenDe(eventoId), arquivo: true })
    },

    async apagarFoto(eventoId, fotoId) {
      await chamar<void>(`/api/anfitriao/fotos/${fotoId}`, { metodo: 'DELETE', anfitriao: tokenDe(eventoId) })
    },

    async pedidosDeRemocao(eventoId) {
      return (await chamar<{ pedidos: PedidoRemocao[] }>('/api/anfitriao/pedidos-remocao', { anfitriao: tokenDe(eventoId) })).pedidos
    },

    async manterFoto(eventoId, pedidoId) {
      await chamar<void>(`/api/anfitriao/pedidos-remocao/${pedidoId}/manter`, { metodo: 'POST', anfitriao: tokenDe(eventoId) })
    },

    // O pagamento ainda não existe no servidor (#37, AbacatePay).
    async iniciarPagamento() {
      throw new ErroApi(501, 'pagamento_indisponivel', 'O pagamento ainda não está disponível. Crie um evento de teste grátis por enquanto.')
    },
    async statusPagamento() {
      return null
    },

    async eventoPublico(c) {
      return chamar<EventoPublico>(`/api/eventos/${codigo(c)}`)
    },

    async entrar(c, apelido) {
      const r = await chamar<Entrada & { convidado_token?: string }>(`/api/eventos/${codigo(c)}/entrar`, {
        metodo: 'POST',
        json: apelido?.trim() ? { apelido: apelido.trim() } : {},
        convidado: c,
      })
      const { convidado_token, ...entrada } = r
      if (convidado_token) sessao.guardarTokenDoConvidado(c, convidado_token)
      return entrada
    },

    async eu(c) {
      return chamar(`/api/eventos/${codigo(c)}/eu`, { convidado: c })
    },

    async enviarFoto(c, fotoId, foto, info = {}) {
      const cabecalhos: Record<string, string> = { 'content-type': 'image/jpeg' }
      if (info.largura) cabecalhos['x-largura'] = String(info.largura)
      if (info.altura) cabecalhos['x-altura'] = String(info.altura)
      if (info.tirada_em) cabecalhos['x-tirada-em'] = info.tirada_em
      return chamar(`/api/eventos/${codigo(c)}/fotos/${fotoId}`, { metodo: 'PUT', corpo: foto, cabecalhos, convidado: c })
    },

    async enviarMiniatura(c, fotoId, miniatura) {
      await chamar(`/api/eventos/${codigo(c)}/fotos/${fotoId}/miniatura`, {
        metodo: 'PUT',
        corpo: miniatura,
        cabecalhos: { 'content-type': 'image/jpeg' },
        convidado: c,
      })
    },

    async album(c, opcoes = {}) {
      return comUrls(c, await chamar<PaginaDoServidor>(`/api/eventos/${codigo(c)}/album${consulta(opcoes)}`, { convidado: c }))
    },

    async pedirRemocao(c, fotoId, motivo) {
      return chamar(`/api/eventos/${codigo(c)}/fotos/${fotoId}/pedir-remocao`, {
        metodo: 'POST',
        json: motivo?.trim() ? { motivo: motivo.trim() } : {},
        convidado: c,
      })
    },
  }
}
