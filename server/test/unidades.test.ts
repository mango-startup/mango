import assert from 'node:assert/strict'
import { test } from 'node:test'
import { conferirSenha, hashSenha, senhaTemporaria, validarSenhaNova } from '../src/admin/senha.ts'
import { CONFIG_PADRAO, DEFINICOES, definicaoDe, validarConjunto, validarValor } from '../src/configuracao.ts'
import { podeTransicionar } from '../src/estados.ts'
import { validarPacote } from '../src/pacotes.ts'
import { gerarCodigo, gerarToken, hashToken } from '../src/tokens.ts'

test('código tem 8 caracteres sem ambíguos e não se repete em 1000 sorteios', () => {
  const vistos = new Set<string>()
  for (let i = 0; i < 1000; i++) {
    const c = gerarCodigo()
    assert.match(c, /^[A-HJKMNP-Z2-9]{8}$/)
    vistos.add(c)
  }
  assert.equal(vistos.size, 1000)
})

test('token é aleatório e o hash é estável', () => {
  assert.notEqual(gerarToken(), gerarToken())
  assert.equal(hashToken('abc'), hashToken('abc'))
  assert.notEqual(hashToken('abc'), hashToken('abd'))
})

test('transições de estado seguem o plano', () => {
  assert.ok(podeTransicionar('pronto', 'captura_aberta'))
  assert.ok(podeTransicionar('captura_aberta', 'captura_encerrada'))
  assert.ok(podeTransicionar('captura_encerrada', 'revelado'))
  assert.ok(!podeTransicionar('captura_aberta', 'revelado'))
  assert.ok(!podeTransicionar('revelado', 'captura_aberta'))
  assert.ok(!podeTransicionar('expirado', 'revelado'))
})

test('toda configuração tem padrão válido dentro da própria faixa e descrição', () => {
  assert.ok(DEFINICOES.length >= 20)
  const chaves = new Set<string>()
  for (const d of DEFINICOES) {
    assert.ok(!chaves.has(d.chave), `chave repetida ${d.chave}`)
    chaves.add(d.chave)
    assert.ok(d.rotulo && d.descricao && d.grupo, `${d.chave} sem texto`)
    const r = validarValor(d, d.padrao)
    assert.ok(r.ok, `${d.chave}: o padrão não passa na própria validação`)
  }
  assert.equal(validarConjunto(CONFIG_PADRAO), null)
})

test('validarValor: tipo, faixa e normalização', () => {
  const horas = definicaoDe('captura_max_horas')!
  assert.deepEqual(validarValor(horas, 24), { ok: true, valor: 24 })
  assert.equal(validarValor(horas, 0).ok, false)
  assert.equal(validarValor(horas, 169).ok, false)
  assert.equal(validarValor(horas, 1.5).ok, false)
  assert.equal(validarValor(horas, '24').ok, false)
  assert.equal(validarValor(definicaoDe('criacao_aberta')!, 'sim').ok, false)
  assert.deepEqual(validarValor(definicaoDe('foto_qualidade_jpeg')!, 0.9), { ok: true, valor: 0.9 })
  assert.equal(validarValor(definicaoDe('foto_qualidade_jpeg')!, 1.2).ok, false)
  // lista: ordena, tira repetidos e confere cada item
  assert.deepEqual(validarValor(definicaoDe('poses_validas')!, [36, 12, 12, 24]), { ok: true, valor: [12, 24, 36] })
  assert.equal(validarValor(definicaoDe('poses_validas')!, []).ok, false)
  assert.equal(validarValor(definicaoDe('poses_validas')!, [12, 0]).ok, false)
  assert.equal(validarValor(definicaoDe('poses_validas')!, 'a').ok, false)
  assert.deepEqual(validarValor(definicaoDe('contato_suporte')!, '  oi@mango.test  '), { ok: true, valor: 'oi@mango.test' })
})

test('validarConjunto: regras entre chaves', () => {
  assert.deepEqual(validarConjunto({ ...CONFIG_PADRAO, poses_validas: [12, 36], poses_padrao: 24 }), { poses_padrao: 'Precisa estar entre as opções de poses.' })
  assert.ok(validarConjunto({ ...CONFIG_PADRAO, album_pagina_padrao: 100, album_pagina_max: 50 })?.album_pagina_padrao)
  assert.ok(validarConjunto({ ...CONFIG_PADRAO, foto_max_kb: 512, miniatura_max_kb: 1024 })?.miniatura_max_kb)
})

test('validarPacote: criação exige tudo, edição só o que veio', () => {
  const ok = { id: 'x', nome: 'Festa grande', convidados: 50, preco_centavos: 7900, retencao_dias: 365, poses_max: 36 }
  assert.deepEqual(validarPacote(ok, { completo: true, maiorPose: 36 }), {})
  assert.ok(validarPacote({}, { completo: true, maiorPose: 36 }).nome)
  assert.deepEqual(validarPacote({ preco_centavos: 5000 }, { completo: false, maiorPose: 36 }), {})
  assert.ok(validarPacote({ preco_centavos: -1 }, { completo: false, maiorPose: 36 }).preco_centavos)
  assert.ok(validarPacote({ poses_max: 48 }, { completo: false, maiorPose: 36 }).poses_max)
  assert.ok(validarPacote({ convidados: 0 }, { completo: false, maiorPose: 36 }).convidados)
  assert.ok(validarPacote({ nome: '   ' }, { completo: false, maiorPose: 36 }).nome)
  assert.ok(validarPacote({ ativo: 'sim' }, { completo: false, maiorPose: 36 }).ativo)
})

test('senha: hash confere, não repete entre chamadas e a política de senha nova funciona', async () => {
  const a = await hashSenha('Abc12345xyz')
  const b = await hashSenha('Abc12345xyz')
  assert.notEqual(a, b)
  assert.match(a, /^scrypt\$32768\$8\$1\$/)
  assert.equal(await conferirSenha('Abc12345xyz', a), true)
  assert.equal(await conferirSenha('abc12345xyz', a), false)
  assert.equal(await conferirSenha('x', 'lixo'), false)
  assert.ok(validarSenhaNova('curta1', { usuario: 'raziel' }))
  assert.ok(validarSenhaNova('somenteletrasaqui', { usuario: 'raziel' }))
  assert.ok(validarSenhaNova('1234567890123', { usuario: 'raziel' }))
  assert.ok(validarSenhaNova('meu-razielzao-123', { usuario: 'raziel' }))
  assert.ok(validarSenhaNova('Abc12345xyz', { usuario: 'raziel', atual: 'Abc12345xyz' }))
  assert.equal(validarSenhaNova('Outra-senha-2026', { usuario: 'raziel', atual: 'Abc12345xyz' }), null)
  for (let i = 0; i < 50; i++) assert.match(senhaTemporaria(), /^(?=.*[0-9])[A-Za-z0-9]{14}$/)
})
