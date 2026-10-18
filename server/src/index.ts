import { serve } from '@hono/node-server'
import { criarApp } from './app.ts'
import { criarResend } from './email.ts'
import { limparArquivos } from './limpeza.ts'
import { lerConfig } from './config.ts'
import { ServicoAdmin } from './admin/autenticacao.ts'
import { criarPool } from './db.ts'
import { criarProvedorStripe } from './pagamento.ts'
import { migrar } from './migracoes.ts'
import { criarServicos } from './servicos.ts'
import { StorageDisco } from './storage/disco.ts'

const config = lerConfig()
const pool = criarPool(config.databaseUrl)
const storage = new StorageDisco(config.storageDir)

const aplicadas = await migrar(pool)
if (aplicadas.length) console.log(`Migrações aplicadas: ${aplicadas.join(', ')}`)

// Pagamento: só liga com a chave do Stripe no ambiente. Sem ela, só pacotes grátis funcionam.
const gateway = config.stripeSecretKey ? { provedor: criarProvedorStripe(config.stripeSecretKey, config.stripeWebhookSecret!), appUrl: config.appUrl! } : null
if (!gateway) console.warn('STRIPE_SECRET_KEY não definida: pagamento desligado.')
const resendKey = process.env.RESEND_API_KEY || null
const email = resendKey ? criarResend(resendKey, process.env.EMAIL_REMETENTE || 'Mango <contato@mango.razielhub.cloud>') : null
if (!email) console.warn('RESEND_API_KEY não definida: o admin não envia e-mail aos anfitriões.')
const servicos = criarServicos(pool, undefined, gateway, email)

// Admins iniciais: criados uma vez, com a senha inicial do ambiente e troca obrigatória no primeiro login.
if (config.adminSenhaInicial) {
  const criados = await new ServicoAdmin(pool).garantirAdmins(config.adminUsuarios, config.adminSenhaInicial)
  if (criados.length) console.log(`Admins criados (trocar a senha no primeiro login): ${criados.join(', ')}`)
} else if ((await pool.query('select 1 from admins limit 1')).rowCount === 0) {
  console.warn('Nenhum admin existe e ADMIN_SENHA_INICIAL não está definida: a área de admin não terá com quem entrar.')
}

// Relógio dos eventos: início, fim, revelação, expiração e limpeza de arquivos vencidos (a cada minuto).
const agendador = setInterval(() => {
  servicos
    .avancar()
    .then(async () => limparArquivos(pool, storage, new Date(), 200, (await servicos.config.valores()).remocao_arquivo_dias))
    .catch((erro) => console.error('Falha no agendador:', erro))
}, 60_000)

const servidor = serve({ fetch: criarApp(pool, storage, () => new Date(), process.env.RATE_LIMIT === 'off' ? null : undefined, servicos).fetch, port: config.porta }, (info) => {
  console.log(`Mango API ouvindo na porta ${info.port}`)
})

function encerrar() {
  clearInterval(agendador)
  servidor.close(() => void pool.end().then(() => process.exit(0)))
}
process.on('SIGTERM', encerrar)
process.on('SIGINT', encerrar)
