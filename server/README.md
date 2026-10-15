# Mango API

Node 24 + TypeScript + Hono, PostgreSQL. Fundação do backend (Marco 1 do `docs/PLANO-MVP.md`).

## Subir tudo local

```bash
docker compose -f docker-compose.dev.yml up --build
curl localhost:3000/api/saude   # {"status":"ok","banco":"ok"}
```

A API aplica as migrações ao iniciar. Fotos ficam no volume `fotos` (`STORAGE_DIR`).

## Sem Docker (só o Postgres em container)

```bash
cd server && cp .env.example .env && npm install
docker compose -f ../docker-compose.dev.yml up -d db
export $(cat .env | xargs) && npm run dev
```

## Scripts

`npm run dev | build | start | migrar | lint | typecheck | test`

Os testes de migração e de eventos precisam de um banco descartável (**apaga o schema public**):
`TEST_DATABASE_URL=postgres://mango:mango@localhost:5432/mango_test npm test`. Sem a variável, são pulados.

## Estrutura

- `src/app.ts` monta as rotas (`GET /api/saude` checa o banco) · `src/rotas/eventos.ts` eventos, convidado e anfitrião · `src/estados.ts` · `src/pacotes.ts` · `src/tokens.ts` · `src/config.ts` variáveis de ambiente
- `src/migracoes.ts` runner: aplica `migrations/*.sql` em ordem, uma transação por arquivo, registro na tabela `migracoes`
- `src/storage/` interface `Storage` (`salvar`, `ler`, `apagar`) e implementação em disco; trocar por R2 = nova classe
- `migrations/002_*.sql` token secreto do anfitrião (e-mail opcional)
- `migrations/001_*.sql` tabelas `eventos`, `convidados`, `fotos` (estados conforme seção 3.3 do plano)

## API de eventos (A2 a A4 do plano)

Anfitrião sem login no piloto: ao criar o evento ele recebe um **token secreto** (só aparece nessa resposta; no banco fica o hash) e o manda em `Authorization: Bearer <token>`. O convidado recebe um token de aparelho na primeira entrada e o reenvia em `X-Convidado-Token`.

| Rota | Quem | O que faz |
|---|---|---|
| `POST /api/eventos` | qualquer um | cria o evento (`nome`, `pacote`, `poses_por_convidado`, `captura_inicio`, `captura_fim`, `revelacao_em` ou `revelacao_manual`). Grátis nasce `pronto`; pago fica `aguardando_pagamento` (pagamento ainda não existe) |
| `GET /api/eventos/:codigo` | convidado | estado público: nome, estado, datas, poses, `lotado` |
| `POST /api/eventos/:codigo/entrar` | convidado | cria o convidado (só com a câmera aberta e dentro do limite) ou reconhece o aparelho |
| `GET /api/anfitriao/evento` | anfitrião | evento + contagem de convidados e fotos |
| `POST /api/anfitriao/evento/encerrar` e `/revelar` | anfitrião | transições manuais, só na ordem do plano |
| `DELETE /api/anfitriao/evento` | anfitrião | exclusão lógica |

Erros vêm como `{ "erro": "codigo", "mensagem": "..." }`. O relógio (início, fim, revelação, expiração) roda a cada minuto e também antes de responder as rotas de evento (`src/agendador.ts`, idempotente).

## Variáveis

`DATABASE_URL` (obrigatória), `PORT` (3000), `STORAGE_DIR` (`./dados/fotos`). Nenhum segredo no repo.
