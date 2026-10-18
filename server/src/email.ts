/** Envio de e-mail pelo Resend (https://resend.com), por HTTP, sem biblioteca. */
export interface Email {
  para: string
  assunto: string
  texto: string
}

export interface EnviadorEmail {
  enviar(email: Email): Promise<{ ok: true } | { ok: false; erro: string }>
}

export function criarResend(chave: string, remetente: string, buscar: typeof fetch = fetch): EnviadorEmail {
  return {
    async enviar(email) {
      try {
        const r = await buscar('https://api.resend.com/emails', {
          method: 'POST',
          headers: { authorization: `Bearer ${chave}`, 'content-type': 'application/json' },
          body: JSON.stringify({ from: remetente, to: [email.para], subject: email.assunto, text: email.texto }),
          signal: AbortSignal.timeout(10_000),
        })
        if (r.ok) return { ok: true }
        const corpo = (await r.json().catch(() => null)) as { message?: string } | null
        return { ok: false, erro: `Resend ${r.status}: ${corpo?.message ?? 'falha ao enviar'}`.slice(0, 300) }
      } catch (e) {
        return { ok: false, erro: e instanceof Error ? e.message.slice(0, 300) : 'falha ao enviar' }
      }
    },
  }
}
