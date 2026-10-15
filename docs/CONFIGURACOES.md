# O que é configurável pelos admins (e o que não é)

Auditoria dos valores de negócio que estavam fixos no código e agora são geridos na área de admin (`/admin`, só para os donos do Mango: Raziel e Lucas). Os valores moram no banco; o código guarda só o **padrão**, a **faixa válida** e a descrição de cada um (`server/src/configuracao.ts`). Toda alteração vale na hora, passa por validação e fica na auditoria (quem, o quê, antes e depois).

## Como funciona

- **Pacotes** (nome, convidados, preço, retenção do álbum, poses máximas, ativo e ordem): tabela `pacotes`, editável em `/admin` (aba Pacotes). Dá para criar pacotes novos. Eventos já criados **não mudam** quando o pacote muda: o limite de convidados e a retenção ficam gravados no evento na criação.
- **Configurações** (as tabelas abaixo): tabela `configuracoes` guarda só o que foi alterado; o resto vale o padrão. `null` volta uma chave ao padrão.
- **O front** lê o que precisa em `GET /api/config` e `GET /api/pacotes`.
- **Auditoria:** `GET /api/admin/auditoria` (aba Auditoria) lista cada mudança.
- **Acesso:** usuários `raziel` e `lucas`, criados na primeira subida com a senha inicial do ambiente (`ADMIN_SENHA_INICIAL`); **a troca é obrigatória no primeiro login**. Depois: sessão por cookie HttpOnly (8 h), bloqueio de 15 min após 5 erros, e um admin pode redefinir a senha do outro (senha temporária, também com troca obrigatória).

## Configurações editáveis

### Operação

| Chave | O que controla | Padrão | Faixa | Aparece no front |
|---|---|---|---|---|
| `criacao_aberta` | **Criação de eventos aberta.** Desligue para pausar a criação de eventos novos (manutenção). Eventos existentes seguem funcionando. | ligado | — | sim (`GET /api/config`) |
| `pacotes_pagos_disponiveis` | **Pacotes pagos disponíveis.** Ligue só quando o pagamento estiver funcionando. Desligado, só pacotes grátis podem ser criados. | desligado | — | sim (`GET /api/config`) |
| `contato_suporte` | **Contato de suporte.** E-mail ou WhatsApp mostrado ao público (termos, ajuda). | (vazio) | — | sim (`GET /api/config`) |

### Eventos

| Chave | O que controla | Padrão | Faixa | Aparece no front |
|---|---|---|---|---|
| `captura_max_horas` | **Câmera aberta, no máximo.** Maior intervalo entre abrir e fechar a câmera de um evento. | 48 horas | 1 a 168 horas | sim (`GET /api/config`) |
| `revelacao_max_dias` | **Revelação, no máximo depois do fim.** Quantos dias depois de a câmera fechar a revelação pode ser agendada. | 7 dias | 1 a 60 dias | sim (`GET /api/config`) |
| `revelacao_padrao_horas` | **Revelação padrão depois do fim.** Usada quando o evento não informa o horário da revelação. | 12 horas | 0 a 168 horas | sim (`GET /api/config`) |
| `poses_validas` | **Poses por convidado (opções).** As opções que o anfitrião pode escolher; cada pacote limita pelo seu máximo de poses. Ex.: 12, 24, 36. | 12, 24, 36 | 1 a 100 | sim (`GET /api/config`) |
| `poses_padrao` | **Poses padrão.** Sugestão inicial. Precisa estar entre as opções acima. | 24 | 1 a 100 | sim (`GET /api/config`) |
| `nome_evento_max` | **Nome do evento, tamanho máximo.** Caracteres. | 80 caracteres | 20 a 200 caracteres | sim (`GET /api/config`) |
| `apelido_max` | **Apelido do convidado, tamanho máximo.** Caracteres. | 40 caracteres | 10 a 100 caracteres | sim (`GET /api/config`) |
| `rascunho_validade_dias` | **Pagamento não concluído some depois de.** Evento em rascunho ou aguardando pagamento é excluído depois deste prazo. | 7 dias | 1 a 60 dias | não |

### Fotos

