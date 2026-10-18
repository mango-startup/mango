import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { after, before, test } from 'node:test'
import { ServicoAdmin } from '../src/admin/autenticacao.ts'
import { criarApp } from '../src/app.ts'
import { definicaoDe } from '../src/configuracao.ts'
import { criarPool } from '../src/db.ts'
import { migrar } from '../src/migracoes.ts'
import { criarServicos } from '../src/servicos.ts'
import type { Storage } from '../src/storage/storage.ts'

// Precisa de um Postgres descartável: TEST_DATABASE_URL. Sem ele, os testes são pulados.
const url = process.env.TEST_DATABASE_URL
const opcoes = { skip: url ? false : 'defina TEST_DATABASE_URL para testar o admin' }
const pool = url ? criarPool(url) : undefined

class StorageMemoria implements Storage {
  arquivos = new Map<string, Uint8Array>()
  async salvar(chave: string, dados: Uint8Array) {
    this.arquivos.set(chave, dados)
  }
  async ler(chave: string) {
    return this.arquivos.get(chave) ?? null
  }
  async apagar(chave: string) {
    this.arquivos.delete(chave)
  }
}

const SENHA_INICIAL = 'Inicial-Teste-2026'
const inicio = new Date('2026-11-14T18:00:00Z')
let agora = inicio
const servicos = pool ? criarServicos(pool, () => agora) : undefined
const app = pool && servicos ? criarApp(pool, new StorageMemoria(), () => agora, undefined, servicos) : undefined
const h = (horas: number) => new Date(inicio.getTime() + horas * 3600_000).toISOString()

before(async () => {
  if (!pool) return
  await pool.query('drop schema public cascade; create schema public')
  await migrar(pool)
  await new ServicoAdmin(pool, () => agora).garantirAdmins(
    [
      { usuario: 'raziel', nome: 'Raziel' },
      { usuario: 'lucas', nome: 'Lucas' },
    ],
    SENHA_INICIAL,
  )
})
after(async () => {
  await pool?.end()
})

interface Opc {
  corpo?: unknown
  cookie?: string | null
  csrf?: boolean
  ip?: string
  bruto?: Uint8Array
  cab?: Record<string, string>
}
async function chamar(metodo: string, caminho: string, o: Opc = {}) {
  assert.ok(app)
  const cab: Record<string, string> = { ...(o.bruto ? { 'content-type': 'image/jpeg' } : { 'content-type': 'application/json' }), ...o.cab }
  if (o.cookie) cab.cookie = o.cookie
  if (o.csrf !== false && caminho.startsWith('/api/admin')) cab['x-mango-admin'] = '1'
  if (o.ip) cab['x-forwarded-for'] = o.ip
  const r = await app.request(caminho, { method: metodo, headers: cab, body: o.bruto ? (o.bruto as BodyInit) : o.corpo === undefined ? undefined : JSON.stringify(o.corpo) })
  const texto = await r.text()
  return { status: r.status, headers: r.headers, json: texto.startsWith('{') ? JSON.parse(texto) : null }
}

/** Entra e devolve o cookie pronto para as próximas chamadas. */
async function entrar(usuario: string, senha: string, ip = '10.0.0.1') {
  const r = await chamar('POST', '/api/admin/entrar', { corpo: { usuario, senha }, ip })
  const cookie = r.headers.get('set-cookie')?.split(';')[0] ?? null
  return { ...r, cookie }
}

/** Admin com a senha já trocada (sessão liberada). */
async function adminLiberado(usuario = 'raziel', nova = 'Definitiva-Segura-2026') {
  const e = await entrar(usuario, SENHA_INICIAL)
  if (e.status === 200 && e.json.admin.trocar_senha) {
    const t = await chamar('POST', '/api/admin/trocar-senha', { cookie: e.cookie, corpo: { senha_atual: SENHA_INICIAL, nova_senha: nova } })
    assert.equal(t.status, 200, JSON.stringify(t.json))
    return e.cookie as string
  }
  const de_novo = await entrar(usuario, nova)
  assert.equal(de_novo.status, 200)
  return de_novo.cookie as string
}

const config = async (cookie: string, mudancas: Record<string, unknown>) => chamar('PATCH', '/api/admin/configuracoes', { cookie, corpo: mudancas })

test('login: erro genérico, cookie seguro e exigência do header anti-CSRF', opcoes, async () => {
  const errada = await entrar('raziel', 'senha-errada')
  assert.equal(errada.status, 401)
  assert.equal(errada.json.erro, 'credenciais_invalidas')
  const inexistente = await entrar('fantasma', 'qualquer-coisa')
  assert.equal(inexistente.status, 401)
  assert.equal(inexistente.json.mensagem, errada.json.mensagem) // não revela quem existe

  assert.equal((await chamar('POST', '/api/admin/entrar', { corpo: { usuario: 'raziel', senha: SENHA_INICIAL }, csrf: false })).status, 403)
  assert.equal((await chamar('POST', '/api/admin/entrar', { corpo: { usuario: 'raziel' } })).status, 400)

  const ok = await entrar(' RAZIEL ', SENHA_INICIAL) // usuário sem diferenciar maiúscula nem espaço
  assert.equal(ok.status, 200)
  assert.equal(ok.json.admin.usuario, 'raziel')
  assert.equal(ok.json.admin.trocar_senha, true)
  const cookie = ok.headers.get('set-cookie') ?? ''
  assert.match(cookie, /mango_admin=/)
  assert.match(cookie, /HttpOnly/i)
  assert.match(cookie, /SameSite=Strict/i)
  assert.match(cookie, /Path=\/api\/admin/)
  assert.equal(ok.headers.get('cache-control'), 'no-store')
  assert.match(ok.headers.get('x-robots-tag') ?? '', /noindex/)
  const guardado = (await pool!.query('select token_hash from admin_sessoes')).rows.map((r) => r.token_hash)
  assert.ok(guardado.every((t: string) => !cookie.includes(t)) && guardado.length > 0) // só o hash fica no banco
})

