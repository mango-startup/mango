import assert from 'node:assert/strict'
import { test } from 'node:test'
import { PARAMS_PADRAO, calcularPreco, validarParams } from '../src/preco.ts'

// Os mesmos valores de referência do simulador do admin (src/lib/simuladorPreco.ts): se um mudar, o outro também.
test('preço por participante: valores de referência', () => {
  const casos: [number, (number | 'ilimitado')[], number[]][] = [
    [5, [10, 15, 24, 36, 'ilimitado'], [0, 1490, 1490, 1590, 2290]], // com mais fotos que o teste, 5 participantes já pagam
    [6, [10, 15, 24, 36, 'ilimitado'], [1490, 1490, 1490, 1890, 2790]],
    [20, [10, 15, 24, 36, 'ilimitado'], [3090, 3690, 4690, 6190, 9090]],
    [30, [10, 15, 24, 36, 'ilimitado'], [4590, 5490, 7090, 9190, 13590]],
    [200, [10, 15, 24, 36, 'ilimitado'], [23590, 29590, 40390, 54790, 90090]],
  ]
  for (const [n, fotos, esperado] of casos) {
    assert.deepEqual(fotos.map((f) => calcularPreco(n, PARAMS_PADRAO, f)), esperado, `${n} participantes`)
  }
})

test('sem "todos pagam", só o excedente do grátis paga', () => {
  assert.equal(calcularPreco(6, { ...PARAMS_PADRAO, cobrarTodos: false, arredondar90: false, pisoCentavos: 0 }, 10), 150)
})

test('validarParams aceita os valores propostos e recusa degraus fora de ordem', () => {
  assert.equal(validarParams(PARAMS_PADRAO).ok, true)
  const ruim = validarParams({ ...PARAMS_PADRAO, degraus: [{ ate: 100, centavos: 150 }, { ate: 50, centavos: 120 }, { ate: null, centavos: 100 }] })
  assert.equal(ruim.ok, false)
  assert.equal(validarParams({ ...PARAMS_PADRAO, pisoCentavos: 'x' }).ok, false)
  assert.equal(validarParams(null).ok, false)
})
