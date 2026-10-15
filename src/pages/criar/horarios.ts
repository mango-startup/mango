// Converte os campos da criação (data, início, fim e revelação) em horários ISO para a api.
// Regras iguais às do servidor (src/lib/api/regras.ts), com as mensagens no tom da tela.

export type ModoRevelacao = 'manha' | 'escolher' | 'manual'

export interface CamposHorario {
  /** AAAA-MM-DD */
  data: string
  /** HH:MM */
  inicio: string
  /** HH:MM; antes do início = termina no dia seguinte */
  fim: string
  revelacao: ModoRevelacao
  /** AAAA-MM-DDTHH:MM, só no modo 'escolher' */
  revelacaoEm: string
}

export interface Horarios {
  captura_inicio: string
  captura_fim: string
  revelacao_em?: string
  revelacao_manual: boolean
  fimNoDiaSeguinte: boolean
  /** Revelação calculada (para a pré-visualização), também no modo 'manha'. */
  revelacao: Date | null
}

export type CampoHorario = 'data' | 'fim' | 'revelacaoEm'

export interface ErroHorario {
  campo: CampoHorario
  mensagem: string
}

const DIA_MS = 24 * 60 * 60 * 1000
const HORA_REVELACAO_PADRAO = 10

function local(data: string, hora: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data) || !/^\d{2}:\d{2}$/.test(hora)) return null
  const d = new Date(`${data}T${hora}`)
  return Number.isNaN(d.getTime()) ? null : d
}

/** As próximas 10h depois do fim, com pelo menos 1 h de folga (festa até 2h revela às 10h do mesmo dia). */
export function manhaSeguinte(fim: Date): Date {
  const r = new Date(fim.getFullYear(), fim.getMonth(), fim.getDate(), HORA_REVELACAO_PADRAO)
  while (r.getTime() - fim.getTime() < 60 * 60 * 1000) r.setDate(r.getDate() + 1)
  return r
}

/** `revelacaoMaxDias`: configuração `revelacao_max_dias` do servidor (padrão 7). */
export function montarHorarios(c: CamposHorario, agora = new Date(), limites: { revelacaoMaxDias: number } = { revelacaoMaxDias: 7 }): Horarios | ErroHorario {
  const inicio = local(c.data, c.inicio)
  let fim = local(c.data, c.fim)
  if (!inicio || !fim) return { campo: 'data', mensagem: 'Informe a data e os horários da câmera.' }
  if (fim.getTime() === inicio.getTime()) return { campo: 'fim', mensagem: 'O fim precisa ser depois do início.' }
  const fimNoDiaSeguinte = fim < inicio
  if (fimNoDiaSeguinte) fim = new Date(fim.getTime() + DIA_MS)
  if (fim <= agora) return { campo: 'data', mensagem: 'Essa data já passou. Escolha um horário no futuro.' }

  if (c.revelacao === 'manual') {
    return { captura_inicio: inicio.toISOString(), captura_fim: fim.toISOString(), revelacao_manual: true, fimNoDiaSeguinte, revelacao: null }
  }
  const revelacao = c.revelacao === 'manha' ? manhaSeguinte(fim) : new Date(c.revelacaoEm)
  if (Number.isNaN(revelacao.getTime())) return { campo: 'revelacaoEm', mensagem: 'Escolha o dia e a hora da revelação.' }
  if (revelacao < fim) return { campo: 'revelacaoEm', mensagem: 'A revelação precisa ser depois que a câmera fechar.' }
  if (revelacao.getTime() - fim.getTime() > limites.revelacaoMaxDias * DIA_MS) {
    return { campo: 'revelacaoEm', mensagem: `A revelação pode ser no máximo ${limites.revelacaoMaxDias} dias depois da festa.` }
  }
  return {
    captura_inicio: inicio.toISOString(),
    captura_fim: fim.toISOString(),
    revelacao_em: revelacao.toISOString(),
    revelacao_manual: false,
    fimNoDiaSeguinte,
    revelacao,
  }
}