test('a senha inicial só permite trocar a senha; depois a conta libera', opcoes, async () => {
  const e = await entrar('lucas', SENHA_INICIAL)
  assert.equal(e.status, 200)
  assert.equal(e.json.admin.trocar_senha, true)

  const bloqueado = await chamar('GET', '/api/admin/pacotes', { cookie: e.cookie })
  assert.equal(bloqueado.status, 403)
  assert.equal(bloqueado.json.erro, 'trocar_senha_obrigatoria')
  assert.equal((await chamar('GET', '/api/admin/eu', { cookie: e.cookie })).json.admin.trocar_senha, true)

  const troca = (corpo: unknown) => chamar('POST', '/api/admin/trocar-senha', { cookie: e.cookie, corpo })
  assert.equal((await troca({ senha_atual: 'errada', nova_senha: 'Nova-Senha-2026' })).json.erro, 'senha_atual_incorreta')
  assert.equal((await troca({ senha_atual: SENHA_INICIAL, nova_senha: 'curta1' })).json.erro, 'senha_fraca')
  assert.equal((await troca({ senha_atual: SENHA_INICIAL, nova_senha: SENHA_INICIAL })).json.erro, 'senha_fraca')
  assert.equal((await troca({ senha_atual: SENHA_INICIAL, nova_senha: 'lucas-e-eu-2026' })).json.erro, 'senha_fraca') // contém o usuário
  assert.equal((await troca({ senha_atual: SENHA_INICIAL })).status, 400)
  assert.equal((await troca({ senha_atual: SENHA_INICIAL, nova_senha: 'Nova-Senha-2026' })).status, 200)

  assert.equal((await chamar('GET', '/api/admin/pacotes', { cookie: e.cookie })).status, 200) // liberou na mesma sessão
  assert.equal((await entrar('lucas', SENHA_INICIAL)).status, 401) // a inicial não vale mais
  const novo = await entrar('lucas', 'Nova-Senha-2026')
  assert.equal(novo.status, 200)
  assert.equal(novo.json.admin.trocar_senha, false)
})

test('bloqueio depois de 5 erros e liberação depois de 15 minutos', opcoes, async () => {
  const cookie = await adminLiberado('raziel')
  void cookie
  for (let i = 0; i < 5; i++) assert.equal((await entrar('raziel', 'errada-mesmo', '10.0.0.9')).status, 401)
  const preso = await entrar('raziel', 'Definitiva-Segura-2026', '10.0.0.9') // até a senha certa espera
  assert.equal(preso.status, 429)
  assert.equal(preso.json.erro, 'conta_bloqueada')
  assert.ok(Number(preso.headers.get('retry-after')) > 0)
  agora = new Date(agora.getTime() + 16 * 60_000)
  assert.equal((await entrar('raziel', 'Definitiva-Segura-2026', '10.0.0.9')).status, 200)
})

test('sessão: precisa do cookie, sair encerra, expira em 8 h e trocar senha derruba as outras', opcoes, async () => {
  assert.equal((await chamar('GET', '/api/admin/eu')).status, 401)
  assert.equal((await chamar('GET', '/api/admin/eu', { cookie: 'mango_admin=falso' })).status, 401)

  const a = await adminLiberado('raziel')
  assert.equal((await chamar('GET', '/api/admin/pacotes', { cookie: a })).status, 200)
  assert.equal((await chamar('POST', '/api/admin/sair', { cookie: a })).status, 204)
  assert.equal((await chamar('GET', '/api/admin/eu', { cookie: a })).status, 401)

  const b = await adminLiberado('raziel')
  const antes = agora
  agora = new Date(agora.getTime() + 8 * 3600_000 + 1000)
  assert.equal((await chamar('GET', '/api/admin/eu', { cookie: b })).status, 401)
  agora = antes

  const c1 = await adminLiberado('raziel')
  const c2 = await adminLiberado('raziel')
  assert.equal((await chamar('POST', '/api/admin/trocar-senha', { cookie: c1, corpo: { senha_atual: 'Definitiva-Segura-2026', nova_senha: 'Outra-Definitiva-77' } })).status, 200)
  assert.equal((await chamar('GET', '/api/admin/eu', { cookie: c1 })).status, 200)
  assert.equal((await chamar('GET', '/api/admin/eu', { cookie: c2 })).status, 401) // a outra sessão caiu
  // volta a senha para os próximos testes
  await chamar('POST', '/api/admin/trocar-senha', { cookie: c1, corpo: { senha_atual: 'Outra-Definitiva-77', nova_senha: 'Definitiva-Segura-2026' } })
})

