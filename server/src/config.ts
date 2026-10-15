export interface Config {
  porta: number
  databaseUrl: string
  storageDir: string
}

export function lerConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const databaseUrl = env.DATABASE_URL
  if (!databaseUrl) throw new Error('Variável DATABASE_URL é obrigatória')
  const porta = Number(env.PORT ?? 3000)
  if (!Number.isInteger(porta) || porta <= 0) throw new Error('PORT inválida')
  return {
    porta,
    databaseUrl,
    storageDir: env.STORAGE_DIR ?? './dados/fotos',
  }
}
