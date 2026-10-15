import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { StorageDisco } from '../src/storage/disco.ts'

test('salvar, ler e apagar', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'mango-'))
  try {
    const s = new StorageDisco(dir)
    await s.salvar('evt1/foto.jpg', new Uint8Array([1, 2, 3]))
    assert.deepEqual([...(await s.ler('evt1/foto.jpg'))!], [1, 2, 3])
    await s.apagar('evt1/foto.jpg')
    assert.equal(await s.ler('evt1/foto.jpg'), null)
    await s.apagar('evt1/foto.jpg')
    await assert.rejects(s.salvar('../fora.jpg', new Uint8Array([1])))
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})
