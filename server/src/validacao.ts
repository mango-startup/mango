import type { Config } from './configuracao.ts'
import type { Pacote } from './pacotes.ts'

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

/** Regras de nome, poses e horários do evento (limites vêm da configuração). Valem na criação e na edição. */
export function validarConfig(entrada: Record<string, unknown>, pacote: Pacote, agora: Date, cfg: Config): ResultadoConfig {
  const falha = (erro: string, mensagem: string): ResultadoConfig => ({ ok: false, erro, mensagem })

  const nome = typeof entrada.nome === 'string' ? entrada.nome.trim() : ''
  if (nome.length < 1 || nome.length > cfg.nome_evento_max) return falha('nome_invalido', `O nome precisa ter de 1 a ${cfg.nome_evento_max} caracteres.`)

  const opcoesDePoses = cfg.poses_validas.filter((p) => p <= pacote.poses_max)
  const padrao = opcoesDePoses.includes(cfg.poses_padrao) ? cfg.poses_padrao : Math.max(...opcoesDePoses, 0)
  const poses = entrada.poses_por_convidado ?? padrao
  if (typeof poses !== 'number' || !opcoesDePoses.includes(poses)) {
    return falha('poses_invalidas', `As fotos por convidado podem ser ${opcoesDePoses.join(', ')}.`)
  }

  const inicio = lerData(entrada.captura_inicio)
  const fim = lerData(entrada.captura_fim)
  if (!inicio || !fim) return falha('datas_invalidas', 'Informe captura_inicio e captura_fim (ISO 8601).')
  if (fim <= agora) return falha('fim_no_passado', 'O fim da captura precisa ser no futuro.')
  if (fim <= inicio) return falha('periodo_invalido', 'O fim precisa ser depois do início.')
  if (fim.getTime() - inicio.getTime() > cfg.captura_max_horas * 3600_000) {
    return falha('periodo_longo', `A câmera pode ficar aberta por no máximo ${cfg.captura_max_horas} horas.`)
  }

  const manual = entrada.revelacao_manual === true
  let revelacao: Date | null = null
  if (!manual) {
    // Padrão: 12 h depois do fim. O front costuma mandar "10h do dia seguinte" no fuso do anfitrião.
    revelacao = entrada.revelacao_em === undefined ? new Date(fim.getTime() + cfg.revelacao_padrao_horas * 3600_000) : lerData(entrada.revelacao_em)
    if (!revelacao) return falha('revelacao_invalida', 'revelacao_em inválida.')
    if (revelacao < fim || revelacao.getTime() - fim.getTime() > cfg.revelacao_max_dias * 86_400_000) {
      return falha('revelacao_fora_do_prazo', `A revelação deve ser depois do fim e em até ${cfg.revelacao_max_dias} dias.`)
    }
  }
  return { ok: true, config: { nome, poses, inicio, fim, manual, revelacao } }
}
