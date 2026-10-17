# Pagamento com Stripe

Decisão de 16/10/2026 (issue #37): o gateway é o **Stripe Checkout**, página hospedada pelo Stripe, em reais. O Mango nunca recebe nem guarda número de cartão.

## Como funciona

1. O anfitrião cria um evento de pacote pago. Ele nasce `aguardando_pagamento`.
2. Na tela de pagamento, o front chama `POST /api/anfitriao/evento/pagamento`. O servidor cria uma **sessão do Checkout** com o preço do pacote lido do banco, `client_reference_id` = id do evento, e devolve a `url`. O front redireciona para ela. Repetir enquanto a sessão estiver aberta devolve a mesma URL.
3. O cliente paga no Stripe (cartão ou, se estiver ligado, Pix) e volta para `/eventos/:id/pagamento?stripe=ok`. **Essa volta não libera nada**: a tela só consulta o estado.
4. O Stripe chama `POST /api/stripe/webhook`. O servidor confere a assinatura sobre o corpo bruto, grava o id do evento (a mesma entrega nunca vale duas vezes), **reconsulta a sessão** no Stripe, confere valor, moeda e evento, e só então muda o evento para `pronto`.
5. Pix e outras formas com confirmação tardia: `checkout.session.completed` chega sem o dinheiro (`payment_status = unpaid`); o evento só sai de "aguardando" em `checkout.session.async_payment_succeeded`.
6. Estorno total no Dashboard: o evento é cancelado se ainda não tiver foto. Com fotos, o dinheiro volta, o evento segue e sai um aviso no log (decisão humana).

## Variáveis de ambiente (servidor)

| Variável | O que é |
|---|---|
| `STRIPE_SECRET_KEY` | chave secreta: `sk_test_...` (teste) ou `sk_live_...` (produção) |
| `STRIPE_WEBHOOK_SECRET` | segredo de assinatura do endpoint (`whsec_...`), **diferente em teste e em produção** |
| `APP_URL` | endereço público do site, sem barra no fim (produção: `https://mango.razielhub.cloud`) |

As três são obrigatórias juntas. Sem `STRIPE_SECRET_KEY` o pagamento fica desligado e só o pacote grátis funciona. **Chave nunca vai para o repositório, para chat ou para print.** A de produção só existe no servidor.

## Configurar o Stripe (modo teste)

1. No Dashboard, ligue o **modo de teste** e copie a chave secreta de teste.
2. **Formas de pagamento** (Configurações > Formas de pagamento): confirme o cartão e ligue o **Pix**. O Pix só aparece para clientes elegíveis e a conta precisa estar apta; `npm run smoke:stripe` mostra se ele apareceu.
3. **Webhook**: em Desenvolvedores > Webhooks, crie um endpoint com a URL `https://<dominio>/api/stripe/webhook` e estes 5 eventos: `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, `checkout.session.expired`, `charge.refunded`. Copie o `whsec_...` dele.
4. Em desenvolvimento local, sem URL pública: `stripe listen --forward-to localhost:3000/api/stripe/webhook` (Stripe CLI). Ele imprime o `whsec_...` a usar.

## Testar de ponta a ponta

1. `cd server && STRIPE_SECRET_KEY=sk_test_... npm run smoke:stripe`: cria e expira uma sessão e confere valor, moeda e idempotência.
2. Suba a API com as três variáveis (ver `.env.example`) e ligue **Pacotes pagos disponíveis** em `/admin` > Configurações.
3. Crie um evento do pacote Festa, vá para o pagamento e pague com o cartão `4242 4242 4242 4242` (validade futura, CVC qualquer). O evento deve virar `pronto`.
4. Pix de teste: use o e-mail `succeed_immediately@example.com` (paga na hora), `expire_immediately@example.com` (expira) ou qualquer outro (paga em ~3 minutos).
5. Estorno: no Dashboard, estorne o pagamento. O evento sem fotos vira `cancelado`.

## Ir para produção

1. Conta do Stripe ativada para receber (depende da conta de recebimento, #56) e Pix habilitado, se for usar.
2. No servidor (Raziel): `STRIPE_SECRET_KEY` live, `STRIPE_WEBHOOK_SECRET` do endpoint **live** e `APP_URL`. Reiniciar a API.
3. Criar o endpoint live do webhook com os 5 eventos.
4. Fazer uma compra real do menor valor e estornar em seguida.
5. Só então ligar **Pacotes pagos disponíveis** no admin. Se desligar, eventos novos pagos deixam de ser criados; os que já existem seguem.

## Quando algo dá errado

- **Pagou e o evento não liberou**: veja em Webhooks > Entregas do Dashboard. O Stripe repete por até três dias. O servidor responde 500 sem gravar o id quando algo falha, então a repetição funciona. Reenviar manualmente também.
- **`pagamento_divergente` no log**: valor, moeda ou evento da sessão não bate com o cobrado. Nada foi liberado; investigue.
- **`pagamento_sem_evento` no log**: dinheiro recebido por um evento que já tinha sido apagado. Estornar à mão. Para listar: `select * from pagamentos where status = 'aprovado_orfao'`.
- **Cancelar o evento pelo painel não estorna**: o estorno automático ao cancelar é a #62. Por enquanto, estornar no Dashboard.
- **Girar o segredo do webhook**: no Dashboard, "Substituir segredo" com expiração atrasada; atualize `STRIPE_WEBHOOK_SECRET` e reinicie antes de a expiração chegar.

## Onde está o código

`server/src/pagamento.ts` (provedor Stripe e regras), `server/src/rotas/pagamento.ts` (rotas), `server/migrations/005_pagamentos.sql`, `server/test/pagamento*.test.ts`, `server/scripts/smoke-stripe.ts`. No front: `src/lib/api/real.ts` e `src/pages/PaymentStatus.tsx`.