test('mudar requer o header anti-CSRF; leitura não', opcoes, async () => {
  const cookie = await adminLiberado('raziel')
  assert.equal((await chamar('GET', '/api/admin/pacotes', { cookie, csrf: false })).status, 200)
  assert.equal((await chamar('PATCH', '/api/admin/configuracoes', { cookie, csrf: false, corpo: { captura_max_horas: 10 } })).status, 403)
  assert.equal((await chamar('POST', '/api/admin/sair', { cookie, csrf: false })).status, 403)
})

test('configurações: lista com padrão, valida tudo ou nada, restaura e audita', opcoes, async () => {
  const cookie = await adminLiberado('raziel')
  const lista = await chamar('GET', '/api/admin/configuracoes', { cookie })
  assert.equal(lista.status, 200)
  const itens = lista.json.grupos.flatMap((g: { itens: unknown[] }) => g.itens) as { chave: string; valor: unknown; padrao: unknown; personalizado: boolean }[]
  assert.ok(itens.length >= 20)
  assert.ok(itens.every((i) => i.personalizado === false || i.chave === 'pacotes_pagos_disponiveis'))
  assert.ok(lista.json.grupos.map((g: { nome: string }) => g.nome).includes('Limites de requisição'))

  const ruim = await config(cookie, { captura_max_horas: 5, foto_max_kb: 5, inexistente: 1, poses_padrao: 7 })
  assert.equal(ruim.status, 400)
  assert.ok(ruim.json.erros.foto_max_kb && ruim.json.erros.inexistente && ruim.json.erros.poses_padrao === undefined || ruim.json.erros.foto_max_kb)
  const aindaPadrao = (await chamar('GET', '/api/admin/configuracoes', { cookie })).json.grupos.flatMap((g: { itens: { chave: string; valor: unknown }[] }) => g.itens)
  assert.equal(aindaPadrao.find((i: { chave: string }) => i.chave === 'captura_max_horas').valor, 48) // nada foi aplicado

  assert.equal((await config(cookie, { poses_validas: [12, 36] })).json.erros.poses_padrao, 'Precisa estar entre as opções de fotos.') // regra entre chaves
  assert.equal((await config(cookie, { miniatura_max_kb: 4000 })).status, 400)
  assert.equal((await chamar('PATCH', '/api/admin/configuracoes', { cookie, corpo: {} })).status, 400)

  assert.equal((await config(cookie, { captura_max_horas: 12 })).status, 200)
  const depois = (await chamar('GET', '/api/admin/configuracoes', { cookie })).json.grupos.flatMap((g: { itens: { chave: string; valor: unknown; personalizado: boolean }[] }) => g.itens).find((i: { chave: string }) => i.chave === 'captura_max_horas')
  assert.equal(depois.valor, 12)
  assert.equal(depois.personalizado, true)
  assert.equal((await config(cookie, { captura_max_horas: null })).status, 200) // volta ao padrão
  assert.equal((await servicos!.config.valores()).captura_max_horas, 48)

  const aud = await chamar('GET', '/api/admin/auditoria?limite=100', { cookie })
  const acoes = aud.json.registros.map((r: { acao: string; alvo: string | null }) => `${r.acao}:${r.alvo}`)
  assert.ok(acoes.includes('config.restaurar:captura_max_horas'))
  assert.ok(acoes.includes('config.alterar:captura_max_horas'))
  const registro = aud.json.registros.find((r: { acao: string; alvo: string }) => r.acao === 'config.alterar' && r.alvo === 'captura_max_horas')
  assert.deepEqual([registro.antes, registro.depois, registro.usuario], [48, 12, 'raziel'])
})

