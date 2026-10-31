import assert from 'node:assert/strict'
import { test } from 'node:test'
import { criarWebhookN8n } from '../src/avisos.ts'
import type { DadosEvento } from '../src/avisos.ts'

const evento: DadosEvento = {
  id: 'e1', codigo: 'ABC123', nome: 'Casamento', estado: 'pronto', pacote: 'festa', limite_convidados: 30,
  captura_inicio: null, captura_fim: null, revelacao_em: null, valor_centavos: 4900, anfitriao_email: 'a@b.com',
}
const esperar = () => new Promise((r) => setTimeout(r, 10))

test('avisar envia o JSON com o segredo e o link do convidado', async () => {
  const chamadas: { url: string; init: RequestInit }[] = []
  const buscar = (async (url: string, init: RequestInit) => {
    chamadas.push({ url, init })
    return new Response('ok')
  }) as unknown as typeof fetch
  criarWebhookN8n('https://n8n.teste/webhook/x', 'segredo', 'https://mango.teste', buscar).avisar('evento_pronto', evento)
  await esperar()
  assert.equal(chamadas.length, 1)
  assert.equal((chamadas[0].init.headers as Record<string, string>).authorization, 'Bearer segredo')
  const corpo = JSON.parse(chamadas[0].init.body as string)
  assert.equal(corpo.tipo, 'evento_pronto')
  assert.equal(corpo.evento.link_convidado, 'https://mango.teste/c/ABC123')
  assert.ok(corpo.id_aviso)
  assert.ok(!('anfitriao_token' in corpo.evento))
})

test('falha do n8n vira log e nunca lança', async () => {
  const logs: Record<string, unknown>[] = []
  const buscar = (async () => {
    throw new Error('rede caiu')
  }) as unknown as typeof fetch
  const av = criarWebhookN8n('https://n8n.teste/x', 's', null, buscar, (d) => logs.push(d))
  assert.doesNotThrow(() => av.avisar('album_revelado', evento))
  await esperar()
  assert.equal(logs[0].aviso, 'falha_envio')
  const r500 = (async () => new Response('x', { status: 500 })) as unknown as typeof fetch
  criarWebhookN8n('https://n8n.teste/x', 's', null, r500, (d) => logs.push(d)).avisar('evento_criado', evento)
  await esperar()
  assert.equal(logs[1].aviso, 'falha_http')
})
