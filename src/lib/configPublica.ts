// Configuração que os admins editam em /admin e o servidor publica em GET /api/config: opções de poses, prazos,
// tamanhos de foto, se o pagamento está ligado e o contato. Os padrões abaixo são os valores de fábrica do servidor
// (server/src/configuracao.ts): valem enquanto a resposta não chega, se o servidor estiver fora e na api simulada.
import { useEffect, useSyncExternalStore } from 'react'

export interface ConfigPublica {
  criacao_aberta: boolean
  pacotes_pagos_disponiveis: boolean
  contato_suporte: string
  aviso_global: string
  captura_max_horas: number
  revelacao_max_dias: number
  revelacao_padrao_horas: number
  poses_validas: number[]
  poses_padrao: number
  nome_evento_max: number
  apelido_max: number
  foto_max_kb: number
  miniatura_max_kb: number
  foto_dimensao_max_px: number
  foto_qualidade_jpeg: number
  envio_atrasado_horas: number
  pedido_remocao_motivo_max: number
}

export const CONFIG_PADRAO: Readonly<ConfigPublica> = {
  criacao_aberta: true,
  pacotes_pagos_disponiveis: false,
  contato_suporte: '',
  aviso_global: '',
  captura_max_horas: 48,
  revelacao_max_dias: 7,
  revelacao_padrao_horas: 12,
  poses_validas: [12, 24, 36],
  poses_padrao: 24,
  nome_evento_max: 80,
  apelido_max: 40,
  foto_max_kb: 2048,
  miniatura_max_kb: 512,
  foto_dimensao_max_px: 1600,
  foto_qualidade_jpeg: 0.8,
  envio_atrasado_horas: 24,
  pedido_remocao_motivo_max: 300,
}

const VALIDADE_MS = 5 * 60_000

let atual: ConfigPublica = { ...CONFIG_PADRAO }
let carregando: Promise<ConfigPublica> | null = null
let carregadoEm = 0
const ouvintes = new Set<() => void>()

/** Aceita só campo com o tipo certo; o resto fica com o padrão. Nunca confia cegamente no que chega. */
export function validarConfig(bruto: unknown): ConfigPublica {
  const origem = (bruto && typeof bruto === 'object' ? bruto : {}) as Record<string, unknown>
  const nova: Record<string, unknown> = { ...CONFIG_PADRAO }
  for (const [chave, padrao] of Object.entries(CONFIG_PADRAO)) {
    const v = origem[chave]
    if (Array.isArray(padrao)) {
      if (Array.isArray(v) && v.length > 0 && v.every((n) => typeof n === 'number' && Number.isInteger(n) && n > 0)) nova[chave] = [...(v as number[])].sort((a, b) => a - b)
    } else if (typeof v === typeof padrao && (typeof v !== 'number' || Number.isFinite(v))) {
      nova[chave] = v
    }
  }
  const c = nova as unknown as ConfigPublica
  // O servidor já garante isto; se algo vier torto, a tela não pode ficar sem opção de pose.
  if (!c.poses_validas.includes(c.poses_padrao)) c.poses_padrao = c.poses_validas[0]
  return c
}

/** O que vale agora, sem esperar a rede. Use no que roda fora de componente (ex.: a compressão da foto). */
export function configAtual(): ConfigPublica {
  return atual
}

/** Busca a configuração (no máximo uma vez por 5 minutos, salvo `forcar`). Nunca falha: sem servidor, valem os padrões. */
export function carregarConfig(forcar = false): Promise<ConfigPublica> {
  if (carregando) return carregando
  if (!forcar && Date.now() - carregadoEm < VALIDADE_MS) return Promise.resolve(atual)
  carregando = fetch('/api/config', { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(4000) })
    .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
    .then((bruto: unknown) => {
      const nova = validarConfig(bruto)
      carregadoEm = Date.now()
      if (JSON.stringify(nova) !== JSON.stringify(atual)) {
        atual = nova
        ouvintes.forEach((f) => f())
      }
      return atual
    })
    .catch(() => atual)
    .finally(() => {
      carregando = null
    })
  return carregando
}

const assinar = (f: () => void) => {
  ouvintes.add(f)
  return () => void ouvintes.delete(f)
}

/** A configuração atual; a tela se atualiza sozinha quando a resposta do servidor chega. */
export function useConfigPublica(): ConfigPublica {
  useEffect(() => {
    void carregarConfig()
  }, [])
  return useSyncExternalStore(assinar, configAtual, () => CONFIG_PADRAO as ConfigPublica)
}