test('a configuração vale de verdade: limite de captura, criação pausada, tamanho de foto e limites de requisição', opcoes, async () => {
  const cookie = await adminLiberado('raziel')
  const criar = (extra: Record<string, unknown> = {}, ip = '20.0.0.1') =>
    chamar('POST', '/api/eventos', { corpo: { nome: 'Festa', captura_inicio: h(1), captura_fim: h(4), ...extra }, ip })

  // Limite de captura vira 2 h: 3 h passa a ser recusado, com o número na mensagem.
  await config(cookie, { captura_max_horas: 2 })
  const longo = await criar()
  assert.equal(longo.status, 400)
  assert.equal(longo.json.erro, 'periodo_longo')
  assert.match(longo.json.mensagem, /2 horas/)
  await config(cookie, { captura_max_horas: null })
  assert.equal((await criar()).status, 201)

  // Opções de poses e padrão.
  await config(cookie, { poses_validas: [6, 10], poses_padrao: 10 })
  const poses = await criar({ poses_por_convidado: 24 })
  assert.equal(poses.status, 400)
  assert.match(poses.json.mensagem, /6, 10/)
  assert.equal((await criar()).json.evento.poses_por_convidado, 10) // o padrão novo, limitado pelo pacote teste (12)
  await config(cookie, { poses_validas: null, poses_padrao: null })

  // Criação pausada: eventos novos 503, o resto segue.
  await config(cookie, { criacao_aberta: false })
  const pausada = await criar()
  assert.equal(pausada.status, 503)
  assert.equal(pausada.json.erro, 'criacao_pausada')
  assert.equal((await chamar('GET', '/api/pacotes')).status, 200)
  await config(cookie, { criacao_aberta: true })
  assert.equal((await criar()).status, 201)

  // Limite de criar evento por IP e o botão geral dos limites.
  await config(cookie, { rl_criar_evento_hora: 2 })
  assert.equal((await criar({}, '30.0.0.1')).status, 201)
  assert.equal((await criar({}, '30.0.0.1')).status, 201)
  assert.equal((await criar({}, '30.0.0.1')).status, 429)
  assert.equal((await criar({}, '30.0.0.2')).status, 201) // outro IP
  await config(cookie, { rl_ativo: false })
  for (let i = 0; i < 4; i++) assert.equal((await criar({}, '30.0.0.1')).status, 201)
  await config(cookie, { rl_ativo: null, rl_criar_evento_hora: null })

  // Tamanho máximo da foto.
  const ev = await chamar('POST', '/api/eventos', { corpo: { nome: 'Fotos', captura_inicio: h(-1), captura_fim: h(5) }, ip: '40.0.0.1' })
  const codigo = ev.json.evento.codigo as string
  const entrou = await chamar('POST', `/api/eventos/${codigo}/entrar`, { corpo: {}, ip: '40.0.0.1' })
  const token = entrou.json.convidado_token as string
  const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, ...new Array(300 * 1024).fill(7)])
  const enviar = () => chamar('PUT', `/api/eventos/${codigo}/fotos/${randomUUID()}`, { bruto: jpeg, cab: { 'x-convidado-token': token }, ip: '40.0.0.1' })
  assert.equal((await enviar()).status, 201)
  await config(cookie, { foto_max_kb: 256, miniatura_max_kb: 128 })
  const grande = await enviar()
  assert.equal(grande.status, 413)
  assert.match(grande.json.mensagem, /256 KB/)
  await config(cookie, { foto_max_kb: null, miniatura_max_kb: null })
  assert.equal((await enviar()).status, 201)
})

test('GET /api/config só mostra o que o front pode ver e acompanha o admin', opcoes, async () => {
  const cookie = await adminLiberado('raziel')
  const pub = await chamar('GET', '/api/config')
  assert.equal(pub.status, 200)
  assert.equal(pub.json.captura_max_horas, 48)
  assert.deepEqual(pub.json.poses_validas, [12, 24, 36])
  assert.equal(pub.json.criacao_aberta, true)
  for (const privada of ['rl_ativo', 'rl_criar_evento_hora', 'rascunho_validade_dias', 'zip_max_gb', 'remocao_arquivo_dias']) {
    assert.equal(pub.json[privada], undefined, `${privada} não pode ser público`)
  }
  assert.ok(Object.keys(pub.json).every((k) => definicaoDe(k)?.publica))
  await config(cookie, { contato_suporte: ' ajuda@mango.test ', foto_qualidade_jpeg: 0.7 })
  const depois = await chamar('GET', '/api/config')
  assert.equal(depois.json.contato_suporte, 'ajuda@mango.test')
  assert.equal(depois.json.foto_qualidade_jpeg, 0.7)
  await config(cookie, { contato_suporte: null, foto_qualidade_jpeg: null })
})

