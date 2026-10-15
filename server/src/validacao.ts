import { CAPTURA_MAX_MS, REVELACAO_MAX_MS } from './estados.ts'
import { POSES_VALIDAS } from './pacotes.ts'
import type { DefinicaoPacote } from './pacotes.ts'

export interface ConfigEvento {
  nome: string
  poses: number
  inicio: Date
  fim: Date
  manual: boolean
  revelacao: Date | null
}

export type ResultadoConfig = { ok: true; config: ConfigEvento } | { ok: false; erro: string; mensagem: string }

function lerData(valor: unknown): Date | null {
  if (typeof valor !== 'string') return null
  const data = new Date(valor)
  return Number.isNaN(data.getTime()) ? null : data
}

/** Regras de nome, poses e horários do evento. Valem na criação e na edição. */
export function validarConfig(entrada: Record<string, unknown>, pacote: DefinicaoPacote, agora: Date): ResultadoConfig {
  const falha = (erro: string, mensagem: string): ResultadoConfig => ({ ok: false, erro, mensagem })

  const nome = typeof entrada.nome === 'string' ? entrada.nome.trim() : ''
  if (nome.length < 1 || nome.length > 80) return falha('nome_invalido', 'O nome precisa ter de 1 a 80 caracteres.')

  const poses = entrada.poses_por_convidado ?? Math.min(24, pacote.posesMax)
  if (typeof poses !== 'number' || !POSES_VALIDAS.includes(poses) || poses > pacote.posesMax) {
    return falha('poses_invalidas', `As poses podem ser ${POSES_VALIDAS.filter((p) => p <= pacote.posesMax).join(', ')}.`)
  }

  const inicio = lerData(entrada.captura_inicio)
  const fim = lerData(entrada.captura_fim)
  if (!inicio || !fim) return falha('datas_invalidas', 'Informe captura_inicio e captura_fim (ISO 8601).')
  if (fim <= agora) return falha('fim_no_passado', 'O fim da captura precisa ser no futuro.')
  if (fim <= inicio) return falha('periodo_invalido', 'O fim precisa ser depois do início.')
  if (fim.getTime() - inicio.getTime() > CAPTURA_MAX_MS) {
    return falha('periodo_longo', 'A câmera pode ficar aberta por no máximo 48 horas.')
  }

  const manual = entrada.revelacao_manual === true
  let revelacao: Date | null = null
  if (!manual) {
    // Padrão: 12 h depois do fim. O front costuma mandar "10h do dia seguinte" no fuso do anfitrião.
    revelacao = entrada.revelacao_em === undefined ? new Date(fim.getTime() + 12 * 3600_000) : lerData(entrada.revelacao_em)
    if (!revelacao) return falha('revelacao_invalida', 'revelacao_em inválida.')
    if (revelacao < fim || revelacao.getTime() - fim.getTime() > REVELACAO_MAX_MS) {
      return falha('revelacao_fora_do_prazo', 'A revelação deve ser depois do fim e em até 7 dias.')
    }
  }
  return { ok: true, config: { nome, poses, inicio, fim, manual, revelacao } }
}
