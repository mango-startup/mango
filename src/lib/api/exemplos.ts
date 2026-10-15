// Dados de exemplo da api simulada: um evento em cada estado, para as telas terem o que mostrar.
import { DIA_MS, HORA_MS, PACOTES, expiracao, gerarToken } from './regras.ts'
import type { Estado, Evento, Pacote, PedidoRemocao, StatusPagamento } from './tipos.ts'

export interface EventoInterno extends Evento {
  anfitriao_token: string
  excluido_em: string | null
  criado_em: string
}

export interface ConvidadoInterno {
  id: string
  evento_id: string
  token: string
  apelido: string | null
  criado_em: string
}

export interface FotoInterna {
  id: string
  evento_id: string
  convidado_id: string
  largura: number | null
  altura: number | null
  tirada_em: string | null
  enviada_em: string
  removida_em: string | null
  tem_miniatura: boolean
  /** Foto gerada aqui (sem arquivo guardado); a imagem é desenhada na hora. */
  exemplo: boolean
}

export interface Banco {
  versao: number
  eventos: EventoInterno[]
  convidados: ConvidadoInterno[]
  fotos: FotoInterna[]
  pedidos: PedidoInterno[]
  pagamentos: Record<string, StatusPagamento>
}

export interface PedidoInterno extends Omit<PedidoRemocao, 'numero'> {
  evento_id: string
  /** Quem pediu: convidado (`c:<id>`) ou visitante sem token (`anonimo`). */
  solicitante: string
  resolucao: 'removida' | 'mantida' | null
}

export const VERSAO_BANCO = 2

type Horarios = Pick<Evento, 'captura_inicio' | 'captura_fim' | 'revelacao_em' | 'revelado_em' | 'expira_em'>

/** Horários coerentes com o estado pedido, para o relógio não desfazer um estado forçado. */
export function horariosPara(estado: Estado, agora: Date, pacote: Pacote): Horarios {
  const t = agora.getTime()
  const iso = (ms: number) => new Date(t + ms).toISOString()
  switch (estado) {
    case 'captura_aberta':
      return { captura_inicio: iso(-2 * HORA_MS), captura_fim: iso(4 * HORA_MS), revelacao_em: iso(16 * HORA_MS), revelado_em: null, expira_em: null }
    case 'captura_encerrada':
      return { captura_inicio: iso(-8 * HORA_MS), captura_fim: iso(-HORA_MS), revelacao_em: iso(13 * HORA_MS), revelado_em: null, expira_em: null }
    case 'revelado': {
      const revelado = new Date(t - 8 * HORA_MS)
      return {
        captura_inicio: iso(-26 * HORA_MS),
        captura_fim: iso(-20 * HORA_MS),
        revelacao_em: revelado.toISOString(),
        revelado_em: revelado.toISOString(),
        expira_em: expiracao(pacote, revelado),
      }
    }
    case 'expirado': {
      const revelado = new Date(t - (PACOTES[pacote].retencao_dias + 1) * DIA_MS)
      return {
        captura_inicio: new Date(revelado.getTime() - 20 * HORA_MS).toISOString(),
        captura_fim: new Date(revelado.getTime() - 14 * HORA_MS).toISOString(),
        revelacao_em: revelado.toISOString(),
        revelado_em: revelado.toISOString(),
        expira_em: iso(-DIA_MS),
      }
    }
    default:
      // rascunho, aguardando_pagamento, pronto e cancelado: evento no futuro
      return { captura_inicio: iso(3 * DIA_MS), captura_fim: iso(3 * DIA_MS + 7 * HORA_MS), revelacao_em: iso(4 * DIA_MS), revelado_em: null, expira_em: null }
  }
}

const APELIDOS = ['Marina', 'Léo', 'Ana', 'Rafa', 'Bia', 'Caio', 'Duda', 'Gabi', 'Pedro', 'Júlia', 'Tati', 'Nando', null, 'Vó Cida', 'Lucas', null]

interface Modelo {
  id: string
  codigo: string
  nome: string
  estado: Estado
  pacote: Pacote
  poses: number
  convidados: number
  fotos: number
}