test('pacotes: criar, editar, desativar, proteger o teste e não mexer em evento já criado', opcoes, async () => {
  const cookie = await adminLiberado('raziel')
  await config(cookie, { pacotes_pagos_disponiveis: true })
  const criarEvento = async (pacote: string, ip: string) => {
    const r = await chamar('POST', '/api/eventos', { corpo: { nome: 'E', pacote, captura_inicio: h(1), captura_fim: h(4) }, ip })
    // O relógio do teste anda sozinho; alinha a criação a ele para a limpeza de rascunhos não pegar o evento pago.
    if (r.status === 201) await pool!.query('update eventos set criado_em = $2 where codigo = $1', [r.json.evento.codigo, agora])
    return r
  }

  const lista = await chamar('GET', '/api/admin/pacotes', { cookie })
  assert.deepEqual(lista.json.pacotes.map((p: { id: string }) => p.id), ['teste', 'festa', 'celebracao', 'casamento'])
  assert.equal(lista.json.pacotes[1].preco_centavos, 4900)
  assert.equal(lista.json.pacotes[1].gratis, false)

  // Novo pacote aparece para o público.
  const novo = await chamar('POST', '/api/admin/pacotes', { cookie, corpo: { id: 'vip', nome: 'VIP', convidados: 120, preco_centavos: 14900, retencao_dias: 730, poses_max: 24 } })
  assert.equal(novo.status, 201)
  assert.equal(novo.json.pacote.ordem, 5)
  const publicos = (await chamar('GET', '/api/pacotes')).json.pacotes
  const vip = publicos.find((p: { id: string }) => p.id === 'vip')
  assert.deepEqual([vip.convidados, vip.preco_centavos, vip.retencao_dias, vip.poses_max, vip.poses_opcoes], [120, 14900, 730, 24, [12, 24]])
  const evVip = await criarEvento('vip', '50.0.0.1')
  assert.equal(evVip.status, 201)
  assert.equal(evVip.json.evento.limite_convidados, 120)
  assert.equal(evVip.json.evento.limite_fotos, 120 * 24)

  // Validação e duplicado.
  const ruim = await chamar('POST', '/api/admin/pacotes', { cookie, corpo: { id: 'Ruim Id', nome: '', convidados: 0, preco_centavos: -5, retencao_dias: 0, poses_max: 99 } })
  assert.equal(ruim.status, 400)
  assert.ok(ruim.json.erros.id && ruim.json.erros.nome && ruim.json.erros.convidados && ruim.json.erros.preco_centavos && ruim.json.erros.retencao_dias && ruim.json.erros.poses_max)
  assert.equal((await chamar('POST', '/api/admin/pacotes', { cookie, corpo: { id: 'vip', nome: 'X', convidados: 1, preco_centavos: 0, retencao_dias: 1, poses_max: 12 } })).status, 409)

  // Editar não muda o evento já criado (convidados e retenção ficam gravados nele).
  const festaAntes = await criarEvento('festa', '50.0.0.2')
  assert.equal(festaAntes.json.evento.limite_convidados, 30)
  const edit = await chamar('PATCH', '/api/admin/pacotes/festa', { cookie, corpo: { convidados: 99, preco_centavos: 5900, retencao_dias: 10, nome: ' Festa Plus ' } })
  assert.equal(edit.status, 200)
  assert.equal(edit.json.pacote.nome, 'Festa Plus')
  const ainda = await chamar('GET', '/api/anfitriao/evento', { cab: { authorization: `Bearer ${festaAntes.json.anfitriao_token}` } })
  assert.equal(ainda.json.evento.limite_convidados, 30)
  const festaDepois = await criarEvento('festa', '50.0.0.3')
  assert.equal(festaDepois.json.evento.limite_convidados, 99)
  const retencoes = (await pool!.query('select codigo, retencao_dias from eventos where codigo = any($1)', [[festaAntes.json.evento.codigo, festaDepois.json.evento.codigo]])).rows
  const dias = Object.fromEntries(retencoes.map((r) => [r.codigo, r.retencao_dias]))
  assert.equal(dias[festaAntes.json.evento.codigo], 365)
  assert.equal(dias[festaDepois.json.evento.codigo], 10)
  await chamar('PATCH', '/api/admin/pacotes/festa', { cookie, corpo: { convidados: 30, preco_centavos: 4900, retencao_dias: 365, nome: 'Festa' } })

  // Desativar tira do público e bloqueia criação; quem já tem evento segue.
  assert.equal((await chamar('PATCH', '/api/admin/pacotes/vip', { cookie, corpo: { ativo: false } })).status, 200)
  assert.equal((await chamar('GET', '/api/pacotes')).json.pacotes.some((p: { id: string }) => p.id === 'vip'), false)
  const recusado = await criarEvento('vip', '50.0.0.4')
  assert.equal(recusado.status, 409)
  assert.equal(recusado.json.erro, 'pacote_indisponivel')
  assert.equal((await chamar('GET', '/api/anfitriao/evento', { cab: { authorization: `Bearer ${evVip.json.anfitriao_token}` } })).status, 200)
  assert.equal((await chamar('GET', '/api/admin/pacotes', { cookie })).json.pacotes.find((p: { id: string }) => p.id === 'vip').eventos, 1) // contagem de uso

  // O pacote de teste é a porta de entrada: não desativa nem cobra. Id inexistente = 404.
  assert.equal((await chamar('PATCH', '/api/admin/pacotes/teste', { cookie, corpo: { ativo: false } })).json.erros.ativo, 'O pacote de teste não pode ser desativado.')
  assert.ok((await chamar('PATCH', '/api/admin/pacotes/teste', { cookie, corpo: { preco_centavos: 100 } })).json.erros.preco_centavos)
  assert.equal((await chamar('PATCH', '/api/admin/pacotes/nao-existe', { cookie, corpo: { nome: 'x' } })).status, 404)
  assert.ok((await chamar('PATCH', '/api/admin/pacotes/festa', { cookie, corpo: { id: 'outro' } })).json.erros.id)
  assert.equal((await chamar('PATCH', '/api/admin/pacotes/festa', { cookie, corpo: {} })).status, 400)
  await config(cookie, { pacotes_pagos_disponiveis: null })
})

test('pacote pago só com o pagamento ligado (padrão: desligado)', opcoes, async () => {
  const cookie = await adminLiberado('raziel')
  await config(cookie, { pacotes_pagos_disponiveis: null })
  const r = await chamar('POST', '/api/eventos', { corpo: { nome: 'E', pacote: 'festa', captura_inicio: h(1), captura_fim: h(4) }, ip: '60.0.0.1' })
  assert.equal(r.status, 409)
  assert.equal(r.json.erro, 'pagamento_indisponivel')
  assert.equal((await chamar('POST', '/api/eventos', { corpo: { nome: 'E', captura_inicio: h(1), captura_fim: h(4) }, ip: '60.0.0.1' })).status, 201) // teste grátis segue
})

