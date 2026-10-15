export interface Config {
  porta: number
  databaseUrl: string
  storageDir: string
  /** Admins criados na primeira subida (ADMIN_USUARIOS="raziel:Raziel,lucas:Lucas"). */
  adminUsuarios: { usuario: string; nome: string }[]
  /** Senha inicial deles (ADMIN_SENHA_INICIAL). Só vale até o primeiro login: a troca é obrigatória. Sem ela, nenhum admin é criado. */
  adminSenhaInicial: string | null
}

function lerAdmins(texto: string | undefined): { usuario: string; nome: string }[] {
  return (texto ?? 'raziel:Raziel,lucas:Lucas')
    .split(',')
    .map((par) => par.trim())
    .filter(Boolean)
    .map((par) => {
      const [usuario, ...nome] = par.split(':')
      return { usuario: usuario.trim().toLowerCase(), nome: nome.join(':').trim() || usuario.trim() }
    })
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
    adminUsuarios: lerAdmins(env.ADMIN_USUARIOS),
    adminSenhaInicial: env.ADMIN_SENHA_INICIAL || null,
  }
}
