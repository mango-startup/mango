// Regras do evento, espelhando o servidor (server/src/estados.ts, pacotes.ts, agendador.ts e
// as validações de rotas/eventos.ts). Se uma regra mudar lá, mude aqui também.
import type { DefinicaoPacote, Estado, Evento, NovoEvento, Pacote } from './tipos.ts'

export const HORA_MS = 60 * 60 * 1000
export const DIA_MS = 24 * HORA_MS
export const CAPTURA_MAX_MS = 48 * HORA_MS
export const REVELACAO_MAX_MS = 7 * DIA_MS
/** Revelação padrão do servidor quando o evento não informa horário. */
export const REVELACAO_PADRAO_MS = 12 * HORA_MS
/** Depois que a câmera fecha, ainda aceitamos envios atrasados por este tempo. */
export const ENVIO_ATRASADO_MS = DIA_MS
export const FOTO_MAX_BYTES = 2 * 1024 * 1024
export const MINIATURA_MAX_BYTES = 512 * 1024
export const POSES_VALIDAS = [12, 24, 36]

// Preços: hipótese do plano do MVP (seção 3.2), ainda sem validação.
export const PACOTES: Record<Pacote, DefinicaoPacote> = {
  teste: { id: 'teste', nome: 'Teste', convidados: 10, gratis: true, retencao_dias: 30, poses_max: 12, preco_centavos: 0 },
  festa: { id: 'festa', nome: 'Festa', convidados: 30, gratis: false, retencao_dias: 365, poses_max: 36, preco_centavos: 4900 },
  celebracao: { id: 'celebracao', nome: 'Celebração', convidados: 80, gratis: false, retencao_dias: 365, poses_max: 36, preco_centavos: 9900 },
  casamento: { id: 'casamento', nome: 'Casamento', convidados: 200, gratis: false, retencao_dias: 365, poses_max: 36, preco_centavos: 19900 },
}

const TRANSICOES: Record<Estado, Estado[]> = {
  rascunho: ['aguardando_pagamento', 'pronto'],
  aguardando_pagamento: ['pronto', 'rascunho'],
  pronto: ['captura_aberta', 'cancelado'],
  captura_aberta: ['captura_encerrada'],
  captura_encerrada: ['revelado'],
  revelado: ['expirado'],
  expirado: [],
  cancelado: [],
}

export function podeTransicionar(de: Estado, para: Estado): boolean {
  return TRANSICOES[de].includes(para)
}

export function ehPacote(valor: unknown): valor is Pacote {
  return typeof valor === 'string' && Object.hasOwn(PACOTES, valor)
}

// Sem caracteres ambíguos (0/O, 1/I/L) para o código poder ser lido em QR impresso ou ditado.
const ALFABETO_CODIGO = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'

export function gerarCodigo(tamanho = 8): string {
  const sorteio = crypto.getRandomValues(new Uint32Array(tamanho))
  return Array.from(sorteio, (n) => ALFABETO_CODIGO[n % ALFABETO_CODIGO.length]).join('')
}

export function gerarToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(24))
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export interface ErroValidacao {
  erro: string
  mensagem: string
}

export type CamposEvento = Pick<
  Evento,
  'nome' | 'pacote' | 'poses_por_convidado' | 'captura_inicio' | 'captura_fim' | 'revelacao_em' | 'revelacao_manual'
>

function lerData(valor: unknown): Date | null {
  if (typeof valor !== 'string') return null
  const data = new Date(valor)
  return Number.isNaN(data.getTime()) ? null : data
}

/** Mesmas validações e mensagens do POST /api/eventos. */
export function validarNovoEvento(dados: NovoEvento, agora: Date): CamposEvento | ErroValidacao {
  const nome = typeof dados.nome === 'string' ? dados.nome.trim() : ''
  if (nome.length < 1 || nome.length > 80) return { erro: 'nome_invalido', mensagem: 'O nome precisa ter de 1 a 80 caracteres.' }

  const pacoteNome = dados.pacote ?? 'teste'
  if (!ehPacote(pacoteNome)) return { erro: 'pacote_invalido', mensagem: 'Pacote desconhecido.' }
  const pacote = PACOTES[pacoteNome]

  const poses = dados.poses_por_convidado ?? Math.min(24, pacote.poses_max)
  if (!POSES_VALIDAS.includes(poses) || poses > pacote.poses_max) {
    const validas = POSES_VALIDAS.filter((p) => p <= pacote.poses_max).join(', ')
    return { erro: 'poses_invalidas', mensagem: `As poses podem ser ${validas}.` }
  }

  const inicio = lerData(dados.captura_inicio)
  const fim = lerData(dados.captura_fim)
  if (!inicio || !fim) return { erro: 'datas_invalidas', mensagem: 'Informe captura_inicio e captura_fim (ISO 8601).' }
  if (fim <= agora) return { erro: 'fim_no_passado', mensagem: 'O fim da captura precisa ser no futuro.' }
  if (fim <= inicio) return { erro: 'periodo_invalido', mensagem: 'O fim precisa ser depois do início.' }
  if (fim.getTime() - inicio.getTime() > CAPTURA_MAX_MS) {
    return { erro: 'periodo_longo', mensagem: 'A câmera pode ficar aberta por no máximo 48 horas.' }
  }

  const manual = dados.revelacao_manual === true
  let revelacao: Date | null = null
  if (!manual) {
    revelacao = dados.revelacao_em === undefined ? new Date(fim.getTime() + REVELACAO_PADRAO_MS) : lerData(dados.revelacao_em)
    if (!revelacao) return { erro: 'revelacao_invalida', mensagem: 'revelacao_em inválida.' }
    if (revelacao < fim || revelacao.getTime() - fim.getTime() > REVELACAO_MAX_MS) {
      return { erro: 'revelacao_fora_do_prazo', mensagem: 'A revelação deve ser depois do fim e em até 7 dias.' }
    }
  }

  return {
    nome,
    pacote: pacoteNome,
    poses_por_convidado: poses,
    captura_inicio: inicio.toISOString(),
    captura_fim: fim.toISOString(),
    revelacao_em: revelacao ? revelacao.toISOString() : null,
    revelacao_manual: manual,
  }
}

export function expiracao(pacote: Pacote, reveladoEm: Date): string {
  return new Date(reveladoEm.getTime() + PACOTES[pacote].retencao_dias * DIA_MS).toISOString()
}

const antesOuIgual = (iso: string | null, agora: Date) => iso !== null && new Date(iso).getTime() <= agora.getTime()

/**
 * Avança o evento pelo relógio (início, fim, revelação, expiração), como o agendador do servidor.
 * Aplica as regras em sequência, então um evento parado há dias pode pular vários estados.
 */
export function avancarPeloRelogio(evento: Evento, agora: Date): Evento {
  const e = { ...evento }
  if (e.estado === 'pronto' && antesOuIgual(e.captura_inicio, agora) && !antesOuIgual(e.captura_fim, agora)) {
    e.estado = 'captura_aberta'
  }
  if ((e.estado === 'pronto' || e.estado === 'captura_aberta') && antesOuIgual(e.captura_fim, agora)) {
    e.estado = 'captura_encerrada'
  }
  if (e.estado === 'captura_encerrada' && !e.revelacao_manual && antesOuIgual(e.revelacao_em, agora)) {
    e.estado = 'revelado'
    e.revelado_em = agora.toISOString()
    e.expira_em = expiracao(e.pacote, agora)
  }
  if (e.estado === 'revelado' && antesOuIgual(e.expira_em, agora)) {
    e.estado = 'expirado'
  }
  return e
}