test('retenção gravada no evento vale na revelação, mesmo se o pacote mudar depois', opcoes, async () => {
  const cookie = await adminLiberado('raziel')
  await chamar('PATCH', '/api/admin/pacotes/teste', { cookie, corpo: { retencao_dias: 45 } })
  const ev = await chamar('POST', '/api/eventos', { corpo: { nome: 'R', captura_inicio: h(-1), captura_fim: h(2), revelacao_manual: true }, ip: '70.0.0.1' })
  const auth = { authorization: `Bearer ${ev.json.anfitriao_token}` }
  await chamar('PATCH', '/api/admin/pacotes/teste', { cookie, corpo: { retencao_dias: 7 } }) // muda depois de criado
  agora = new Date(agora.getTime() + 3 * 3600_000)
  await chamar('GET', `/api/eventos/${ev.json.evento.codigo}`) // o relógio encerra a captura
  const rev = await chamar('POST', '/api/anfitriao/evento/revelar', { cab: auth })
  const dias = Math.round((new Date(rev.json.evento.expira_em).getTime() - new Date(rev.json.evento.revelado_em).getTime()) / 86_400_000)
  assert.equal(dias, 45)
  agora = new Date(agora.getTime() - 3 * 3600_000)
  await chamar('PATCH', '/api/admin/pacotes/teste', { cookie, corpo: { retencao_dias: 30 } })
})

test('resumo, administradores e redefinição de senha entre admins', opcoes, async () => {
  const raziel = await adminLiberado('raziel')
  const resumo = await chamar('GET', '/api/admin/resumo', { cookie: raziel })
  assert.equal(resumo.status, 200)
  assert.equal(typeof resumo.json.eventos_por_estado, 'object')
  assert.equal(typeof resumo.json.eventos_ultimos_7_dias, 'number')
  assert.ok(Object.values(resumo.json.eventos_por_estado).length >= 1)
  for (const k of ['convidados', 'fotos', 'fotos_ultimas_24_horas', 'armazenamento_bytes', 'pedidos_de_remocao_pendentes']) assert.equal(typeof resumo.json[k], 'number')

  const eventos = await chamar('GET', '/api/admin/eventos?limite=5', { cookie: raziel })
  assert.equal(eventos.status, 200)
  assert.ok(eventos.json.total >= 1 && eventos.json.eventos.length <= 5)
  for (const k of ['convidados', 'fotos']) assert.equal(typeof eventos.json.eventos[0][k], 'number')
  assert.equal((await chamar('GET', '/api/admin/eventos?busca=%25%25nao-existe-%25', { cookie: raziel })).json.total, 0) // % e _ não viram curinga
  assert.equal((await chamar('GET', '/api/admin/eventos?estado=cancelado&pacote=inexistente', { cookie: raziel })).json.total, 0)
  assert.equal((await chamar('GET', '/api/admin/eventos')).status, 401)

  const pagamentos = await chamar('GET', '/api/admin/pagamentos', { cookie: raziel })
  assert.equal(pagamentos.status, 200)
  assert.equal(typeof pagamentos.json.receita_centavos, 'number')
  assert.ok(Array.isArray(pagamentos.json.pagamentos))
  assert.equal((await chamar('GET', '/api/admin/pagamentos')).status, 401)

  const csvEventos = await app!.request('/api/admin/eventos?formato=csv', { headers: { cookie: raziel } })
  assert.equal(csvEventos.status, 200)
  assert.match(csvEventos.headers.get('content-type') ?? '', /^text\/csv/)
  assert.match((await csvEventos.text()).replace('\ufeff', ''), /^id,codigo,nome,anfitriao_email,estado,pacote,/)
  assert.equal((await app!.request('/api/admin/pagamentos?formato=csv', { headers: { cookie: raziel } })).status, 200)

  const ordenados = await chamar('GET', '/api/admin/eventos?ordem=armazenamento&de=2020-01-01&ate=2099-12-31', { cookie: raziel })
  assert.equal(ordenados.status, 200)
  assert.equal(typeof ordenados.json.eventos[0].armazenamento_bytes, 'number')
  assert.equal((await chamar('GET', '/api/admin/eventos?de=ontem', { cookie: raziel })).json.erro, 'periodo_invalido')
  assert.equal((await chamar('GET', '/api/admin/eventos?ordem=drop%20table', { cookie: raziel })).status, 200) // ordem desconhecida cai no padrão

  const idEvento = eventos.json.eventos[0].id as string
  const detalhe = await chamar('GET', `/api/admin/eventos/${idEvento}`, { cookie: raziel })
  assert.equal(detalhe.status, 200)
  assert.equal(detalhe.json.evento.id, idEvento)
  assert.equal(typeof detalhe.json.fotos.total, 'number')
  assert.ok(Array.isArray(detalhe.json.convidados) && Array.isArray(detalhe.json.pagamentos) && Array.isArray(detalhe.json.pedidos_de_remocao))
  assert.equal((await chamar('GET', `/api/admin/eventos/${randomUUID()}`, { cookie: raziel })).status, 404)
  assert.equal((await chamar('GET', '/api/admin/eventos/x', { cookie: raziel })).status, 400)
  assert.equal((await chamar('GET', `/api/admin/eventos/${idEvento}`)).status, 401)

  const analise = await chamar('GET', '/api/admin/analise?dias=30', { cookie: raziel })
  assert.equal(analise.status, 200)
  for (const k of ['eventos', 'convidados', 'fotos', 'receita_centavos', 'ticket_medio_centavos']) {
    assert.equal(typeof analise.json.periodo[k].atual, 'number')
    assert.equal(typeof analise.json.periodo[k].anterior, 'number')
  }
  assert.ok(analise.json.funil.criados >= analise.json.funil.ativados)
  assert.ok(Array.isArray(analise.json.pacotes) && analise.json.pacotes.length >= 1)
  assert.ok(analise.json.maiores_eventos.length <= 10)
  assert.equal((await chamar('GET', '/api/admin/analise')).status, 401)

  const filtrada = await chamar('GET', '/api/admin/auditoria?usuario=ninguem', { cookie: raziel })
  assert.equal(filtrada.status, 200)
  assert.equal(filtrada.json.total, 0)

  const crescimento = await chamar('GET', '/api/admin/crescimento?dias=7', { cookie: raziel })
  assert.equal(crescimento.status, 200)
  assert.equal(crescimento.json.serie.length, 7)
  assert.equal(typeof crescimento.json.totais.fotos, 'number')
  assert.equal(typeof crescimento.json.totais.receita_centavos, 'number')
  assert.equal((await chamar('GET', '/api/admin/crescimento')).status, 401)

  const moderacao = await chamar('GET', '/api/admin/moderacao', { cookie: raziel })
  assert.equal(moderacao.status, 200)
  assert.ok(Array.isArray(moderacao.json.pendentes))
  assert.equal(typeof moderacao.json.resolvidos.removida, 'number')

  const anfitrioes = await chamar('GET', '/api/admin/anfitrioes', { cookie: raziel })
  assert.equal(anfitrioes.status, 200)
  assert.ok(anfitrioes.json.total >= 1)
  assert.equal(typeof anfitrioes.json.anfitrioes[0].pago_centavos, 'number')
  assert.equal((await chamar('GET', '/api/admin/anfitrioes?busca=%25%25nada', { cookie: raziel })).json.total, 0)

  const saude = await chamar('GET', '/api/admin/saude', { cookie: raziel })
  assert.equal(saude.status, 200)
  assert.equal(saude.json.banco.ok, true)
  assert.equal(typeof saude.json.fotos_aguardando_limpeza, 'number')
  assert.equal((await chamar('GET', '/api/admin/saude')).status, 401)

  const lista = await chamar('GET', '/api/admin/administradores', { cookie: raziel })
  assert.deepEqual(lista.json.administradores.map((a: { usuario: string }) => a.usuario), ['lucas', 'raziel'])
  assert.ok(lista.json.administradores.every((a: { senha_hash?: string }) => a.senha_hash === undefined)) // nunca sai o hash
  const lucas = lista.json.administradores.find((a: { usuario: string }) => a.usuario === 'lucas')
  const eu = lista.json.administradores.find((a: { usuario: string }) => a.usuario === 'raziel')

  assert.equal((await chamar('POST', `/api/admin/administradores/${eu.id}/redefinir-senha`, { cookie: raziel })).json.erro, 'redefinir_a_si_mesmo')
  assert.equal((await chamar('POST', `/api/admin/administradores/${randomUUID()}/redefinir-senha`, { cookie: raziel })).status, 404)
  assert.equal((await chamar('POST', '/api/admin/administradores/x/redefinir-senha', { cookie: raziel })).status, 400)
  assert.equal((await chamar('POST', `/api/admin/administradores/${lucas.id}/redefinir-senha`)).status, 401)

  const sessaoDoLucas = await entrar('lucas', 'Nova-Senha-2026')
  const redef = await chamar('POST', `/api/admin/administradores/${lucas.id}/redefinir-senha`, { cookie: raziel })
  assert.equal(redef.status, 200)
  const temporaria = redef.json.senha_temporaria as string
  assert.match(temporaria, /^[A-Za-z0-9]{14}$/)
  assert.equal((await chamar('GET', '/api/admin/eu', { cookie: sessaoDoLucas.cookie })).status, 401) // derruba as sessões dele
  assert.equal((await entrar('lucas', 'Nova-Senha-2026')).status, 401)
  const comTemp = await entrar('lucas', temporaria)
  assert.equal(comTemp.status, 200)
  assert.equal(comTemp.json.admin.trocar_senha, true) // obriga trocar de novo
  assert.equal((await chamar('GET', '/api/admin/pacotes', { cookie: comTemp.cookie })).json.erro, 'trocar_senha_obrigatoria')
  await chamar('POST', '/api/admin/trocar-senha', { cookie: comTemp.cookie, corpo: { senha_atual: temporaria, nova_senha: 'Nova-Senha-2026' } })

  const aud = (await chamar('GET', '/api/admin/auditoria?limite=100', { cookie: raziel })).json
  assert.ok(aud.registros.some((r: { acao: string; alvo: string }) => r.acao === 'admin.redefinir_senha' && r.alvo === 'lucas'))
  assert.ok(aud.registros.some((r: { acao: string }) => r.acao === 'admin.trocar_senha'))
  assert.ok(aud.registros.some((r: { acao: string }) => r.acao === 'pacote.criar'))
  assert.ok(aud.total >= aud.registros.length)
})