| Chave | O que controla | Padrão | Faixa | Aparece no front |
|---|---|---|---|---|
| `foto_max_kb` | **Foto, tamanho máximo no envio.** O servidor recusa acima disso. | 2048 KB | 256 a 10240 KB | sim (`GET /api/config`) |
| `miniatura_max_kb` | **Miniatura, tamanho máximo.** Não pode passar do tamanho máximo da foto. | 512 KB | 32 a 2048 KB | sim (`GET /api/config`) |
| `foto_dimensao_max_px` | **Foto, lado maior.** O aparelho reduz a foto para este lado maior antes de enviar. | 1600 px | 800 a 4000 px | sim (`GET /api/config`) |
| `foto_qualidade_jpeg` | **Qualidade do JPEG.** De 0,5 a 0,95. Mais alto = foto melhor e arquivo maior. | 0.8 | 0.5 a 0.95 | sim (`GET /api/config`) |
| `envio_atrasado_horas` | **Envio depois de a câmera fechar.** Fotos tiradas sem sinal ainda são aceitas por este tempo. | 24 horas | 0 a 168 horas | sim (`GET /api/config`) |
| `album_pagina_padrao` | **Álbum, fotos por página (padrão).** Não pode passar do máximo abaixo. | 60 | 10 a 200 | não |
| `album_pagina_max` | **Álbum, fotos por página (máximo).** Teto que o front pode pedir. | 200 | 20 a 500 | não |
| `zip_max_gb` | **ZIP do álbum, tamanho máximo.** Acima disso o anfitrião baixa as fotos pelo álbum. Limite técnico de 4 GB. | 4 GB | 0.5 a 4 GB | não |

### Retenção e moderação

| Chave | O que controla | Padrão | Faixa | Aparece no front |
|---|---|---|---|---|
| `remocao_arquivo_dias` | **Arquivo apagado depois de.** Foto removida ou evento excluído tem os arquivos apagados do armazenamento depois deste prazo. | 30 dias | 0 a 365 dias | não |
| `pedido_remocao_motivo_max` | **Motivo do pedido de remoção, tamanho máximo.** Caracteres. | 300 caracteres | 50 a 2000 caracteres | sim (`GET /api/config`) |

### Limites de requisição

| Chave | O que controla | Padrão | Faixa | Aparece no front |
|---|---|---|---|---|
| `rl_ativo` | **Limites de requisição ligados.** Em emergência, desligar libera tudo. Deixe ligado. | ligado | — | não |
| `rl_criar_evento_hora` | **Criar evento, por IP.** Eventos novos por hora por endereço. | 30 por hora | 1 a 100000 por hora | não |
| `rl_upload_minuto` | **Envio de foto, por convidado.** Pensado para a fila offline despejando de uma vez. Não use por IP: vários convidados dividem o Wi-Fi. | 300 por minuto | 10 a 100000 por minuto | não |
| `rl_falhas_minuto` | **Tentativas que falham, por IP.** Só 401 e 404 contam; quem acerta nunca é barrado. | 600 por minuto | 20 a 100000 por minuto | não |
| `rl_pedido_remocao_hora` | **Pedido de remoção, por IP.** Pedidos por hora por endereço. | 30 por hora | 1 a 100000 por hora | não |


O pacote `teste` é a porta de entrada gratuita e **não pode ser desativado nem cobrado**: o front e o plano contam com ele.

## De onde cada valor veio (antes era fixo no código)

