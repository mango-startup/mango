// Implementação simulada da api: guarda tudo no navegador e aplica as mesmas regras do servidor,
// com os mesmos códigos de erro. Serve para fazer as telas enquanto a API real é construída.
import {
  VERSAO_BANCO,
  criarExemplos,
  horariosPara,
  imagemDeExemplo,
  type Banco,
  type ConvidadoInterno,
  type EventoInterno,
  type FotoInterna,
} from './exemplos.ts'
import type { Persistencia } from './persistencia.ts'
import {
  ENVIO_ATRASADO_MS,
  FOTO_MAX_BYTES,
  MINIATURA_MAX_BYTES,
  PACOTES,
  avancarPeloRelogio,
  expiracao,
  gerarCodigo,
  gerarToken,
  podeTransicionar,
  validarNovoEvento,
} from './regras.ts'
import type { Sessao } from './sessao.ts'
import {
  ErroApi,
  type Entrada,
  type Estado,
  type Evento,
  type EventoPublico,
  type FotoAlbum,
  type MangoApi,
  type OpcoesAlbum,
  type PaginaAlbum,
  type PainelEvento,
  type StatusPagamento,
} from './tipos.ts'

export interface OpcoesSimulada {
  persistencia: Persistencia
  sessao: Sessao
  /** Atraso aleatório [mínimo, máximo] em ms, para as telas mostrarem carregamento. */
  atrasoMs?: [number, number]
  agora?: () => Date
  /** Origem usada no link secreto do anfitrião. */
  origem?: string
}

/** Atalhos para testar as telas; no navegador ficam em `window.mango` durante o desenvolvimento. */
export interface FerramentasSimulada {
  /** Lista os eventos com código e estado. */
  eventos(): Promise<{ id: string; codigo: string; nome: string; estado: Estado }[]>
  /** Coloca o evento no estado pedido, ajustando os horários para o relógio não desfazer. */
  forcarEstado(codigoOuId: string, estado: Estado): Promise<Evento>
  simularPagamento(eventoId: string, resultado: StatusPagamento): Promise<Evento>
  /** Apaga tudo e recria os exemplos. */
  resetar(): Promise<void>
}

export type ApiSimulada = MangoApi & {
  dev: FerramentasSimulada
  /** Cria os exemplos na primeira visita, sem o atraso simulado. */
  preparar(): Promise<void>
}

const CHAVE_BANCO = 'banco'
const chaveFoto = (id: string) => `foto:${id}`
const chaveMiniatura = (id: string) => `miniatura:${id}`
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const ALBUM_LIMITE_PADRAO = 60

function falhar(status: number, erro: string, mensagem: string, extra: Record<string, unknown> = {}): never {
  throw new ErroApi(status, erro, mensagem, extra)
}

function semInternos(e: EventoInterno): Evento {
  const { anfitriao_token: _token, excluido_em: _excluido, criado_em: _criado, ...evento } = e
  return evento
}

async function ehJpeg(arquivo: Blob): Promise<boolean> {
  const b = new Uint8Array(await arquivo.slice(0, 3).arrayBuffer())
  return b.length === 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff
}

