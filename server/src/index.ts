import { serve } from '@hono/node-server'
import { criarApp } from './app.ts'
import { lerConfig } from './config.ts'
import { criarPool } from './db.ts'
import { migrar } from './migracoes.ts'

const config = lerConfig()
const pool = criarPool(config.databaseUrl)

const aplicadas = await migrar(pool)
if (aplicadas.length) console.log(`Migrações aplicadas: ${aplicadas.join(', ')}`)

const servidor = serve({ fetch: criarApp(pool).fetch, port: config.porta }, (info) => {
  console.log(`Mango API ouvindo na porta ${info.port}`)
})

function encerrar() {
  servidor.close(() => void pool.end().then(() => process.exit(0)))
}
process.on('SIGTERM', encerrar)
process.on('SIGINT', encerrar)