test('criar os admins é idempotente e nunca mexe em quem já existe', opcoes, async () => {
  const servico = new ServicoAdmin(pool!, () => agora)
  const antes = (await pool!.query("select senha_hash from admins where usuario = 'raziel'")).rows[0].senha_hash
  const criados = await servico.garantirAdmins([{ usuario: 'raziel', nome: 'Raziel' }, { usuario: 'novo.admin', nome: 'Novo' }], 'Outra-Inicial-2026')
  assert.deepEqual(criados, ['novo.admin'])
  assert.equal((await pool!.query("select senha_hash from admins where usuario = 'raziel'")).rows[0].senha_hash, antes)
  assert.equal((await pool!.query("select trocar_senha from admins where usuario = 'novo.admin'")).rows[0].trocar_senha, true)
})

test('valor inválido guardado no banco cai no padrão sem derrubar nada', opcoes, async () => {
  await pool!.query("insert into configuracoes (chave, valor) values ('captura_max_horas', '\"lixo\"'), ('chave_antiga', '1') on conflict (chave) do update set valor = excluded.valor")
  servicos!.config.invalidar()
  const aviso = console.warn
  console.warn = () => {}
  const v = await servicos!.config.valores()
  console.warn = aviso
  assert.equal(v.captura_max_horas, 48)
  await pool!.query("delete from configuracoes where chave in ('captura_max_horas', 'chave_antiga')")
  servicos!.config.invalidar()
})

