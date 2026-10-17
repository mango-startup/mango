# API do Mango: guia de integração para o front

Para quem vai trocar a api simulada pela real (issue #73). A fonte da verdade de cada rota é [`server/openapi.json`](../server/openapi.json) (conferido por teste contra as rotas reais); este guia explica **como usar**: mapa dos métodos do `MangoApi`, fluxos, pegadinhas e o que ainda falta.

- Produção: `https://mango.razielhub.cloud/api/...` (mesmo domínio do site, então **sem CORS**).
- Documentação do servidor: [`server/README.md`](../server/README.md). Plano do produto: [`PLANO-MVP.md`](PLANO-MVP.md).

## 1. Regras gerais

**Autenticação sem login (piloto)**
- **Anfitrião:** `POST /api/eventos` devolve `anfitriao_token` **uma única vez**. Daí em diante vai em `Authorization: Bearer <token>`. Quem tem o token administra o evento. No banco fica só o hash; perdeu, perdeu.
- **Convidado:** `POST /api/eventos/:codigo/entrar` devolve `convidado_token` (só na primeira vez, status `201`). Vai em `X-Convidado-Token`. Reentrar com o mesmo header devolve `200` com o mesmo convidado, sem token novo.
- A `Sessao` do front (`src/lib/api/sessao.ts`) já guarda os dois: anfitrião por **id do evento**, convidado por **código**. Não precisa mudar.

**Formatos**
- JSON em `snake_case`; datas em ISO 8601 UTC (`2026-11-14T22:00:00.000Z`). Ids são UUID; o **código** do evento tem 8 caracteres (`A-Z` sem ambíguos e `2-9`); minúsculas também são aceitas.
- Erro: `{ "erro": "codigo_estavel", "mensagem": "texto em português" }` com o status HTTP certo. Decida pelo `erro`, mostre a `mensagem`. Alguns trazem campos extras (ex.: `estado`, `revelacao_em`, `retry_em_segundos`). Mapeie para `ErroApi(status, erro, mensagem, extra)`.
- Um erro **sem JSON** (`500 Internal Server Error` em texto puro) é falha inesperada: trate como "tente de novo".

**Limites de requisição (nunca barram quem usa direito)**
| Limite | Valor | Chave |
|---|---|---|
| Criar evento | 30 por hora | IP |
| Upload de foto ou miniatura | 300 por minuto | aparelho do convidado |
| Tentativas que falham (401 ou 404) | 600 por minuto | IP (só falha conta) |
| Pedido de remoção | 30 por hora | IP |

Estourou: `429`, header `Retry-After` (segundos) e `{ erro: "muitas_requisicoes", retry_em_segundos }`. Tratar como "tentar depois", não como erro definitivo (a fila de envio já faz isso).

**Cuidado em desenvolvimento:** todo mundo no mesmo IP divide o limite de **30 eventos por hora**. Teste contra a API local (seção 2), não contra a produção.

## 2. Rodando

**API local (recomendado)**
```bash
docker compose -f docker-compose.dev.yml up --build   # API em http://localhost:3000 + Postgres
curl localhost:3000/api/saude                          # {"status":"ok","banco":"ok"}
```

**Proxy no Vite** (a API não tem CORS; em produção é o mesmo domínio, então só o dev precisa). Em `vite.config.ts`, dentro de `server`:
```ts
proxy: { '/api': { target: 'http://localhost:3000', changeOrigin: true } },
```
Assim o front chama sempre `/api/...` (caminho relativo), no dev e em produção. Para olhar a produção de verdade, aponte o `target` para `https://mango.razielhub.cloud`, ciente do aviso acima.

**Roteiro de verificação:** com a API local no ar, `npm run smoke:api` (ou `node scripts/smoke-api.ts http://localhost:3000`) percorre o ciclo inteiro pela `criarApiReal`: criar evento, entrar, fotografar com reenvio, moderar, revelar, álbum, ZIP, privacidade e excluir (14 verificações). Mexeu em `real.ts` ou numa rota? Rode antes do PR. Recusa rodar contra a produção.

**Testar o ciclo inteiro rápido:** crie o evento com `captura_inicio` no passado, `captura_fim` daqui a 2 minutos e `revelacao_em` igual ao `captura_fim`. A câmera abre na hora, fecha em 2 minutos e revela 1 minuto depois (o relógio do servidor roda a cada minuto e também antes de responder). Ou use `revelacao_manual: true` e `POST .../revelar`.

## 3. Mapa: `MangoApi` → rota

Anfitrião (sempre `Authorization: Bearer <token do evento>`):

| Método do `MangoApi` | Rota | Observações |
|---|---|---|
| `pacotes()` | `GET /api/pacotes` | resposta `{ pacotes: [...] }`. Já vêm `id`, `nome`, `convidados`, `gratis`, `preco_centavos`, `retencao_dias`, `poses_max` e `poses_opcoes` |
| `criarEvento(dados)` | `POST /api/eventos` | resposta `{ evento, anfitriao_token }`. **Guardar o token** com `guardarTokenDoAnfitriao(evento.id, token)` e devolver só o `evento`. Pago nasce `aguardando_pagamento`; `teste` nasce `pronto` |
| `anfitriaoNesteAparelho()` | só local | há algum token guardado? |
| `meusEventos()` | `GET /api/anfitriao/evento` para **cada** token guardado | resposta já é o `PainelEvento` (`{ evento, convidados, fotos }`). `401` = token inválido, chamar `esquecerEvento` |
| `painel(eventoId)` | `GET /api/anfitriao/evento` | usa o token daquele evento |
| `linkDoAnfitriao(eventoId)` | só local | monta `/anfitriao#<token>` |
| `entrarComoAnfitriao(token)` | `GET /api/anfitriao/evento` com o token recebido | o `evento.id` da resposta é a chave para guardar o token; `401` = link inválido |
| `encerrar` / `revelar` | `POST /api/anfitriao/evento/encerrar` e `/revelar` | resposta `{ evento }`. `409 transicao_invalida` se o estado não permite |
| `excluir` | `DELETE /api/anfitriao/evento` | `204`. Exclusão lógica; depois disso o token deixa de valer (`401`) |
| `definirAlbumPrivado` | `PATCH /api/anfitriao/evento` com `{ album_privado }` | resposta traz `album_privado` |
| **(novo)** `editarEvento` | `PATCH /api/anfitriao/evento` | nome, poses e horários só antes de a câmera abrir (`409 evento_em_andamento` depois). Campo fora da lista = `400 campo_desconhecido` |
| `trocarCodigo` | `POST /api/anfitriao/evento/novo-codigo` | resposta `{ codigo }`; o link e o QR antigos morrem na hora |
| `cancelar` | `POST /api/anfitriao/evento/cancelar` | só `pronto` e sem fotos (`409 transicao_invalida` ou `tem_fotos`). Não existe estorno ainda |
| `albumDoAnfitriao(id, opcoes)` | `GET /api/eventos/:codigo/album?limite=&pagina=` **com Bearer** | precisa do `codigo` do evento (vem no `PainelEvento.evento.codigo`). O anfitrião vê em qualquer estado (moderação), menos `expirado` (`410`) |
| `baixarAlbum` | `GET /api/anfitriao/album.zip` | só depois de revelado (`409 nao_revelado`). Precisa do header, então **`fetch` + `blob()`**, não `<a href>` |
| `apagarFoto(id, fotoId)` | `DELETE /api/anfitriao/fotos/:fotoId` | `204`. Some do álbum na hora; resolve os pedidos de remoção dela |
| `pedidosDeRemocao` | `GET /api/anfitriao/pedidos-remocao` | resposta `{ pedidos: [...] }` com `id`, `foto_id`, `numero` (quadro no álbum), `motivo`, `criado_em` |
| **(novo)** `manterFoto(pedidoId)` | `POST /api/anfitriao/pedidos-remocao/:pedidoId/manter` | `204`; o pedido sai da fila |
| `iniciarPagamento(eventoId)` | `POST /api/anfitriao/evento/pagamento` | resposta `{ status: 'pendente', url, reaproveitada }`. Redirecionar o navegador para a `url` (página do Stripe). Repetir reaproveita a sessão aberta. `409 pagamento_em_andamento` = Pix gerado, esperando o banco; `503 pagamento_indisponivel` = pagamento desligado |
| `statusPagamento(eventoId)` | `GET /api/anfitriao/evento/pagamento` | `{ status: 'pendente' \| 'aprovado' \| 'recusado' \| null, valor_centavos, estornado }`. Quem libera o evento é o webhook do Stripe, não o retorno do navegador: depois de pagar, consulte até o evento sair de `aguardando_pagamento` |

Convidado (sem token na entrada; depois `X-Convidado-Token`):

| Método do `MangoApi` | Rota | Observações |
|---|---|---|
| `eventoPublico(codigo)` | `GET /api/eventos/:codigo` | nada sensível; traz `estado`, datas, `lotado`, `album_privado`. `404` se não existe, foi excluído ou o código foi trocado |
| `entrar(codigo, apelido?)` | `POST /api/eventos/:codigo/entrar` com `{ apelido }` e, se já tiver, o header | `201` = convidado novo (vem `convidado_token`: guardar com `guardarTokenDoConvidado`); `200` = aparelho reconhecido. `409 captura_fechada` (traz `estado`, `captura_inicio`, `captura_fim`) ou `409 lotado` |
| `eu(codigo)` | `GET /api/eventos/:codigo/eu` | `poses_restantes` e a lista de `fotos` que o servidor já tem. `401 nao_autorizado` se o token não é daquele evento |
| `enviarFoto(codigo, id, blob, info)` | `PUT /api/eventos/:codigo/fotos/:fotoId` | **corpo cru**, `Content-Type: image/jpeg` (não é `multipart`). Headers opcionais `X-Largura`, `X-Altura`, `X-Tirada-Em`. `201` nova, `200` repetida (`repetida: true`). Máx. 2 MB e tem que ser JPEG de verdade |
| `enviarMiniatura` | `PUT .../fotos/:fotoId/miniatura` | corpo cru JPEG, máx. 512 KB; só depois de a foto existir (senão `404 nao_encontrada`) |
| `album(codigo, opcoes)` | `GET /api/eventos/:codigo/album?limite=&pagina=&minhas=1` | `minhas=1` exige `X-Convidado-Token`. Só revelado, não privado e não expirado |
| `pedirRemocao(codigo, id, motivo?)` | `POST /api/eventos/:codigo/fotos/:fotoId/pedir-remocao` com `{ motivo }` | `201` pedido novo, `200` `{ repetido: true }` se a pessoa já pediu. Só com o álbum visível |

**`url` e `miniatura_url` do álbum:** o servidor **não** manda. Monte:
`/api/eventos/${codigo}/fotos/${id}/arquivo` e `/api/eventos/${codigo}/fotos/${id}/miniatura` (a miniatura cai para a original se não existir; `?baixar=1` no arquivo força o download).

## 4. Fluxos

**Anfitrião**
1. `GET /api/pacotes` → tela de preços e criação.
2. `POST /api/eventos` → guardar o token → mostrar o **link do convidado** (`/c/<codigo>`) e o **link secreto** do anfitrião.
3. Evento `pronto` → `captura_aberta` (no horário) → `captura_encerrada` (no horário ou `encerrar`) → `revelado` (no horário ou `revelar`) → `expirado` (30 dias no teste, 365 nos pagos).
4. Durante e depois: painel (`GET /api/anfitriao/evento`), moderação, ZIP, álbum privado, trocar código, excluir.

**Convidado**
1. `GET /api/eventos/:codigo` → decide a tela pelo `estado` (antes do início, aberta, espera, álbum, expirado, lotado).
2. `POST .../entrar` → guarda o token.
3. Câmera: foto fica na fila local (IndexedDB) e sobe com `PUT`; `GET .../eu` diz o que o servidor já tem.
4. Depois da revelação: `GET .../album`.

**Estados do evento** (o `estado` que vem do servidor): `rascunho`, `aguardando_pagamento`, `pronto`, `captura_aberta`, `captura_encerrada`, `revelado`, `expirado`, `cancelado`. Eventos excluídos viram `404`.

## 5. Pegadinhas que dão trabalho

1. **`<img>` não manda `Authorization`.** Depois da revelação e com o álbum público, `<img src="/api/.../miniatura">` funciona. Mas **a moderação antes da revelação, e o álbum privado, só abrem com o Bearer do anfitrião**: nesses casos baixe com `fetch` (header) → `blob` → `URL.createObjectURL` (e `revokeObjectURL` ao sair). O mesmo vale para o ZIP. Se isso pesar na tela de moderação (#17), avise: dá para o servidor oferecer outra forma (URL temporária assinada), que já era o plano para quando as fotos forem para o R2.
2. **Idempotência do upload:** o id da foto é um UUID **gerado no aparelho**. Reenviar o mesmo id é seguro (`200 repetida`) e não gasta pose. A fila atual já faz isso. Se o `PUT` falhar no meio, reenvie o mesmo id.
3. **Erros que não adianta repetir** (o front já lista): `sem_poses`, `evento_cheio`, `captura_fechada`, `id_em_uso`, `tipo_invalido`, `arquivo_grande`, `id_invalido`, `nao_encontrado`. Atenção: para foto o servidor diz `nao_encontrada` (feminino) e para evento `nao_encontrado`.
4. **`nao_autorizado` (401) na fila de envio** fica pendente para sempre hoje (issue #76). Com a API real isso acontece de verdade se o token do convidado sumir.
5. **Câmera fechada x envio atrasado:** depois do `captura_fim` ainda se aceita foto por **24 horas** (`estado: captura_encerrada`). As poses restantes do convidado vêm do servidor; desconte da fila local só o que ainda não subiu.
6. **Poses:** a regra é imposta no servidor em transação. Se o contador local divergir, **o servidor ganha** (`GET /eu`).
7. **O relógio do evento anda no servidor.** `GET /api/eventos/:codigo` avança o estado se já passou do horário; não precisa de "polling especial". Para a tela de espera, consultar de tempos em tempos é suficiente e **não conta** no limite de falhas (só 401/404 contam).
8. **Código trocado ou evento excluído:** o link antigo vira `404`. Não fique repetindo a chamada num loop: 600 falhas por minuto por IP é folgado, mas uma festa inteira num Wi-Fi só pode somar.
9. **Datas e fuso:** o servidor só guarda instantes (UTC). Montar "19h até 2h" é com o front, no fuso do aparelho (o `horarios.ts` já faz).
10. **Tamanho de resposta do álbum:** `limite` padrão 60, máximo 200, `pagina` a partir de 1. A `numero` de cada foto é a posição no álbum **inteiro**, mesmo com `minhas=1`.

## 6. O que falta, e de quem

**Servidor (nada bloqueia a troca da api, exceto o pagamento):**
- Pagamento com Stripe (#37): rotas prontas (`iniciarPagamento` e `statusPagamento` na tabela acima). Só liga em produção com `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` e `APP_URL` no servidor e `pacotes_pagos_disponiveis` ligado no admin. Passo a passo: [`PAGAMENTO-STRIPE.md`](PAGAMENTO-STRIPE.md).
- E-mail (aviso de expiração e de revelação): #58.
- Migração das fotos para R2 (#52): vai trocar como as fotos são servidas; o contrato das rotas não muda.

**Front (#73): lista de tarefas**
- [ ] `src/lib/api/real.ts` implementando `MangoApi` com `fetch` em caminho relativo `/api/...`, usando a `Sessao` existente.
- [ ] Proxy `/api` no `vite.config.ts` (seção 2).
- [ ] Mapear `Response` → `ErroApi` (JSON com `erro` e `mensagem`; texto puro = falha genérica) e tratar `429` com `Retry-After`.
- [ ] `url` e `miniatura_url` do álbum montadas pela api; `blob` para quem precisa de header (seção 5.1).
- [ ] Adicionar `editarEvento` e `manterFoto` à interface; tirar o "só na simulada" de `cancelar`, `apagarFoto`, `pedidosDeRemocao`, `pedirRemocao` e do preço dos pacotes.
- [ ] Trocar a linha `export const api: MangoApi = simulada` em `src/lib/api/index.ts` (com um interruptor para manter a simulada em desenvolvimento sem rede).
- [ ] Rodar o fluxo completo contra a API local: criar → entrar → fotografar (inclusive sem sinal) → encerrar → revelar → álbum → ZIP → moderar.

Dúvida sobre qualquer rota: o `server/openapi.json` tem os formatos exatos e os códigos de erro de cada resposta; se faltar algo para a tela, abra uma issue com o que precisa que o servidor devolva.
