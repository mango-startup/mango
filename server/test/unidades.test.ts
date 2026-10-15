import assert from 'node:assert/strict'
import { test } from 'node:test'
import { podeTransicionar } from '../src/estados.ts'
import { PACOTES, ehPacote } from '../src/pacotes.ts'
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

test('pacotes: só o teste é grátis e "grande" não é criável', () => {
  assert.ok(PACOTES.teste.gratis)
  assert.ok(!PACOTES.festa.gratis)
  assert.ok(ehPacote('casamento'))
  assert.ok(!ehPacote('grande'))
  assert.ok(!ehPacote('constructor'))
})