const MODELOS: Modelo[] = [
  { id: 'exemplo-rascunho', codigo: 'RASCUNH2', nome: 'Churrasco da firma', estado: 'rascunho', pacote: 'festa', poses: 24, convidados: 0, fotos: 0 },
  { id: 'exemplo-pagamento', codigo: 'PAGAMENT', nome: 'Formatura de Direito', estado: 'aguardando_pagamento', pacote: 'celebracao', poses: 24, convidados: 0, fotos: 0 },
  { id: 'exemplo-pronto', codigo: 'PRNT2345', nome: 'Aniversário de 30 do Rafa', estado: 'pronto', pacote: 'teste', poses: 12, convidados: 0, fotos: 0 },
  { id: 'exemplo-aberta', codigo: 'ABERTA27', nome: 'Casamento da Ana e do Léo', estado: 'captura_aberta', pacote: 'casamento', poses: 24, convidados: 63, fotos: 412 },
  { id: 'exemplo-encerrada', codigo: 'ENCERRAD', nome: 'Chá de casa nova da Bia', estado: 'captura_encerrada', pacote: 'festa', poses: 24, convidados: 22, fotos: 180 },
  { id: 'exemplo-revelado', codigo: 'REVPHT24', nome: 'Festa junina da rua', estado: 'revelado', pacote: 'celebracao', poses: 24, convidados: 48, fotos: 400 },
  { id: 'exemplo-expirado', codigo: 'EXPRAD99', nome: 'Réveillon na praia', estado: 'expirado', pacote: 'festa', poses: 36, convidados: 30, fotos: 0 },
  { id: 'exemplo-cancelado', codigo: 'CANC2345', nome: 'Jantar de noivado', estado: 'cancelado', pacote: 'teste', poses: 12, convidados: 0, fotos: 0 },
]

/** Evento onde este aparelho já entrou como convidado, para o filtro "Minhas" ter fotos. */
export const CODIGO_COM_CONVIDADO = 'REVPHT24'

export interface Exemplos {
  banco: Banco
  /** id do evento → token do anfitrião */
  anfitriao: Record<string, string>
  /** código → token do convidado deste aparelho */
  convidado: Record<string, string>
}

export function criarExemplos(agora: Date): Exemplos {
  const banco: Banco = { versao: VERSAO_BANCO, eventos: [], convidados: [], fotos: [], pedidos: [], pagamentos: {} }
  const anfitriao: Record<string, string> = {}
  const convidado: Record<string, string> = {}

  for (const m of MODELOS) {
    const horarios = horariosPara(m.estado, agora, m.pacote)
    const token = gerarToken()
    anfitriao[m.id] = token
    banco.eventos.push({
      id: m.id,
      codigo: m.codigo,
      nome: m.nome,
      estado: m.estado,
      pacote: m.pacote,
      limite_convidados: PACOTES[m.pacote].convidados,
      poses_por_convidado: m.poses,
      limite_fotos: PACOTES[m.pacote].convidados * m.poses,
      ...horarios,
      revelacao_manual: false,
      album_privado: false,
      anfitriao_token: token,
      excluido_em: null,
      criado_em: new Date(agora.getTime() - 10 * DIA_MS).toISOString(),
    })
    if (m.estado === 'aguardando_pagamento') banco.pagamentos[m.id] = 'pendente'

    const convidados: ConvidadoInterno[] = Array.from({ length: m.convidados }, (_, i) => ({
      id: `${m.id}-convidado-${i + 1}`,
      evento_id: m.id,
      token: gerarToken(),
      apelido: APELIDOS[i % APELIDOS.length],
      criado_em: horarios.captura_inicio ?? agora.toISOString(),
    }))
    banco.convidados.push(...convidados)
    if (m.codigo === CODIGO_COM_CONVIDADO && convidados[0]) convidado[m.codigo] = convidados[0].token

    // Fotos espalhadas entre o início da captura e o fim (ou agora, se ainda está aberta)
    const inicio = new Date(horarios.captura_inicio ?? agora).getTime()
    const fim = Math.min(new Date(horarios.captura_fim ?? agora).getTime(), agora.getTime())
    for (let i = 0; i < m.fotos && convidados.length > 0; i++) {
      const dono = convidados[(i * 7) % convidados.length]
      const tirada = new Date(inicio + ((fim - inicio) * (i + 0.5)) / m.fotos).toISOString()
      banco.fotos.push({
        id: `${m.id}-foto-${i + 1}`,
        evento_id: m.id,
        convidado_id: dono.id,
        largura: 1200,
        altura: 1600,
        tirada_em: tirada,
        enviada_em: tirada,
        removida_em: null,
        tem_miniatura: true,
        exemplo: true,
      })
    }
  }
  return { banco, anfitriao, convidado }
}

const TONS = ['#6b4f3a', '#2f4858', '#8a6f4e', '#4a5d4f', '#7a4b5b', '#3d3a4b', '#9c7a54', '#55606e']

/** Imagem de exemplo (SVG) com o número do quadro, sem depender de rede. */
export function imagemDeExemplo(quadro: number): string {
  const fundo = TONS[quadro % TONS.length]
  const luz = TONS[(quadro * 3 + 2) % TONS.length]
  const cx = 60 + ((quadro * 53) % 180)
  const cy = 80 + ((quadro * 97) % 220)
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 400">` +
    `<rect width="300" height="400" fill="${fundo}"/>` +
    `<circle cx="${cx}" cy="${cy}" r="90" fill="${luz}" opacity=".55"/>` +
    `<text x="18" y="380" font-family="sans-serif" font-size="22" fill="#f4f2ec">${String(quadro).padStart(3, '0')}</text>` +
    `</svg>`
  return `data:image/svg+xml,${encodeURIComponent(svg)}`
}