export function criarApiSimulada(opcoes: OpcoesSimulada): ApiSimulada {
  const { persistencia, sessao } = opcoes
  const agora = opcoes.agora ?? (() => new Date())
  const origem = opcoes.origem ?? globalThis.location?.origin ?? ''
  const urls = new Map<string, string>()
  let semeando: Promise<Banco> | null = null

  async function semear(): Promise<Banco> {
    const { banco, anfitriao, convidado } = criarExemplos(agora())
    for (const [id, token] of Object.entries(anfitriao)) sessao.guardarTokenDoAnfitriao(id, token)
    for (const [codigo, token] of Object.entries(convidado)) sessao.guardarTokenDoConvidado(codigo, token)
    await persistencia.gravar(CHAVE_BANCO, banco)
    return banco
  }

  // Uma chamada por vez: cada uma lê, muda e grava o banco inteiro, então chamadas em paralelo
  // (a fila de envio mandando várias fotos) perderiam gravações. O atraso fica fora da fila.
  let fila: Promise<unknown> = Promise.resolve()
  async function emSerie<T>(fn: () => Promise<T>): Promise<T> {
    if (opcoes.atrasoMs) {
      const [min, max] = opcoes.atrasoMs
      await new Promise((r) => setTimeout(r, min + Math.random() * (max - min)))
    }
    const resultado = fila.then(fn)
    fila = resultado.catch(() => {})
    return resultado
  }

  function serializar<T extends object>(metodos: T): T {
    return Object.fromEntries(
      Object.entries(metodos).map(([nome, fn]) => [nome, (...args: unknown[]) => emSerie(() => fn(...args))]),
    ) as T
  }

  /** Lê o banco a cada chamada (outra aba pode ter mudado) e aplica o relógio. */
  async function abrir(): Promise<Banco> {
    const salvo = await persistencia.ler<Banco>(CHAVE_BANCO)
    const banco = salvo?.versao === VERSAO_BANCO ? salvo : await (semeando ??= semear())
    const momento = agora()
    let mudou = false
    banco.eventos = banco.eventos.map((e) => {
      if (e.excluido_em) return e
      const novo = avancarPeloRelogio(e, momento)
      if (novo.estado !== e.estado) mudou = true
      return { ...e, ...novo }
    })
    if (mudou) await salvar(banco)
    return banco
  }

  const salvar = (banco: Banco) => persistencia.gravar(CHAVE_BANCO, banco)

  function porCodigo(banco: Banco, codigo: string): EventoInterno {
    const e = banco.eventos.find((ev) => ev.codigo === codigo.toUpperCase() && !ev.excluido_em)
    return e ?? falhar(404, 'nao_encontrado', 'Evento não encontrado.')
  }

  function doAnfitriao(banco: Banco, eventoId: string): EventoInterno {
    const token = sessao.tokensDoAnfitriao()[eventoId]
    const e = banco.eventos.find((ev) => ev.id === eventoId && ev.anfitriao_token === token && !ev.excluido_em)
    return e ?? falhar(401, 'nao_autorizado', 'Token do anfitrião inválido.')
  }

  function doAparelho(banco: Banco, codigo: string): { evento: EventoInterno; convidado: ConvidadoInterno } {
    const evento = porCodigo(banco, codigo)
    const token = sessao.tokenDoConvidado(codigo)
    const convidado = banco.convidados.find((c) => c.evento_id === evento.id && c.token === token)
    if (!token || !convidado) falhar(401, 'nao_autorizado', 'Convidado não reconhecido neste evento.')
    return { evento, convidado }
  }

  const ativas = (banco: Banco, eventoId: string) =>
    banco.fotos
      .filter((f) => f.evento_id === eventoId && !f.removida_em)
      .sort((a, b) => (a.tirada_em ?? a.enviada_em).localeCompare(b.tirada_em ?? b.enviada_em))

  function painelDe(banco: Banco, e: EventoInterno): PainelEvento {
    return {
      evento: semInternos(e),
      convidados: banco.convidados.filter((c) => c.evento_id === e.id).length,
      fotos: ativas(banco, e.id).length,
    }
  }

  function aceitaEnvio(e: EventoInterno): boolean {
    if (e.estado === 'captura_aberta') return true
    if (e.estado === 'captura_encerrada' && e.captura_fim) {
      return agora().getTime() <= new Date(e.captura_fim).getTime() + ENVIO_ATRASADO_MS
    }
    return false
  }

  async function urlDe(f: FotoInterna, numero: number, miniatura: boolean): Promise<string> {
    if (f.exemplo) return imagemDeExemplo(numero)
    const chave = miniatura && f.tem_miniatura ? chaveMiniatura(f.id) : chaveFoto(f.id)
    const pronta = urls.get(chave)
    if (pronta) return pronta
    const arquivo = await persistencia.ler<Blob>(chave)
    if (!arquivo) return ''
    const url = URL.createObjectURL(arquivo)
    urls.set(chave, url)
    return url
  }

  async function paraAlbum(banco: Banco, f: FotoInterna, numero: number): Promise<FotoAlbum> {
    return {
      id: f.id,
      numero,
      apelido: banco.convidados.find((c) => c.id === f.convidado_id)?.apelido ?? null,
      tirada_em: f.tirada_em,
      largura: f.largura,
      altura: f.altura,
      tem_miniatura: f.tem_miniatura,
      url: await urlDe(f, numero, false),
      miniatura_url: await urlDe(f, numero, true),
    }
  }

  /** Folha de contato paginada, como GET /api/eventos/:codigo/album. */
  async function paginaDoAlbum(banco: Banco, e: EventoInterno, opcoesAlbum: OpcoesAlbum, convidadoId: string | null): Promise<PaginaAlbum> {
    const limite = Math.min(200, Math.max(1, opcoesAlbum.limite ?? ALBUM_LIMITE_PADRAO))
    const pagina = Math.max(1, opcoesAlbum.pagina ?? 1)
    const numeradas = ativas(banco, e.id).map((f, i) => ({ f, numero: i + 1 }))
    const lista = convidadoId ? numeradas.filter(({ f }) => f.convidado_id === convidadoId) : numeradas
    const trecho = lista.slice((pagina - 1) * limite, pagina * limite)
    return {
      evento: { nome: e.nome, expira_em: e.expira_em, estado: e.estado },
      pagina,
      limite,
      total: lista.length,
      fotos: await Promise.all(trecho.map(({ f, numero }) => paraAlbum(banco, f, numero))),
    }
  }

  function barrarExpirado(e: EventoInterno) {
    if (e.estado === 'expirado') falhar(410, 'expirado', 'Este álbum expirou.', { expira_em: e.expira_em })
  }

  async function validarArquivo(arquivo: Blob, maximo: number, nome: 'foto' | 'miniatura') {
    if (!arquivo.type.startsWith('image/jpeg')) falhar(415, 'tipo_invalido', `Envie a ${nome} como image/jpeg.`)
    if (arquivo.size > maximo) {
      falhar(413, 'arquivo_grande', nome === 'foto' ? 'A foto passa de 2 MB.' : 'A miniatura passa de 512 KB.')
    }
    if (!(await ehJpeg(arquivo))) falhar(415, 'tipo_invalido', 'O arquivo não é um JPEG.')
  }

  async function transicionar(eventoId: string, de: Estado, para: Estado): Promise<Evento> {
    const banco = await abrir()
    const e = doAnfitriao(banco, eventoId)
    if (e.estado !== de || !podeTransicionar(e.estado, para)) {
      falhar(409, 'transicao_invalida', `Não dá para ir de ${e.estado} para ${para}.`, { estado: e.estado })
    }
    const momento = agora()
    e.estado = para
    if (para === 'revelado') {
      e.revelado_em = momento.toISOString()
      e.expira_em = expiracao(e.pacote, momento)
    }
    if (para === 'captura_encerrada' && e.captura_fim && new Date(e.captura_fim) > momento) {
      e.captura_fim = momento.toISOString()
    }
    await salvar(banco)
    return semInternos(e)
  }

  const api: Omit<MangoApi, 'anfitriaoNesteAparelho'> = {
    async pacotes() {
      return Object.values(PACOTES)
    },

    async criarEvento(dados) {
      const banco = await abrir()
      const campos = validarNovoEvento(dados, agora())
      if ('erro' in campos) falhar(400, campos.erro, campos.mensagem)
      let codigo = gerarCodigo()
      while (banco.eventos.some((e) => e.codigo === codigo)) codigo = gerarCodigo()
      const pacote = PACOTES[campos.pacote]
      const evento: EventoInterno = {
        id: crypto.randomUUID(),
        codigo,
        ...campos,
        // Pacote pago fica aguardando pagamento; o grátis já nasce pronto.
        estado: pacote.gratis ? 'pronto' : 'aguardando_pagamento',
        limite_convidados: pacote.convidados,
        limite_fotos: pacote.convidados * campos.poses_por_convidado,
        album_privado: false,
        revelado_em: null,
        expira_em: null,
        anfitriao_token: gerarToken(),
        excluido_em: null,
        criado_em: agora().toISOString(),
      }
      banco.eventos.push(evento)
      await salvar(banco)
      sessao.guardarTokenDoAnfitriao(evento.id, evento.anfitriao_token)
      return semInternos(evento)
    },

    async meusEventos() {
      const banco = await abrir()
      const tokens = sessao.tokensDoAnfitriao()
      return banco.eventos
        .filter((e) => !e.excluido_em && tokens[e.id] === e.anfitriao_token)
        .sort((a, b) => (b.captura_inicio ?? b.criado_em).localeCompare(a.captura_inicio ?? a.criado_em))
        .map((e) => painelDe(banco, e))
    },

    async painel(eventoId) {
      const banco = await abrir()
      return painelDe(banco, doAnfitriao(banco, eventoId))
    },

    async linkDoAnfitriao(eventoId) {
      const banco = await abrir()
      return `${origem}/anfitriao#${doAnfitriao(banco, eventoId).anfitriao_token}`
    },

    async entrarComoAnfitriao(token) {
      const banco = await abrir()
      const e = banco.eventos.find((ev) => ev.anfitriao_token === token && !ev.excluido_em)
      if (!e) falhar(401, 'nao_autorizado', 'Token do anfitrião inválido.')
      sessao.guardarTokenDoAnfitriao(e.id, token)
      return semInternos(e)
    },

    encerrar: (eventoId) => transicionar(eventoId, 'captura_aberta', 'captura_encerrada'),
    revelar: (eventoId) => transicionar(eventoId, 'captura_encerrada', 'revelado'),

    async excluir(eventoId) {
      const banco = await abrir()
      doAnfitriao(banco, eventoId).excluido_em = agora().toISOString()
      await salvar(banco)
      sessao.esquecerEvento(eventoId)
    },

    async cancelar(eventoId) {
      const banco = await abrir()
      const e = doAnfitriao(banco, eventoId)
      if (ativas(banco, e.id).length > 0) {
        falhar(409, 'ja_tem_fotos', 'O evento já tem fotos e não pode mais ser cancelado.')
      }
      return transicionar(eventoId, e.estado, 'cancelado')
    },

    async definirAlbumPrivado(eventoId, privado) {
      const banco = await abrir()
      const e = doAnfitriao(banco, eventoId)
      e.album_privado = privado
      await salvar(banco)
      return { album_privado: privado }
    },

    async trocarCodigo(eventoId) {
      const banco = await abrir()
      const e = doAnfitriao(banco, eventoId)
      let codigo = gerarCodigo()
      while (banco.eventos.some((ev) => ev.codigo === codigo)) codigo = gerarCodigo()
      e.codigo = codigo
      await salvar(banco)
      return { codigo }
    },

    async albumDoAnfitriao(eventoId, opcoesAlbum = {}) {
      const banco = await abrir()
      const e = doAnfitriao(banco, eventoId)
      barrarExpirado(e)
      return paginaDoAlbum(banco, e, opcoesAlbum, null)
    },

    async baixarAlbum(eventoId) {
      const banco = await abrir()
      const e = doAnfitriao(banco, eventoId)
      if (e.estado !== 'revelado') {
        falhar(409, 'nao_revelado', 'O ZIP só fica disponível depois da revelação.', { estado: e.estado })
      }
      if (ativas(banco, e.id).length === 0) falhar(404, 'sem_fotos', 'Este álbum ainda não tem fotos.')
      // A API real devolve um ZIP com as fotos; aqui só um arquivo de texto para o fluxo de download funcionar.
      return new Blob([`ZIP simulado de "${e.nome}". Na API real vêm as fotos.`], { type: 'text/plain' })
    },

    async apagarFoto(eventoId, fotoId) {
      const banco = await abrir()
      const e = doAnfitriao(banco, eventoId)
      const foto = banco.fotos.find((f) => f.id === fotoId && f.evento_id === e.id && !f.removida_em)
      if (!foto) falhar(404, 'nao_encontrada', 'Foto não encontrada.')
      foto.removida_em = agora().toISOString()
      await salvar(banco)
    },

    async pedidosDeRemocao(eventoId) {
      const banco = await abrir()
      const e = doAnfitriao(banco, eventoId)
      return banco.pedidos.filter((p) => p.evento_id === e.id).map(({ evento_id: _e, ...pedido }) => pedido)
    },

    async iniciarPagamento(eventoId) {
      const banco = await abrir()
      const e = doAnfitriao(banco, eventoId)
      if (e.estado === 'rascunho' && !PACOTES[e.pacote].gratis) e.estado = 'aguardando_pagamento'
      if (e.estado !== 'aguardando_pagamento') {
        falhar(409, 'transicao_invalida', 'Este evento não está aguardando pagamento.', { estado: e.estado })
      }
      banco.pagamentos[e.id] = 'pendente'
      await salvar(banco)
      return 'pendente'
    },

    async statusPagamento(eventoId) {
      const banco = await abrir()
      return banco.pagamentos[doAnfitriao(banco, eventoId).id] ?? null
    },

    async eventoPublico(codigo): Promise<EventoPublico> {
      const banco = await abrir()
      const e = porCodigo(banco, codigo)
      return {
        nome: e.nome,
        estado: e.estado,
        poses_por_convidado: e.poses_por_convidado,
        captura_inicio: e.captura_inicio,
        captura_fim: e.captura_fim,
        revelacao_em: e.revelacao_em,
        revelacao_manual: e.revelacao_manual,
        revelado_em: e.revelado_em,
        expira_em: e.expira_em,
        album_privado: e.album_privado,
        lotado: banco.convidados.filter((c) => c.evento_id === e.id).length >= e.limite_convidados,
        fotos: ativas(banco, e.id).length,
      }
    },

    async entrar(codigo, apelido): Promise<Entrada> {
      const banco = await abrir()
      const e = porCodigo(banco, codigo)
      const token = sessao.tokenDoConvidado(codigo)
      const ja = banco.convidados.find((c) => c.evento_id === e.id && c.token === token)
      if (ja) {
        const usadas = banco.fotos.filter((f) => f.convidado_id === ja.id && !f.removida_em).length
        return { convidado_id: ja.id, apelido: ja.apelido, poses_restantes: Math.max(0, e.poses_por_convidado - usadas) }
      }
      if (e.estado !== 'captura_aberta') {
        falhar(409, 'captura_fechada', 'A câmera deste evento não está aberta.', {
          estado: e.estado,
          captura_inicio: e.captura_inicio,
          captura_fim: e.captura_fim,
        })
      }
      if (banco.convidados.filter((c) => c.evento_id === e.id).length >= e.limite_convidados) {
        falhar(409, 'lotado', 'Este evento atingiu o limite de convidados.')
      }
      const novo: ConvidadoInterno = {
        id: crypto.randomUUID(),
        evento_id: e.id,
        token: gerarToken(),
        apelido: apelido?.trim().slice(0, 40) || null,
        criado_em: agora().toISOString(),
      }
      banco.convidados.push(novo)
      await salvar(banco)
      sessao.guardarTokenDoConvidado(e.codigo, novo.token)
      return { convidado_id: novo.id, apelido: novo.apelido, poses_restantes: e.poses_por_convidado }
    },

    async eu(codigo) {
      const banco = await abrir()
      const { evento, convidado } = doAparelho(banco, codigo)
      const minhas = ativas(banco, evento.id).filter((f) => f.convidado_id === convidado.id)
      return {
        convidado_id: convidado.id,
        apelido: convidado.apelido,
        estado: evento.estado,
        poses_restantes: Math.max(0, evento.poses_por_convidado - minhas.length),
        fotos: minhas.map((f) => f.id),
      }
    },

    async enviarFoto(codigo, fotoId, foto, info = {}) {
      const id = fotoId.toLowerCase()
      if (!UUID.test(id)) falhar(400, 'id_invalido', 'O id da foto precisa ser um UUID.')
      if (!foto.type.startsWith('image/jpeg')) falhar(415, 'tipo_invalido', 'Envie a foto como image/jpeg.')
      const banco = await abrir()
      const { evento, convidado } = doAparelho(banco, codigo)
      await validarArquivo(foto, FOTO_MAX_BYTES, 'foto')

      const existente = banco.fotos.find((f) => f.id === id)
      if (existente) {
        if (existente.convidado_id !== convidado.id) falhar(409, 'id_em_uso', 'Esse id de foto já existe.')
        await persistencia.gravar(chaveFoto(id), foto)
        return { foto_id: id, repetida: true }
      }
      if (!aceitaEnvio(evento)) {
        falhar(409, 'captura_fechada', 'A câmera deste evento não aceita mais fotos.', { estado: evento.estado })
      }
      const doEvento = ativas(banco, evento.id)
      if (doEvento.filter((f) => f.convidado_id === convidado.id).length >= evento.poses_por_convidado) {
        falhar(409, 'sem_poses', 'Você usou todas as suas poses.')
      }
      if (evento.limite_fotos !== null && doEvento.length >= evento.limite_fotos) {
        falhar(409, 'evento_cheio', 'O evento atingiu o limite de fotos.')
      }
      await persistencia.gravar(chaveFoto(id), foto)
      banco.fotos.push({
        id,
        evento_id: evento.id,
        convidado_id: convidado.id,
        largura: info.largura ?? null,
        altura: info.altura ?? null,
        tirada_em: info.tirada_em ?? null,
        enviada_em: agora().toISOString(),
        removida_em: null,
        tem_miniatura: false,
        exemplo: false,
      })
      await salvar(banco)
      return { foto_id: id, repetida: false }
    },

    async enviarMiniatura(codigo, fotoId, miniatura) {
      const id = fotoId.toLowerCase()
      if (!UUID.test(id)) falhar(400, 'id_invalido', 'O id da foto precisa ser um UUID.')
      if (!miniatura.type.startsWith('image/jpeg')) falhar(415, 'tipo_invalido', 'Envie a miniatura como image/jpeg.')
      const banco = await abrir()
      const { evento, convidado } = doAparelho(banco, codigo)
      if (!aceitaEnvio(evento)) {
        falhar(409, 'captura_fechada', 'A câmera deste evento não aceita mais fotos.', { estado: evento.estado })
      }
      const foto = banco.fotos.find((f) => f.id === id && f.convidado_id === convidado.id && !f.removida_em)
      if (!foto) falhar(404, 'nao_encontrada', 'Foto não encontrada.')
      await validarArquivo(miniatura, MINIATURA_MAX_BYTES, 'miniatura')
      await persistencia.gravar(chaveMiniatura(id), miniatura)
      foto.tem_miniatura = true
      await salvar(banco)
    },

    async album(codigo, opcoesAlbum = {}) {
      const banco = await abrir()
      const e = porCodigo(banco, codigo)
      barrarExpirado(e)
      if (e.estado !== 'revelado') {
        falhar(409, 'nao_revelado', 'As fotos só aparecem na revelação.', { estado: e.estado, revelacao_em: e.revelacao_em })
      }
      if (e.album_privado) falhar(403, 'album_privado', 'O anfitrião deixou este álbum privado.')
      if (!opcoesAlbum.minhas) return paginaDoAlbum(banco, e, opcoesAlbum, null)
      return paginaDoAlbum(banco, e, opcoesAlbum, doAparelho(banco, codigo).convidado.id)
    },

    async pedirRemocao(codigo, fotoId, motivo) {
      const banco = await abrir()
      const e = porCodigo(banco, codigo)
      if (!banco.fotos.some((f) => f.id === fotoId && f.evento_id === e.id && !f.removida_em)) {
        falhar(404, 'nao_encontrada', 'Foto não encontrada.')
      }
      banco.pedidos.push({
        id: crypto.randomUUID(),
        evento_id: e.id,
        foto_id: fotoId,
        motivo: motivo?.trim() || null,
        criado_em: agora().toISOString(),
      })
      await salvar(banco)
    },
  }

  const dev: FerramentasSimulada = {
    async eventos() {
      const banco = await abrir()
      return banco.eventos
        .filter((e) => !e.excluido_em)
        .map(({ id, codigo, nome, estado }) => ({ id, codigo, nome, estado }))
    },

    async forcarEstado(codigoOuId, estado) {
      const banco = await abrir()
      const e = banco.eventos.find((ev) => ev.id === codigoOuId || ev.codigo === codigoOuId.toUpperCase())
      if (!e) falhar(404, 'nao_encontrado', 'Evento não encontrado.')
      Object.assign(e, horariosPara(estado, agora(), e.pacote), { estado, revelacao_manual: false, excluido_em: null })
      await salvar(banco)
      return semInternos(e)
    },

    async simularPagamento(eventoId, resultado) {
      const banco = await abrir()
      const e = banco.eventos.find((ev) => ev.id === eventoId)
      if (!e) falhar(404, 'nao_encontrado', 'Evento não encontrado.')
      banco.pagamentos[e.id] = resultado
      if (e.estado === 'aguardando_pagamento' && resultado === 'aprovado') e.estado = 'pronto'
      if (e.estado === 'aguardando_pagamento' && resultado === 'recusado') e.estado = 'rascunho'
      await salvar(banco)
      return semInternos(e)
    },

    async resetar() {
      const banco = await abrir()
      await Promise.all(
        banco.fotos.filter((f) => !f.exemplo).flatMap((f) => [persistencia.apagar(chaveFoto(f.id)), persistencia.apagar(chaveMiniatura(f.id))]),
      )
      for (const url of urls.values()) URL.revokeObjectURL(url)
      urls.clear()
      await semear()
    },
  }

  return {
    ...serializar(api),
    // Síncrono: só olha os tokens guardados no aparelho.
    anfitriaoNesteAparelho: () => Object.keys(sessao.tokensDoAnfitriao()).length > 0,
    preparar: async () => {
      await abrir()
    },
    dev: serializar(dev),
  }
}
