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
- `openapi.json` contrato da API (conferido por `test/contrato.test.ts`)
- `src/rotas/acesso.ts` quem vê as fotos e quem é o anfitrião · `src/rotas/moderacao.ts` · `src/limpeza.ts`
- `src/validacao.ts` regras de nome, poses e horários (criação e edição)
- `src/limite.ts` contador por janela · `src/limites.ts` limites e IP do cliente
- `src/app.ts` monta as rotas (`GET /api/saude` checa o banco) · `src/rotas/eventos.ts` eventos, convidado e anfitrião · `src/estados.ts` · `src/pacotes.ts` · `src/tokens.ts` · `src/config.ts` variáveis de ambiente
- `src/migracoes.ts` runner: aplica `migrations/*.sql` em ordem, uma transação por arquivo, registro na tabela `migracoes`
- `src/storage/` interface `Storage` (`salvar`, `ler`, `apagar`) e implementação em disco; trocar por R2 = nova classe
- `migrations/003_*.sql` `arquivo_apagado_em` e tabela `pedidos_remocao`
- `migrations/002_*.sql` token secreto do anfitrião (e-mail opcional)
- `migrations/001_*.sql` tabelas `eventos`, `convidados`, `fotos` (estados conforme seção 3.3 do plano)

## Contrato da API

`openapi.json` (OpenAPI 3.1) descreve todas as rotas, schemas, headers de autenticação, erros e limites. É o ponto de encontro com o frontend (`src/lib/api/tipos.ts` segue os mesmos formatos). Para ler com interface, cole o arquivo em https://editor.swagger.io. Ele é mantido à mão e **o teste `test/contrato.test.ts` falha** se uma rota existir sem estar documentada (ou o contrário), se uma referência quebrar ou se um parâmetro de caminho faltar. Não precisa de banco para rodar.

## API de eventos (A2 a A4 do plano)

Anfitrião sem login no piloto: ao criar o evento ele recebe um **token secreto** (só aparece nessa resposta; no banco fica o hash) e o manda em `Authorization: Bearer <token>`. O convidado recebe um token de aparelho na primeira entrada e o reenvia em `X-Convidado-Token`.

| Rota | Quem | O que faz |
|---|---|---|
| `POST /api/eventos` | qualquer um | cria o evento (`nome`, `pacote`, `poses_por_convidado`, `captura_inicio`, `captura_fim`, `revelacao_em` ou `revelacao_manual`). Grátis nasce `pronto`; pago fica `aguardando_pagamento` (pagamento ainda não existe) |
| `GET /api/eventos/:codigo` | convidado | estado público: nome, estado, datas, poses, `lotado` |
| `POST /api/eventos/:codigo/entrar` | convidado | cria o convidado (só com a câmera aberta e dentro do limite) ou reconhece o aparelho |
| `GET /api/anfitriao/evento` | anfitrião | evento + contagem de convidados e fotos |
| `POST /api/anfitriao/evento/encerrar` e `/revelar` | anfitrião | transições manuais, só na ordem do plano |
| `GET /api/pacotes` | qualquer um | pacotes vindos do servidor: convidados, poses possíveis, retenção e `preco_centavos` (hipótese do plano, a validar) |
| `PATCH /api/anfitriao/evento` | anfitrião | edita `nome`, `poses_por_convidado`, horários e revelação só antes de a câmera abrir (recalcula o teto de fotos); `album_privado` a qualquer momento. Campo fora da lista dá `400 campo_desconhecido`; depois de aberta, `409 evento_em_andamento` |
| `POST /api/anfitriao/evento/cancelar` | anfitrião | `pronto` → `cancelado`, só sem fotos (`409 tem_fotos`). O estorno entra com o pagamento |
| `DELETE /api/anfitriao/evento` | anfitrião | exclusão lógica |

Erros vêm como `{ "erro": "codigo", "mensagem": "..." }`. O relógio (início, fim, revelação, expiração e a limpeza de rascunhos e pagamentos não concluídos há mais de 7 dias) roda a cada minuto e também antes de responder as rotas de evento (`src/agendador.ts`, idempotente).

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
| `PATCH /api/anfitriao/evento` | `{ "album_privado": true }` = "só eu vejo" (o mesmo PATCH de edição do evento) |
| `POST /api/anfitriao/evento/novo-codigo` | troca o código; link e QR antigos param de funcionar |

Estado de erro do acesso: `409 nao_revelado` (com `revelacao_em`), `403 album_privado`, `410 expirado`. Fotos usam `cache-control: private`.

## Limites de requisição

Pensados para festa: dezenas de convidados no mesmo Wi-Fi compartilham UM IP, então leitura e upload **não** são limitados por IP. Só o que é abuso:

| Limite | Valor | Chave |
|---|---|---|
| Criar evento | 30 por hora | IP |
| Upload de foto/miniatura | 300 por minuto | aparelho do convidado (token) |
| Tentativas que falham com 401/404 | 600 por minuto | IP (só falha conta; sucesso nunca) |
| Pedido de remoção de foto | 30 por hora | IP |

Estourou: `429` com `Retry-After` e `{ "erro": "muitas_requisicoes", "retry_em_segundos": N }`. O limite de upload cobre a fila offline despejando de uma vez (36 fotos + miniaturas). Os contadores ficam em memória (uma instância só) e se esvaziam sozinhos se a tabela crescer demais (falha aberta, nunca derruba a API). Em emergência, `RATE_LIMIT=off` desliga tudo. O IP vem do **fim** do `X-Forwarded-For` (o que o Caddy escreve); sem proxy, vale o socket. Valores em `src/limites.ts`.

## Moderação e limpeza (A9 e A10 do plano)

| Rota | O que faz |
|---|---|
| `DELETE /api/anfitriao/fotos/:fotoId` | apaga a foto: some do álbum na hora (antes e depois da revelação) e resolve os pedidos de remoção dela. O arquivo sai do armazenamento em até 30 dias |
| `POST /api/eventos/:codigo/fotos/:fotoId/pedir-remocao` | quem vê o álbum pede a remoção (`{ "motivo": "..." }` opcional). Um pedido por pessoa e foto: convidado reconhecido pelo token, os demais pelo IP (guardado só como hash). Repetir devolve `{ repetido: true }`. 30 por hora por IP |
| `GET /api/anfitriao/pedidos-remocao` | pedidos pendentes com o número do quadro |
| `POST /api/anfitriao/pedidos-remocao/:pedidoId/manter` | o anfitrião decide manter a foto |

Cada pedido novo também sai numa linha de log JSON (`{"aviso":"pedido_remocao",...}`) em `docker compose logs api`: é o que o suporte lê enquanto não há e-mail (#58).

**Limpeza (`src/limpeza.ts`, roda a cada minuto junto com o agendador):** apaga os arquivos de foto removida há 30 dias ou mais, de evento expirado e de evento excluído há 30 dias ou mais; guarda a linha com `arquivo_apagado_em` (metadados mínimos). Idempotente; se o armazenamento falhar, a foto fica sem marca e entra de novo na próxima rodada.

## Variáveis

`DATABASE_URL` (obrigatória), `PORT` (3000), `STORAGE_DIR` (`./dados/fotos`), `RATE_LIMIT=off` (desliga os limites). Nenhum segredo no repo.
