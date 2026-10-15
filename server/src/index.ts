import { serve } from '@hono/node-server'
import { avancarEstados } from './agendador.ts'
import { criarApp } from './app.ts'
import { limparArquivos } from './limpeza.ts'
import { lerConfig } from './config.ts'
import { criarPool } from './db.ts'
import { migrar } from './migracoes.ts'
import { StorageDisco } from './storage/disco.ts'

const config = lerConfig()
const pool = criarPool(config.databaseUrl)
const storage = new StorageDisco(config.storageDir)

const aplicadas = await migrar(pool)
if (aplicadas.length) console.log(`Migrações aplicadas: ${aplicadas.join(', ')}`)

// Relógio dos eventos: início, fim, revelação, expiração e limpeza de arquivos vencidos (a cada minuto).
const agendador = setInterval(() => {
  avancarEstados(pool)
    .then(() => limparArquivos(pool, storage))
    .catch((erro) => console.error('Falha no agendador:', erro))
}, 60_000)

const servidor = serve({ fetch: criarApp(pool, storage, () => new Date(), process.env.RATE_LIMIT === 'off' ? null : undefined).fetch, port: config.porta }, (info) => {
  console.log(`Mango API ouvindo na porta ${info.port}`)
})

function encerrar() {
  clearInterval(agendador)
  servidor.close(() => void pool.end().then(() => process.exit(0)))
}
process.on('SIGTERM', encerrar)
process.on('SIGINT', encerrar)
