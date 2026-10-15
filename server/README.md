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

- `src/rotas/fotos.ts` envio · `src/rotas/album.ts` leitura, ZIP e privacidade · `src/zip.ts` escritor de ZIP
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

## Envio de fotos (A5 do plano)

O convidado manda `X-Convidado-Token`. O **id da foto é um UUID gerado no aparelho**, então repetir o envio é seguro (idempotente): a fila de envio pode reenviar à vontade.

| Rota | O que faz |
|---|---|
| `PUT /api/eventos/:codigo/fotos/:fotoId` | corpo = JPEG (máx. 2 MB). Headers opcionais `X-Largura`, `X-Altura`, `X-Tirada-Em`. `201` nova, `200` repetida |
| `PUT /api/eventos/:codigo/fotos/:fotoId/miniatura` | corpo = JPEG (máx. 512 KB), só do dono da foto |
| `GET /api/eventos/:codigo/eu` | poses restantes e ids das fotos que o servidor já tem (para a fila do aparelho sincronizar) |

Regras impostas no servidor: câmera aberta (ou até 24 h depois do fim, para envios atrasados), poses por convidado, teto de fotos do evento, só JPEG de verdade (confere os bytes), tamanho máximo. A reserva da pose acontece numa transação que trava o evento, então envios em paralelo não furam o limite. Se gravar o arquivo falhar, a reserva é desfeita. Ainda não existe leitura de fotos: o álbum (A8) vem depois, e antes da revelação ninguém vê foto.

## Álbum e revelação (A7 e A8 do plano)

Quem vê as fotos: **o anfitrião (token) sempre**, para moderar antes da revelação e baixar depois; **qualquer pessoa com o código só depois de revelado** e se o álbum não for privado. Evento expirado responde `410` para todos.

| Rota | O que faz |
|---|---|
| `GET /api/eventos/:codigo/album?limite=&pagina=&minhas=1` | folha de contato paginada (padrão 60, máx. 200). `numero` é a posição no álbum inteiro, mesmo com `minhas=1` (que usa `X-Convidado-Token`) |
| `GET /api/eventos/:codigo/fotos/:fotoId/arquivo` | JPEG original (`?baixar=1` força download) |
| `GET /api/eventos/:codigo/fotos/:fotoId/miniatura` | miniatura; sem ela cai para a original |
| `GET /api/anfitriao/album.zip` | ZIP em streaming (sem compressão, uma foto na memória por vez), só depois de revelado. Nomes `0001-apelido.jpg`. Acima de 4 GB ou 65 mil arquivos responde `413` (sem ZIP64) |
| `PATCH /api/anfitriao/evento` | `{ "album_privado": true }` = "só eu vejo" |
| `POST /api/anfitriao/evento/novo-codigo` | troca o código; link e QR antigos param de funcionar |

Estado de erro do acesso: `409 nao_revelado` (com `revelacao_em`), `403 album_privado`, `410 expirado`. Fotos usam `cache-control: private`.

## Variáveis

`DATABASE_URL` (obrigatória), `PORT` (3000), `STORAGE_DIR` (`./dados/fotos`). Nenhum segredo no repo.
