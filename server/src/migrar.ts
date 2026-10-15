import { lerConfig } from './config.ts'
import { criarPool } from './db.ts'
import { migrar } from './migracoes.ts'

const pool = criarPool(lerConfig().databaseUrl)
try {
  const aplicadas = await migrar(pool)
  console.log(aplicadas.length ? `Migrações aplicadas: ${aplicadas.join(', ')}` : 'Banco já está atualizado')
} finally {
  await pool.end()
}
