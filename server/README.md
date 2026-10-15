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

Os testes de migração precisam de um banco descartável (**apaga o schema public**):
`TEST_DATABASE_URL=postgres://mango:mango@localhost:5432/mango_test npm test`. Sem a variável, são pulados.

## Estrutura

- `src/app.ts` rotas (`GET /api/saude` checa o banco) · `src/config.ts` variáveis de ambiente
- `src/migracoes.ts` runner: aplica `migrations/*.sql` em ordem, uma transação por arquivo, registro na tabela `migracoes`
- `src/storage/` interface `Storage` (`salvar`, `ler`, `apagar`) e implementação em disco; trocar por R2 = nova classe
- `migrations/001_*.sql` tabelas `eventos`, `convidados`, `fotos` (estados conforme seção 3.3 do plano)

## Variáveis

`DATABASE_URL` (obrigatória), `PORT` (3000), `STORAGE_DIR` (`./dados/fotos`). Nenhum segredo no repo.