| Valor | Onde estava | Onde fica agora |
|---|---|---|
| Nome, convidados, preço, retenção e poses máx. dos 4 pacotes | `server/src/pacotes.ts` (e o preço também repetido em `src/lib/api/regras.ts` do front) | tabela `pacotes` (admin) |
| Retenção do álbum 30/365 dias | **duplicada à mão no SQL** (`agendador.ts`, `eventos.ts`: `pacote = 'teste'`) | coluna `retencao_dias` do evento, gravada na criação |
| Opções de poses 12/24/36 | `pacotes.ts` **e no `CHECK` do banco** | `poses_validas` + `poses_padrao` |
| Os 4 nomes de pacote | `CHECK` do banco | chave estrangeira para `pacotes` |
| Câmera aberta até 48 h, revelação em até 7 dias, padrão de 12 h | `estados.ts`, `validacao.ts` | `captura_max_horas`, `revelacao_max_dias`, `revelacao_padrao_horas` |
| Nome 80, apelido 40, motivo 300 | `validacao.ts`, `eventos.ts`, `moderacao.ts` | `nome_evento_max`, `apelido_max`, `pedido_remocao_motivo_max` |
| Rascunho some em 7 dias | `agendador.ts` | `rascunho_validade_dias` |
| Foto 2 MB, miniatura 512 KB, envio atrasado 24 h | `fotos.ts` | `foto_max_kb`, `miniatura_max_kb`, `envio_atrasado_horas` |
| Álbum 60 por página (máx. 200), ZIP 4 GB | `album.ts` | `album_pagina_padrao`, `album_pagina_max`, `zip_max_gb` |
| Arquivo apagado 30 dias depois | `limpeza.ts` | `remocao_arquivo_dias` |
| Limites de requisição (30/h, 300/min, 600/min, 30/h) | `limites.ts` | `rl_*` |
| Pagamento disponível | `src/lib/config.ts` do front (`PAGAMENTO_DISPONIVEL = false`) | `pacotes_pagos_disponiveis` (**o servidor passa a recusar pacote pago enquanto estiver desligado**) |
| Dimensão (1600 px) e qualidade (0,8) da foto | `src/lib/constants.ts` do front | `foto_dimensao_max_px`, `foto_qualidade_jpeg` (`GET /api/config`) |
| Contato de suporte | não existia (#86) | `contato_suporte` |
| Pausar a criação de eventos | não existia | `criacao_aberta` |

## O que continua no código, de propósito

| O quê | Por quê |
|---|---|
| Parâmetros do scrypt, bloqueio por 5 erros / 15 min, sessão de 8 h, tamanho dos tokens, código de 8 caracteres | Segurança: não devem ser afrouxados por uma tela |
| Estados do evento e as transições permitidas | Regra de produto que o resto do sistema assume; mudar exige código e migração |
| Limite de 65 mil arquivos e 4 GB no ZIP | Limite do formato (sem ZIP64) |
| Intervalo do agendador (1 min), lote da limpeza (200), cache da configuração (10 s) | Detalhe técnico |
| Formato e tamanho do `id` de pacote | Validação de entrada |

## O que o front lê da configuração

O front busca `GET /api/config` ao abrir (e no máximo a cada 5 minutos), com valores de fábrica se o servidor estiver fora ou na api simulada (`src/lib/configPublica.ts`). Cada campo é conferido pelo tipo antes de valer.

| Configuração | Onde aparece |
|---|---|
| `poses_validas`, `poses_padrao` | opções e sugestão de poses na criação do evento (`CreateEvent.tsx`) |
| `pacotes_pagos_disponiveis` | habilita ou bloqueia os pacotes pagos e troca "Em breve" pelo preço (criação e `/precos`) |
| `criacao_aberta` | aviso e botão bloqueado na criação do evento |
| `nome_evento_max`, `apelido_max` | limite dos campos de nome do evento e de apelido do convidado |
| `revelacao_max_dias` | validação e mensagem do prazo da revelação (`criar/horarios.ts`) |
| `foto_dimensao_max_px`, `foto_qualidade_jpeg` | compressão da foto no aparelho (`lib/compress.ts`) |
| `contato_suporte` | contato nas páginas de termos, privacidade e ajuda |

Pacotes (nome, preço, convidados, retenção, poses máx., ordem) vêm de `GET /api/pacotes`. O `id` de pacote criado no admin funciona em `/criar?pacote=<id>`.

## O que ainda está fixo no front

- Textos da landing, do FAQ e dos termos com números ("12, 24 ou 36 poses", "12 meses", "30 dias"): se o admin mudar a retenção ou as poses, esses textos passam a prometer o que não vale mais (#97).
- Regras repetidas na api simulada (`src/lib/api/regras.ts`), usada só em desenvolvimento sem servidor.
- Chaves lidas pelo front mas ainda sem uso em tela: `captura_max_horas`, `revelacao_padrao_horas`, `foto_max_kb`, `miniatura_max_kb`, `envio_atrasado_horas` e `pedido_remocao_motivo_max` (o servidor já aplica todas).

## Mudou um valor, e agora?

- Vale na hora para o servidor (cache de até 10 s). Não precisa de deploy.
- Cuidado com o que afeta promessas já feitas: **retenção** de pacote só vale para eventos novos; **preço** só vale para a próxima compra.
- Em emergência: `criacao_aberta` desligado pausa a criação de eventos; `rl_ativo` desligado libera os limites de requisição.
