/** Avisos do backend para o n8n por webhook (https://docs.n8n.io), fire-and-forget: falha aqui nunca derruba o fluxo do evento. */
export type TipoAviso = 'evento_criado' | 'evento_pronto' | 'album_revelado' | 'festa_amanha' | 'pagamento_pendente'

export interface DadosEvento {
  id: string
  codigo: string
  nome: string
  estado: string
  pacote: string | null
  limite_convidados: number
  captura_inicio: Date | string | null
  captura_fim: Date | string | null
  revelacao_em: Date | string | null
  valor_centavos: number | null
  anfitriao_email: string | null
}

export interface Avisador {
  /** Envia sem esperar. Nunca lança. O token secreto do anfitrião não entra no aviso. */
  avisar(tipo: TipoAviso, evento: DadosEvento): void
}

export function criarWebhookN8n(url: string, segredo: string, appUrl: string | null, buscar: typeof fetch = fetch, log: (dados: Record<string, unknown>) => void = (d) => console.warn(JSON.stringify(d))): Avisador {
  return {
    avisar(tipo, evento) {
      const corpo = JSON.stringify({
        id_aviso: crypto.randomUUID(),
        tipo,
        enviado_em: new Date().toISOString(),
        evento: { ...evento, link_convidado: appUrl ? `${appUrl}/c/${evento.codigo}` : null, link_site: appUrl },
      })
      void buscar(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${segredo}` },
        body: corpo,
        signal: AbortSignal.timeout(5_000),
      })
        .then((r) => {
          if (!r.ok) log({ origem: 'aviso_n8n', aviso: 'falha_http', tipo, status: r.status })
        })
        .catch((e) => log({ origem: 'aviso_n8n', aviso: 'falha_envio', tipo, erro: e instanceof Error ? e.message.slice(0, 200) : 'erro' }))
    },
  }
}

export const COLUNAS_AVISO = `id::text, codigo, nome, estado, pacote, limite_convidados, captura_inicio, captura_fim, revelacao_em, valor_centavos, anfitriao_email`
