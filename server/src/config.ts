export interface Config {
  porta: number
  databaseUrl: string
  storageDir: string
  /** Admins criados na primeira subida (ADMIN_USUARIOS="raziel:Raziel,lucas:Lucas"). */
  adminUsuarios: { usuario: string; nome: string }[]
  /** Senha inicial deles (ADMIN_SENHA_INICIAL). Só vale até o primeiro login: a troca é obrigatória. Sem ela, nenhum admin é criado. */
  adminSenhaInicial: string | null
  /** Chave secreta do Stripe (STRIPE_SECRET_KEY). Sem ela, o pagamento fica desligado e só pacotes grátis funcionam. */
  stripeSecretKey: string | null
  /** Segredo de assinatura do endpoint do webhook (STRIPE_WEBHOOK_SECRET, começa com whsec_). */
  stripeWebhookSecret: string | null
  /** Endereço público do site (APP_URL), para o Stripe devolver o cliente depois do pagamento. */
  appUrl: string | null
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
  const stripeSecretKey = env.STRIPE_SECRET_KEY || null
  const stripeWebhookSecret = env.STRIPE_WEBHOOK_SECRET || null
  let appUrl = env.APP_URL?.trim().replace(/\/+$/, '') || null
  if (stripeSecretKey) {
    if (!/^(sk|rk)_(test|live)_\S+$/.test(stripeSecretKey)) throw new Error('STRIPE_SECRET_KEY inválida: deve começar com sk_test_, sk_live_ ou rk_')
    if (!stripeWebhookSecret || !stripeWebhookSecret.startsWith('whsec_')) throw new Error('STRIPE_SECRET_KEY exige STRIPE_WEBHOOK_SECRET (começa com whsec_)')
    if (!appUrl || !/^https?:\/\/\S+$/.test(appUrl)) throw new Error('STRIPE_SECRET_KEY exige APP_URL, por exemplo https://mango.razielhub.cloud')
  } else {
    appUrl = appUrl && /^https?:\/\/\S+$/.test(appUrl) ? appUrl : null
  }
  return {
    porta,
    databaseUrl,
    storageDir: env.STORAGE_DIR ?? './dados/fotos',
    adminUsuarios: lerAdmins(env.ADMIN_USUARIOS),
    adminSenhaInicial: env.ADMIN_SENHA_INICIAL || null,
    stripeSecretKey,
    stripeWebhookSecret,
    appUrl,
  }
}