test('onda 2: ao vivo, retenção, armazenamento, estender a câmera e moderação em lote', opcoes, async () => {
  assert.ok(pool)
  const raziel = await adminLiberado()
  const ev = await pool.query<{ id: string }>('select id::text from eventos where excluido_em is null order by criado_em limit 1')
  assert.ok(ev.rows[0], 'os testes anteriores criam eventos')
  const id = ev.rows[0].id
  await pool.query(`update eventos set estado = 'captura_aberta', captura_fim = $2, revelacao_em = $2 where id = $1`, [id, new Date(agora.getTime() + 3600_000)])
  const conv = await pool.query<{ id: string }>(`insert into convidados (evento_id, token_hash) values ($1, $2) returning id::text`, [id, randomUUID()])
  const fotoIds: string[] = []
  for (let i = 0; i < 2; i++) {
    const f = await pool.query<{ id: string }>(
      `insert into fotos (evento_id, convidado_id, chave_storage, tipo_mime, tamanho_bytes, criado_em) values ($1,$2,$3,'image/jpeg',1000,$4) returning id::text`,
      [id, conv.rows[0].id, randomUUID(), agora],
    )
    fotoIds.push(f.rows[0].id)
  }

  const vivo = await chamar('GET', '/api/admin/ao-vivo', { cookie: raziel })
  assert.equal(vivo.status, 200)
  const meu = vivo.json.eventos.find((e: { id: string }) => e.id === id)
  assert.ok(meu && meu.fotos_ultima_hora >= 2)
  assert.equal((await chamar('GET', '/api/admin/ao-vivo')).status, 401)

  const retencao = await chamar('GET', '/api/admin/retencao', { cookie: raziel })
  assert.equal(retencao.status, 200)
  assert.ok(retencao.json.anfitrioes >= 1 && retencao.json.recorrentes <= retencao.json.anfitrioes)

  const arm = await chamar('GET', '/api/admin/armazenamento', { cookie: raziel })
  assert.equal(arm.status, 200)
  assert.ok(arm.json.total_bytes >= 2000 && arm.json.bytes_por_evento > 0)
  assert.ok(Array.isArray(arm.json.semanas))

  const antes = new Date((await pool.query<{ captura_fim: Date }>('select captura_fim from eventos where id = $1', [id])).rows[0].captura_fim)
  assert.equal((await chamar('POST', `/api/admin/eventos/${id}/estender-camera`, { cookie: raziel, corpo: { minutos: 0 } })).status, 400)
  assert.equal((await chamar('POST', `/api/admin/eventos/${randomUUID()}/estender-camera`, { cookie: raziel, corpo: { minutos: 30 } })).status, 404)
  const ext = await chamar('POST', `/api/admin/eventos/${id}/estender-camera`, { cookie: raziel, corpo: { minutos: 30 } })
  assert.equal(ext.status, 200, JSON.stringify(ext.json))
  assert.equal(new Date(ext.json.captura_fim).getTime(), antes.getTime() + 30 * 60_000)
  assert.equal(new Date(ext.json.revelacao_em).getTime(), new Date(ext.json.captura_fim).getTime()) // revelação não fica antes do fim

  await pool.query(`insert into pedidos_remocao (evento_id, foto_id, solicitante) values ($1,$2,'ip:a'), ($1,$3,'ip:b')`, [id, fotoIds[0], fotoIds[1]])
  const pend = await chamar('GET', '/api/admin/moderacao', { cookie: raziel })
  const ids = pend.json.pendentes.filter((p: { evento_id: string }) => p.evento_id === id).map((p: { id: string }) => p.id)
  assert.equal(ids.length, 2)
  assert.equal((await chamar('POST', '/api/admin/moderacao/resolver', { cookie: raziel, corpo: { ids, resolucao: 'apagar' } })).status, 400)
  const lote = await chamar('POST', '/api/admin/moderacao/resolver', { cookie: raziel, corpo: { ids, resolucao: 'removida' } })
  assert.equal(lote.status, 200)
  assert.equal(lote.json.resolvidos, 2)
  const removidas = await pool.query('select count(*)::int as n from fotos where id = any($1::uuid[]) and removida_em is not null', [fotoIds])
  assert.equal(removidas.rows[0].n, 2)
  assert.equal((await chamar('POST', '/api/admin/moderacao/resolver', { cookie: raziel, corpo: { ids, resolucao: 'removida' } })).json.resolvidos, 0) // repetir não faz nada
  const aud = await chamar('GET', '/api/admin/auditoria?acao=moderacao.resolver_lote', { cookie: raziel })
  assert.ok(aud.json.total >= 1)
})
