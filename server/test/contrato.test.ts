import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { test } from 'node:test'
import { criarApp } from '../src/app.ts'

// Garante que openapi.json e as rotas reais andam juntos: rota nova sem documentação (ou documentação
// de rota que não existe) quebra este teste. Não precisa de banco.
const spec = JSON.parse(readFileSync(path.resolve(import.meta.dirname, '../openapi.json'), 'utf8'))
const app = criarApp({} as never, {} as never)

const METODOS = ['get', 'put', 'post', 'patch', 'delete']

function rotasReais(): Set<string> {
  const rotas = new Set<string>()
  for (const r of app.routes) {
    if (r.method === 'ALL') continue // middlewares (limites)
    rotas.add(`${r.method} ${r.path.replace(/:(\w+)/g, '{$1}')}`)
  }
  return rotas
}

function rotasDocumentadas(): Set<string> {
  const rotas = new Set<string>()
  for (const [caminho, operacoes] of Object.entries<Record<string, unknown>>(spec.paths)) {
    for (const metodo of Object.keys(operacoes)) if (METODOS.includes(metodo)) rotas.add(`${metodo.toUpperCase()} ${caminho}`)
  }
  return rotas
}

test('toda rota do servidor está no openapi.json e vice-versa', () => {
  const reais = rotasReais()
  const doc = rotasDocumentadas()
  assert.deepEqual([...reais].filter((r) => !doc.has(r)).sort(), [], 'rotas sem documentação')
  assert.deepEqual([...doc].filter((r) => !reais.has(r)).sort(), [], 'documentação de rotas que não existem')
  assert.ok(reais.size >= 20)
})

test('openapi.json é consistente: refs existem, parâmetros de caminho declarados, respostas presentes', () => {
  const texto = JSON.stringify(spec)
  for (const [, nome] of texto.matchAll(/#\/components\/schemas\/([A-Za-z]+)/g)) {
    assert.ok(spec.components.schemas[nome], `schema ${nome} não existe`)
  }
  for (const [caminho, operacoes] of Object.entries<Record<string, { parameters?: { name: string; in: string }[]; responses?: object; summary?: string }>>(spec.paths)) {
    const esperados = [...caminho.matchAll(/\{(\w+)\}/g)].map((m) => m[1])
    for (const metodo of Object.keys(operacoes).filter((m) => METODOS.includes(m))) {
      const op = operacoes[metodo]
      const declarados = (op.parameters ?? []).filter((p) => p.in === 'path').map((p) => p.name)
      assert.deepEqual([...declarados].sort(), [...esperados].sort(), `${metodo} ${caminho}: parâmetros de caminho`)
      assert.ok(op.responses && Object.keys(op.responses).length > 0, `${metodo} ${caminho}: sem respostas`)
      assert.ok(op.summary, `${metodo} ${caminho}: sem resumo`)
    }
  }
  for (const esquema of Object.values<{ in?: string }>(spec.components.securitySchemes)) assert.ok(esquema)
})

test('os estados do contrato são os do código', () => {
  assert.equal(spec.components.schemas.Estado.enum.length, 8)
})

test('toda configuração editável está documentada em docs/CONFIGURACOES.md', async () => {
  const { DEFINICOES } = await import('../src/configuracao.ts')
  const doc = readFileSync(path.resolve(import.meta.dirname, '../../docs/CONFIGURACOES.md'), 'utf8')
  const faltando = DEFINICOES.filter((d) => !doc.includes(`\`${d.chave}\``)).map((d) => d.chave)
  assert.deepEqual(faltando, [], 'configurações sem documentação em docs/CONFIGURACOES.md')
})
