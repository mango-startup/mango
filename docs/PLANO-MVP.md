# Plano do MVP Mango

Pesquisa de concorrentes, jornada, regras de negócio, lacunas até o primeiro evento pago e o planejamento da interface. Nada foi implementado; é a base para os próximos pull requests.

Consultas feitas em 14/10/2026 · Repositório analisado na `main` em `b534de2` · Câmbio de referência usado nas conversões: US$ 1 = R$ 5,50 (premissa, não cotação).

Plano feito com o Claude e aprovado pelo dono para seguir. Decisões marcadas como "PRECISA DE APROVAÇÃO DO RAZIEL" continuam exigindo o OK dele antes de qualquer implementação (dependência nova, API, backend).

## Conteúdo

1. Resumo executivo
2. Pesquisa de concorrentes e modelos de negócio
3. Jornada completa de anfitrião e convidado
4. Regras de negócio propostas
5. Lacunas do MVP e plano de execução
6. Planejamento de UI/UX e arquitetura de telas
7. Decisões que Lucas e Raziel precisam tomar

(No texto original as seções são numeradas 1 a 5 mais as decisões; as referências internas como "3.4" e "4.3" abaixo seguem a numeração original: 1 Pesquisa, 2 Jornada, 3 Regras, 4 Lacunas, 5 UI/UX.)

---

## Resumo executivo

- **O mercado já validou o formato.** POV e Once cobram uma vez por evento, pelo número de convidados, com um nível grátis pequeno. O convidado entra sem instalar nada e sem conta. Nenhum dos dois cobra assinatura.
- **A brecha para o Mango é ser brasileiro de verdade:** preço em reais, Pix, português, suporte por aqui e o anfitrião criando tudo pela web (o Once exige iPhone para o anfitrião; o POV empurra o app para pessoa física).
- **Modelo recomendado:** pagamento único por evento, com o anfitrião pagando. Grátis até 10 convidados; pacotes de R$ 49 (30 convidados), R$ 99 (80) e R$ 199 (200). Os preços são hipóteses a validar.
- **Um link por evento, para sempre.** O mesmo link (e o mesmo QR impresso) abre a câmera durante a festa, a tela de espera depois e o álbum após a revelação.
- **Custo de infraestrutura é irrelevante** perto da taxa de pagamento. Um casamento de 200 convidados, no pior caso, custa menos de US$ 1 em armazenamento por um ano no Cloudflare R2. O que pesa é Pix/cartão, suporte e abuso.
- **O que falta é quase tudo do lado do servidor:** eventos, conta do anfitrião, envio remoto de fotos, pagamento, revelação, álbum e expiração. Estimativa: 41 a 60 dias de desenvolvimento para o bloco obrigatório.
- **Bloqueios antes de começar:** aprovar a stack de backend e os provedores (pagamento, armazenamento, e-mail) com o Raziel, decidir se o convidado vê as próprias fotos antes da revelação e definir quem será o titular da conta de recebimento (CPF ou CNPJ).

---

## 1. Pesquisa de concorrentes e modelos de negócio

Legenda das fontes: **Oficial** (página do próprio produto) · **Secundária** (fonte externa identificável) · **Não confirmado** · **Inferência** (interpretação do autor).

### POV (pov.camera)

Produto americano, o mais estabelecido da categoria (4,9 estrelas com 15 mil avaliações na App Store). O anfitrião pessoa física usa o app iOS/Android; empresas usam o painel web. O convidado entra pelo QR ou link: App Clip no iPhone, página web no Android.

### Once (once.film)

Produto mais novo e de posicionamento "premium e privado". O anfitrião cria o "filme" no app de iPhone; no Android, pela web em join.once.film. Convidado sem instalação e sem cadastro; pode criar conta depois para guardar as fotos.

### Tabela comparativa

| Aspecto | POV | Once |
|---|---|---|
| Fluxo geral | Anfitrião compra e publica o evento, recebe QR personalizado, convidados fotografam, galeria é liberada no horário escolhido. *Oficial pov.camera* | Anfitrião cria o filme, define duração e tipo de momento, compartilha QR/link, todos veem juntos quando o tempo acaba. *Oficial once.film* |
| App para o anfitrião | Pessoa física: app iOS/Android. Empresa: web. *Oficial* | App iOS; Android só pela web enquanto o app não sai. *Oficial* |
| Entrada do convidado | Sem app: App Clip (iOS) ou web (Android). Precisa de internet. *Oficial* | Sem app e sem cadastro, por QR ou link; App Clip ou web. *Oficial* |
| Quem paga | Anfitrião. *Oficial (termos de compra)* | Anfitrião, compra de "capacidade de participantes". *Oficial termos* |
| Grátis | Até 10 convidados. *Oficial preços* | Até 5 convidados. *Oficial preços* |
| Preços | "A partir de US$ 4,99 para até 25 convidados", escalando até 250+. *Oficial blog do POV.* Compras no app: US$ 4,99 a US$ 89,99 ("More Participants"), "Gold" US$ 54,99. *Oficial App Store.* US$ 89,99 para 250 convidados; ~US$ 34,99 acima de 50. *Secundária Knipsmig, jul/2026 (concorrente)* | 10 part. US$ 1,99 · 25 part. US$ 4,99/6,99 · 50 part. US$ 14,99 · 100 part. US$ 29,99 · 150 part. US$ 49,99 · 200 part. US$ 69,99 · +10 part. US$ 3,99 · +50 part. US$ 19,99 · 100 part. com poses ilimitadas US$ 39,99. *Oficial App Store* |
| Modelo de cobrança | Pagamento único por evento. *Secundária (Knipsmig)* · Assinatura não aparece em nenhuma fonte. *Inferência* | Pagamento único por evento; sem assinatura nem renovação. *Oficial* |
| Fotos por convidado | Configurável pelo anfitrião; padrão e máximo não informados. *Oficial* · "Só 25 fotos" citado numa avaliação. *Não confirmado* | Configurável; existe opção paga de poses ilimitadas. *Oficial* · Maquete do site mostra rolo de 20 poses. *Inferência* |
| Limite de convidados | Por faixa: 10, 25, 50, 100, 175, 250, 251+ (sob consulta). *Oficial* | Por faixa: 5 a 200; acima disso, sob consulta. Pode aumentar depois da compra, mesmo com o evento rolando. *Oficial* |
| Duração da câmera | *Não confirmado* | O anfitrião define: "algumas horas, um dia ou uma semana". *Oficial* |
| Revelação | Durante o evento, logo depois ou com atraso; "pode fazer as pessoas esperarem até o dia seguinte". *Oficial (App Store e blog)* | No fim do evento ou em horário personalizado; modo instantâneo ou atrasado. *Oficial (App Store)* |
| Prazo para revelar | *Não confirmado* | *Não confirmado* |
| Retenção do álbum | "As fotos não expiram da sua galeria." *Oficial página de escolas* · Termos não definem prazo e permitem apagar a qualquer momento. *Oficial termos* | "Armazenamento ilimitado" na página de preços; fotos ficam "até o filme ser apagado ou a conta encerrada". *Oficial privacidade* · Termos avisam que o serviço não é backup. *Oficial* |
| Depois da revelação | Baixar, compartilhar, imprimir fotolivro (6x9", capa mole). Anfitrião baixa tudo de uma vez. *Oficial llms.txt* | Anfitrião baixa a galeria inteira "a qualquer momento"; controla quem vê (só ele ou todos). *Oficial* · Vídeo-resumo citado em avaliação. *Não confirmado* |
| Moderação | Anfitrião revê e apaga fotos a qualquer momento, inclusive antes da galeria abrir. *Oficial* | Painel de moderação só no plano empresarial; empresa remove conteúdo que viole os termos. *Oficial* |
| Reembolso | Taxas "não reembolsáveis" salvo o previsto nos termos. *Oficial* | Só se nenhuma foto tiver sido tirada; pedido em até 14 dias. *Oficial* |
| Idade mínima | 13 anos; de 13 até a maioridade, com aceite do responsável. *Oficial* | 13 anos, mesma regra. *Oficial* |
| Extras pagos | Pacote empresarial (marca própria, slideshow ao vivo, suporte 24/7), fotolivro, bloco NFC de madeira. *Oficial* | Poses ilimitadas; plano empresarial (marca, coleta de leads, consentimento personalizado). *Oficial* |
| Infraestrutura declarada | Hospedado nos EUA; Mixpanel e Firebase. *Oficial* | Supabase, RevenueCat, PostHog e Vercel; dados nos EUA. *Oficial* |

Preços em dólar, sem impostos. Lojas de aplicativo podem mostrar preços diferentes por país.

### No Brasil

Não encontrei um produto brasileiro com o mesmo formato e preço público em reais. O mais próximo é o "Registros do Dia" no Casamentos.com.br (convidado envia fotos por QR, sem app, galeria privada, contratação por evento), mas sem preço na página e sem a mecânica de rolo e revelação. *Secundária casamentos.com.br.* Há dezenas de apps estrangeiros parecidos (Lense, Konfetti, Momenta, Scene), todos cobrando em dólar.

### Síntese estratégica

**Práticas que parecem fundamentais**
- Convidado entra em segundos, sem app e sem conta. Os dois concorrentes tratam isso como a primeira promessa.
- Preço por evento e por faixa de convidados, pago pelo anfitrião.
- Limite de poses configurável e revelação com horário escolhido. É o que dá a cara de "descartável".
- Anfitrião com controle: apagar foto, baixar tudo, decidir quem vê.
- QR pronto para imprimir. O convite físico na mesa é o canal de entrada real.

**Escolhas que reduzem o atrito do convidado**
- App Clip no iPhone (nós não teremos: somos web) e página web no resto. *Inferência:* para nós, a página web precisa ser tão rápida quanto um App Clip.
- Conta opcional e só depois, para quem quer guardar as fotos (Once).

**O que incentiva a compra**
- Grátis pequeno (5 ou 10 convidados) que deixa testar num jantar e esbarra no limite numa festa de verdade.
- Aumentar convidados depois da compra, até durante o evento (Once). Evita que o anfitrião compre o pacote errado com medo.
- Reembolso fácil antes da primeira foto (Once). Reduz o risco percebido de comprar com antecedência.

**O que aumenta ou reduz a percepção de valor**
- Aumenta: a revelação em conjunto, o álbum "para sempre", o fotolivro físico, o QR bonito.
- Reduz: preço em dólar no cartão, poucas poses quando a festa engrena, perder fotos por falha de envio.

**Oportunidades para um produto brasileiro**
- Preço em reais e Pix. Em dólar, o cliente paga IOF e câmbio, e muita gente não tem cartão internacional.
- Anfitrião 100% pela web, em qualquer celular. O Once não atende o anfitrião com Android no app.
- Português e suporte local, inclusive por WhatsApp no começo.
- Canal com cerimonialistas, buffets e fotógrafos de casamento (fase posterior).
- Festas brasileiras são grandes: casamento, 15 anos e formatura passam fácil de 150 convidados.

**O que aprender sem copiar:** aprender a mecânica (faixas de convidados, poses configuráveis, revelação agendada, reembolso antes da primeira foto). Não copiar o vocabulário ("film", "develop"), o visual de app americano nem o fotolivro como prioridade. O Mango se diferencia pela identidade editorial, pelo "rolo" com poses de verdade e pela revelação como cerimônia.

**O que alimenta a seção 2**
- Dois papéis distintos: anfitrião paga e administra; convidado só fotografa e vê o álbum.
- Convidado sem conta. Identificação leve por aparelho.
- Revelação com horário escolhido e opção manual.
- Compra antecipada, com reembolso antes da primeira foto.

---

## 2. Jornada completa de anfitrião e convidado

Premissas: as regras recomendadas na seção 3 (um link por evento, convidado sem conta, anfitrião entra por link mágico no e-mail, pagamento único). Prioridade: **MVP** essencial, **Depois** importante em seguida, **Opcional**.

### 2.1 Jornada do anfitrião

| Etapa | Objetivo e ação | Tela ou estado | Dúvida ou risco | Resposta do produto | Backend | Prior. |
|---|---|---|---|---|---|---|
| 1. Descoberta | Ouve falar (convite de outra festa, Instagram) e abre o site. | Landing | "É app? Funciona no meu celular?" | Rodapé de todo álbum e da tela de espera com "Feito com Mango · crie a sua". Landing responde "sem app, só um link". | Atribuição simples (utm no link). | MVP |
| 2. Primeira visita | Entender em 10 segundos. | Landing (já existe) | Animações escondendo a informação; CTA leva à câmera de teste. | CTA "Criar uma câmera" leva ao fluxo de criação, não à câmera local. | — | MVP |
| 3. Entender as regras | Saber quantas fotos, quando revela, por quanto tempo fica. | Seção "Como funciona" + perguntas frequentes | Medo de perder fotos ou de expor convidados. | Regras em frases curtas: poses, revelação, retenção, privacidade. | — | MVP |
| 4. Comparar planos | Escolher pelo tamanho da festa. | /precos | Comprar o pacote errado. | Escolha por número de convidados; aviso de que dá para aumentar depois (fase B: pelo suporte). | Tabela de pacotes no servidor (preço não vem do front). | MVP |
| 5. Identificação | Ter onde voltar para administrar. | /entrar (e-mail → link mágico) | E-mail cai no spam; digitou errado. | Reenviar link; mostrar o e-mail digitado; validade de 15 min. | Usuários, tokens de login de uso único, e-mail transacional. | MVP |
| 6. Criar e configurar | Nome, data, início e fim da câmera, poses por convidado, horário da revelação. | /criar (uma página, poucos campos) | Fuso horário; data no passado; não sabe o que escolher. | Padrões prontos (24 poses, revela às 10h do dia seguinte); pré-visualização do convite. | Evento em rascunho; validação de datas no servidor. | MVP |
| 7. Pagar | Pagar com Pix ou cartão. | Checkout hospedado do provedor | Pix expira; cartão recusado; fecha a aba. | Evento fica em aguardando pagamento e pode retomar o pagamento do painel. Nunca libera pelo retorno do navegador. | Preferência de pagamento, webhook assinado, idempotência por id do evento de pagamento. | MVP |
| 8. Confirmação | Saber que deu certo. | Painel do evento com estado "Pronto" | Webhook atrasado: "paguei e não liberou". | Tela "Confirmando pagamento" que consulta o estado; e-mail de recibo. | Consulta de estado; reconsulta ao provedor se o webhook demorar. | MVP |
| 9. Compartilhar | Mandar o link e imprimir o QR. | Painel: copiar link, baixar QR | Mandar o link do painel em vez do link do convidado. | Link do convidado e acesso do anfitrião visualmente distintos; o painel nunca é acessível pelo link do convidado. | Código público do evento separado do id interno. | MVP (QR em PNG); cartão imprimível: Depois |
| 10. Acompanhar a festa | Ver se o pessoal está usando. | Painel: convidados e fotos tiradas (números, sem ver fotos) | Anfitrião querer espiar as fotos. | Mostrar só contagem antes da revelação; moderação vê as fotos (ver regra 3.4). | Agregados por evento. | Depois |
| 11. Encerrar captura | Fechar a câmera. | Automático no horário de fim; botão "Encerrar agora" | Encerrar sem querer. | Confirmação dentro da página; não dá para reabrir no MVP. | Transição captura aberta → encerrada no servidor; job por horário. | MVP |
| 12. Revelar | Liberar o álbum. | Automático no horário; botão "Revelar agora" | Revelar antes de todos os envios chegarem. | Revelar só depois do encerramento; envios atrasados entram no álbum até 24 h depois. | Job de revelação; estado revelado. | MVP |
| 13. Ver o álbum | Ver tudo, junto com os convidados. | Mesmo link do convite, agora em modo álbum | Álbum lento com centenas de fotos. | Miniaturas e carregamento sob demanda. | Miniaturas geradas no aparelho no envio. | MVP |
| 14. Baixar e gerenciar | Baixar tudo, apagar fotos ruins ou indevidas. | Painel: baixar ZIP, apagar foto | ZIP enorme falhar no celular. | ZIP gerado no servidor em streaming; recomendar computador para eventos grandes. | Endpoint de ZIP em streaming; exclusão lógica imediata. | MVP |
| 15. Expiração | Não ser pego de surpresa. | E-mails 30 e 7 dias antes; aviso no álbum | Perder as fotos. | Datas sempre visíveis no painel e no álbum. | Job de expiração e de avisos. | MVP (aviso de 7 dias); 30 dias: Depois |
| 16. Voltar a usar | Outro evento ou mais tempo. | Painel com lista de eventos; "Criar outro" | — | Extensão de prazo paga: fase C. | Vários eventos por conta. | MVP (lista); extensão: Opcional |

**Exceções do anfitrião**

| Situação | Resposta do produto | Prior. |
|---|---|---|
| Pagamento pendente (Pix não pago) | Evento fica em aguardando pagamento; botão "Pagar agora" gera nova cobrança; rascunhos não pagos somem em 7 dias. | MVP |
| Pagamento recusado | Mensagem do provedor no checkout; volta ao painel com o evento ainda em rascunho e opção de tentar Pix. | MVP |
| Criação incompleta | Rascunho salvo no servidor; painel mostra "Continuar". | MVP |
| Perdeu o acesso de administração | Entrar de novo pelo e-mail. Não existe "link secreto de administração" que possa vazar. | MVP |
| Evento sem convidados | Painel mostra "Ninguém entrou ainda" com o link à mão; perto do fim, sugere estender o horário (Depois). | MVP |
| Quer cancelar | Antes da primeira foto: cancelamento com reembolso integral pelo painel do provedor (operação manual no início). Depois: sem reembolso, salvo o que a lei exigir (ver 3.1). | MVP (manual) |
| Quer excluir o evento | Botão "Excluir evento e fotos" com confirmação digitando o nome; exclusão lógica imediata, definitiva em até 30 dias. | MVP |

> **Nota:** no chat, o Raziel respondeu que prefere o **link secreto do anfitrião** (sem login) para o piloto. O plano acima recomenda link mágico por e-mail (D8). Reconciliar antes de implementar a conta do anfitrião.

### 2.2 Jornada do convidado

| Etapa | Objetivo e ação | Tela ou estado | Dúvida ou risco | Resposta do produto | Backend | Prior. |
|---|---|---|---|---|---|---|
| 1. Receber o convite | Lê o QR na mesa ou recebe o link no WhatsApp. | — | QR mal impresso; link aberto dentro do Instagram. | Link curto (/c/ABC123); QR com margem e tamanho mínimo. | Código curto, sem caracteres ambíguos. | MVP |
| 2. Abrir no celular | Abre e carrega rápido, mesmo com 3G ruim. | /c/:codigo | Carregamento lento; navegador embutido sem câmera. | Página leve; se a câmera ao vivo falhar, usar a câmera do sistema (input capture). | Estado público do evento (nome, data, regras). | MVP |
| 3. Entender as regras | "Quantas fotos? Quando vejo?" | Tela de boas-vindas do evento | Achar que pode ver as fotos na hora. | Três linhas: "Você tem 24 poses. Ninguém vê até a revelação. Revelação: amanhã às 10h." | — | MVP |
| 4. Entrar | Começar sem cadastro. | Campo opcional "Seu nome no álbum" + "Abrir câmera" | Medo de dar dados. | Nome opcional; aceite curto de termos ("Ao entrar, você concorda..."). | Cria token de convidado (cookie + localStorage); conta para o limite de convidados. | MVP |
| 5. Permissão da câmera | Autorizar. | Explicação antes do pedido do navegador | Negou sem querer. | Instrução por navegador para reativar; alternativa pela câmera do sistema. | — | MVP |
| 6. Fotografar | Apertar e seguir a festa. | Câmera (já existe) | Disparo lento; flash; tela apagando. | Disparo imediato, som opcional, contador cai na hora; envio em segundo plano. | Reserva da pose no servidor (limite), URL assinada de upload. | MVP |
| 7. Poses restantes | Saber quanto sobra. | Contador de poses | Contador diferente entre aparelhos. | Contador vem do servidor; offline, mostra o local e sincroniza. | Contagem por token. | MVP |
| 8. Apagar ou repetir | Desfazer uma foto ruim. | — | Quebra a mágica do descartável. | Recomendação: não permitir no MVP (decisão D4). | — | Decisão |
| 9. Falhas | Não perder fotos. | Indicador discreto "3 fotos aguardando envio" | Sem sinal no salão; bateria; aba fechada. | Fila no IndexedDB reenvia ao voltar a conexão e ao reabrir o link; aviso para não limpar o navegador. | Upload idempotente (id da foto gerado no aparelho). | MVP |
| 10. Fim da participação | Rolo acabou ou a câmera fechou. | "Acabou o seu rolo" / "A câmera fechou" | Frustração. | Mostrar quando revela e convidar a voltar no mesmo link. | Estado do evento e do token. | MVP |
| 11. Espera | Entender que ainda não dá para ver. | Tela de espera com contagem regressiva | Achar que deu erro. | "Revelação em 13 h 20 min. 412 fotos no rolo." | Contagem agregada. | MVP |
| 12. Aviso da revelação | Saber que revelou. | Campo opcional de e-mail na tela de espera | Esquecer de voltar. | MVP: o anfitrião avisa no grupo. Depois: e-mail opcional. | E-mail opcional por evento. | Depois |
| 13. Álbum | Ver tudo. | Mesmo link, modo álbum | Lentidão; não achar as próprias fotos. | Revelação breve e pulável; filtro "Minhas fotos" (pelo token). | Lista paginada, miniaturas. | MVP |
| 14. Ver, baixar, compartilhar | Salvar as melhores. | Foto ampliada com "Baixar" e "Compartilhar" | Tocar na foto já baixava (problema atual). | Toque amplia; botões explícitos; Web Share no celular. | URL assinada de leitura. | MVP |
| 15. Remoção | Saber até quando fica. | Linha no álbum: "Disponível até 15/10/2027" | — | Data sempre visível. | — | MVP |

**Exceções do convidado**
- **Outro navegador ou aparelho:** vira um novo convidado com um novo rolo. Isso abre uma brecha de abuso (limpar dados para ganhar poses), controlada pelo teto total do evento (convidados × poses). Aceitável no MVP.
- **Reabriu o link:** mesmo token, mesmo rolo, continua de onde parou e reenvia o que ficou pendente.
- **Evento lotado:** "Este evento atingiu o limite de convidados. Avise quem te convidou." O anfitrião vê o aviso no painel.
- **Link de evento antes do início:** "A câmera abre às 19h."
- **Link de evento expirado:** "Este álbum expirou em 15/10/2027."
- **iPhone apagando dados:** o Safari pode limpar armazenamento de sites pouco visitados. *Inferência a confirmar em teste:* por isso a fila envia na hora e não depende de guardar fotos por dias.

### 2.3 Fluxos

**Anfitrião**

Landing → Preços → Entrar com e-mail → Criar evento (rascunho) → escolhe pacote:
- **Grátis:** evento pronto.
- **Pago:** Checkout Pix ou cartão.
  - Aprovado via webhook → evento pronto.
  - Recusado ou expirado → volta ao rascunho.

Evento pronto → Compartilhar link e QR → Captura aberta → (horário de fim ou "Encerrar agora") → Captura encerrada → (horário ou "Revelar agora") → Álbum revelado → Baixar ZIP, apagar fotos → (fim da retenção) → Expirado.

Alternativa: Cancelar antes da 1ª foto → Cancelado com reembolso.

**Convidado**

Abre /c/código → Estado do evento:
- Antes do início → "A câmera abre às 19h".
- Lotado → "Limite de convidados atingido".
- Captura aberta → Boas-vindas e nome opcional → Permissão da câmera:
  - Negada → Câmera do sistema ou instruções.
  - Aceita → Câmera → foto na fila local:
    - Online → Enviada.
    - Offline → Reenvia depois.
  - Rolo acabou ou captura encerrada → Espera com contagem.
- Revelado → Revelação e álbum → Ampliar, baixar, compartilhar.
- Expirado → "Álbum expirou".

**Ciclo de vida do evento**

`rascunho` → (escolheu pacote pago) `aguardando_pagamento` → (pagamento aprovado por webhook) `pronto`.
`rascunho` → (pacote grátis) `pronto`.
`aguardando_pagamento` → (recusado ou expirado) `rascunho`.
`pronto` → (horário de início) `captura_aberta` → (horário de fim ou encerrar agora) `captura_encerrada` → (horário de revelação ou revelar agora) `revelado` → (fim da retenção) `expirado`.
`pronto` → (cancelou antes da 1ª foto) `cancelado`.

"Excluído" não aparece no fluxo porque pode acontecer a partir de qualquer estado, a pedido do anfitrião (ver 3.3).

**O que alimenta a seção 3**
- O link do convidado precisa funcionar em todos os estados.
- Limites (convidados e poses) só valem se forem checados no servidor.
- O pagamento libera o evento apenas pelo webhook.
- Encerrar, revelar, expirar e excluir são quatro coisas diferentes.

---

## 3. Regras de negócio propostas para o Mango

### 3.1 Modelo de cobrança

- **Quem paga:** o anfitrião. O convidado nunca vê preço nem cadastro.
- **Quando:** na criação, antes de liberar o link. Pode ser com até 12 meses de antecedência.
- **Como:** pagamento único por evento, por faixa de convidados. Sem assinatura: o uso é ocasional (uma ou duas festas por ano), e os dois concorrentes confirmam esse modelo.
- **Plano grátis:** sim, pequeno (ver 3.2). Serve para testar num jantar e para o boca a boca.
- **Liberação:** o evento só sai de `aguardando_pagamento` quando o webhook do provedor confirma, e o servidor reconsulta o pagamento na API antes de aceitar. O retorno do navegador ("pagamento aprovado") só mostra a tela de "confirmando".
- **Reembolso:** integral se nenhuma foto tiver sido tirada (mesma regra do Once). Depois da primeira foto, o serviço já começou a ser prestado.
- **Validar com advogado:** o Código de Defesa do Consumidor (art. 49) dá 7 dias de arrependimento em compras fora do estabelecimento. Um evento que acontece dentro desses 7 dias cria conflito com a regra "sem reembolso após a primeira foto". Recomendação: aceitar arrependimento em 7 dias sem questionar enquanto não houver parecer.
- **Pendências:** Pix não pago expira com a cobrança; o rascunho continua no painel por 7 dias.

### 3.2 Pacotes, limites e preços

| Pacote | Convidados | Poses por convidado | Teto de fotos | Álbum disponível | Preço sugerido |
|---|---|---|---|---|---|
| Teste | 10 | até 12 | 120 | 30 dias | Grátis |
| Festa | 30 | até 36 | 1.080 | 12 meses | R$ 49 |
| Celebração | 80 | até 36 | 2.880 | 12 meses | R$ 99 |
| Casamento | 200 | até 36 | 7.200 | 12 meses | R$ 199 |
| Grande | 200+ | a combinar | — | a combinar | Sob consulta |

- **Poses:** o anfitrião escolhe 12, 24 ou 36, os tamanhos dos rolos de verdade. Padrão: 24.
- **Duração da câmera:** até 48 h de captura aberta, configurável. Evita câmera aberta por semanas (custo e abuso).
- **Revelação:** até 7 dias depois do encerramento; padrão às 10h do dia seguinte. O anfitrião pode revelar antes.
- **Downloads:** qualquer convidado baixa foto a foto; o anfitrião baixa o ZIP completo.
- **Extensões:** mais 12 meses de álbum e aumento de convidados ficam para depois do MVP (no começo, pelo suporte).

**Por que esses preços**
- Referência de mercado (conversão pela premissa de câmbio, sem IOF): Once cobra US$ 29,99 por 100 participantes (≈ R$ 165) e US$ 69,99 por 200 (≈ R$ 385); POV cobra US$ 89,99 por 250 (≈ R$ 495). *Oficial App Store.*
- Os preços do Mango ficam abaixo dos concorrentes convertidos, pagos em reais e via Pix. É uma aposta de entrada no mercado, não um teto.
- Custo variável por evento: menos de R$ 5 de infraestrutura no pior caso (ver 4.3) mais a taxa de pagamento (cerca de 1% no Pix ou 4 a 5% no cartão com recebimento na hora; ver 4.4). A margem bruta passa de 90% em todos os pacotes pagos.
- **Premissas a validar:** disposição a pagar de anfitriões brasileiros (entrevistar 10 a 15 pessoas que fizeram festa no último ano), proporção de uso real das poses, custo de suporte por evento e taxa de reembolso.

### 3.3 Ciclo de vida e estados do evento

| Estado | Como entra | Ações permitidas (quem) | Transições válidas | Proibido | Dados e fotos | Mensagens |
|---|---|---|---|---|---|---|
| rascunho | Anfitrião começa a criar | Editar tudo (anfitrião) | → aguardando_pagamento, → pronto (grátis) | Convidado entrar | Sem fotos; apagado em 7 dias se abandonado | — |
| aguardando_pagamento | Escolheu pacote pago | Pagar, voltar a editar (anfitrião) | → pronto (webhook), → rascunho | Liberar link | Sem fotos | — |
| pronto | Pagamento aprovado ou grátis | Editar horários e poses, compartilhar, cancelar (anfitrião) | → captura_aberta, → cancelado | Reduzir abaixo do pago | Sem fotos | E-mail de recibo e link |
| captura_aberta | Horário de início | Fotografar (convidado); encerrar, apagar foto (anfitrião) | → captura_encerrada | Ver fotos (convidado); mudar poses | Fotos privadas | — |
| captura_encerrada | Horário de fim, botão ou teto atingido | Revelar agora, apagar foto (anfitrião); uploads pendentes por 24 h | → revelado | Novas fotos | Fotos privadas | Tela de espera |
| revelado | Horário de revelação ou botão | Ver e baixar (convidado e anfitrião); ZIP, apagar, tornar privado (anfitrião); pedir remoção (convidado) | → expirado | Voltar a capturar | Álbum visível a quem tem o link | E-mail ao anfitrião; aviso 7 dias antes de expirar |
| expirado | Fim da retenção | Nada (só ver a mensagem) | — | Tudo | Fotos apagadas do armazenamento; metadados mínimos e registro de pagamento mantidos | E-mail de expiração |
| cancelado | Anfitrião cancela antes da 1ª foto | — | — | Tudo | Sem fotos; pagamento estornado | E-mail de cancelamento |
| excluído (marcação) | Anfitrião exclui, a qualquer momento | — | — | Tudo | Some na hora; fotos apagadas em até 30 dias; registro de pagamento mantido pelo prazo fiscal | E-mail de confirmação |

Diferenças que o código precisa respeitar: **encerrar** a captura para de aceitar fotos; **revelar** torna o álbum visível; **expirar** apaga as fotos no fim do prazo combinado; **excluir** é a vontade do anfitrião de apagar antes do prazo.

### 3.4 Privacidade, moderação e retenção

- **Antes da revelação:** ninguém vê as fotos pelo link do convidado. O anfitrião vê na moderação (como o POV), com aviso de que isso estraga a surpresa. (Decisão D5)
- **Depois:** quem tem o link do evento vê o álbum. Um link por evento é prático, mas vaza se for repassado. Controles no MVP: código longo e aleatório, `noindex`, opção "só eu vejo o álbum" e botão para trocar o link (o QR antigo para de funcionar). Senha do álbum: depois.
- **Acesso do anfitrião:** sempre por login (link mágico), nunca por URL secreta. *(Ver nota na seção 2.1: o Raziel preferiu link secreto no piloto.)*
- **Exclusão:** o anfitrião apaga qualquer foto. O convidado pede remoção de foto em que aparece por um botão "Pedir remoção", que vai para o anfitrião e para o suporte.
- **Conteúdo inadequado:** o anfitrião é o primeiro moderador do próprio evento; o Mango age em denúncias e em conteúdo ilegal, com prazo de resposta definido nos termos.
- **Retenção:** 12 meses após a revelação nos pacotes pagos, 30 dias no grátis. Exclusão lógica imediata; definitiva no armazenamento em até 30 dias; backups do banco giram em 30 dias.
- **Metadados:** a câmera já remove EXIF e GPS (canvas novo). Manter assim.
- **Crianças:** festas infantis e de 15 anos são público natural, então fotos de crianças vão aparecer. O ECA Digital (Lei 15.211/2025) está em vigor desde 17/03/2026 e alcança serviços com "acesso provável" por menores. *Secundária Machado Meyer.* O Enunciado ANPD nº 1/2023 admite outras bases legais além do consentimento, sempre no melhor interesse da criança. *Secundária Lefosse.* Proposta de produto: o anfitrião declara ser responsável pelo evento e pelos convites; álbum nunca público ou indexado; remoção rápida a pedido de responsável. **Validar com advogado.**
- **Papel na LGPD:** provavelmente o anfitrião é controlador das fotos do evento e o Mango é operador para as fotos e controlador dos dados de conta e pagamento. **Validar com advogado.**

### 3.5 Decisões recomendadas

| Decisão | Recomendação | Justificativa | Impacto técnico | Premissa a validar |
|---|---|---|---|---|
| Cobrança | Pagamento único por evento, pago pelo anfitrião | Uso ocasional; padrão do mercado | Sem cobrança recorrente | Disposição a pagar |
| Identificação do convidado | Token anônimo por aparelho + nome opcional | Zero atrito | Limites por token; brecha controlada pelo teto do evento | Taxa de abuso real |
| Identificação do anfitrião | Link mágico por e-mail | Sem senha para esquecer; o e-mail também serve para recibos | Provedor de e-mail transacional | Entregabilidade (spam) |
| Limites | Convidados por faixa; poses 12/24/36; teto total | Previsível para o cliente e para o custo | Checagem no servidor a cada foto | Uso médio de poses |
| Revelação | Agendada (padrão: 10h do dia seguinte) + manual; até 7 dias | Mantém a surpresa sem prender o álbum | Job agendado | Preferência dos anfitriões |
| Privacidade do álbum | Link do evento + opção "só eu vejo" + trocar link | Simples e com saída se vazar | Código rotativo | Se os clientes pedem senha |
| Retenção | 12 meses (pago), 30 dias (grátis) | Custo baixo; prazo claro, ao contrário do "para sempre" que ninguém garante | Jobs de aviso e expiração | Se 12 meses parece pouco frente ao "não expira" do POV |
| Reembolso | Integral antes da 1ª foto; 7 dias de arrependimento | Reduz o medo de comprar antes | Estorno manual no início | Parecer jurídico |

**O que alimenta a seção 4**
- Precisamos de servidor com banco, armazenamento de objetos, e-mail, pagamento e jobs agendados.
- Toda regra (limite, estado, acesso) é checada no servidor.
- Termos, privacidade e reembolso precisam estar publicados antes da primeira venda.

---

## 4. Lacunas do MVP comercializável e plano de execução

Premissas das estimativas: dias de desenvolvimento de uma pessoa, incluindo testes e deploy; equipe com experiência em TypeScript e React; sem conhecer a disponibilidade de cada um. São faixas, não compromissos.

### 4.1 Prioridades

**A. Obrigatório para cobrar do primeiro cliente**

| Item | Problema que resolve | Tam. | Dias | Depende de | Risco de adiar | Pronto quando |
|---|---|---|---|---|---|---|
| A1. Fundação do backend | Não existe servidor | M | 4–6 | Aprovação da stack | Bloqueia tudo | API e banco sobem com docker compose, com migrações e deploy pela Action |
| A2. Conta do anfitrião | Quem administra o evento | M | 3–5 | A1, e-mail | Sem dono do evento | Entrar por link mágico; sessão por cookie seguro |
| A3. Evento e estados | Configuração e ciclo de vida | M | 4–6 | A1, A2 | Regras no front, fáceis de burlar | Criar, editar e transicionar estados só pela API, com testes das transições |
| A4. Convite e convidado | Entrar pelo link | P | 2–3 | A3 | — | /c/:codigo mostra o estado certo; token criado; limite de convidados respeitado |
| A5. Captura remota | Fotos hoje ficam só no aparelho | G | 6–9 | A4, armazenamento | O produto não existe sem isso | Foto vai do aparelho ao armazenamento com reenvio; nenhuma foto perdida em teste com modo avião |
| A6. Pagamento | Cobrar | M | 4–6 | A3, conta no provedor | Sem receita | Pix e cartão em sandbox e produção; webhook idempotente; liberação só pelo webhook |
| A7. Revelação | Liberar o álbum | P | 2–3 | A3, A5 | Sem a promessa central | Revelação agendada e manual; tela de espera com contagem |
| A8. Álbum | Entregar o valor | M | 4–6 | A7 | — | Grade com miniaturas, foto ampliada, baixar e compartilhar; ZIP do anfitrião |
| A9. Moderação | Conteúdo indevido | P | 2–3 | A8 | Risco jurídico e de reputação | Anfitrião apaga; convidado pede remoção |
| A10. Expiração e exclusão | Cumprir o prazo prometido | P | 2–3 | A3 | Custo crescente e promessa quebrada | Jobs apagam fotos expiradas e excluídas; aviso de 7 dias por e-mail |
| A11. Termos e políticas | Operar legalmente | P | 2 | Revisão jurídica | Não dá para vender | Termos, privacidade, reembolso e contato publicados e aceitos no fluxo |
| A12. Backup e monitoramento | Não perder dados nem ficar fora do ar sem saber | P | 2–3 | A1 | Perda irreversível | Dump diário do banco fora do servidor, restauração testada uma vez, alerta de queda |
| A13. Testes reais e piloto | Funcionar em festa de verdade | M | 4–5 | Todos | Primeiro cliente vira teste | iPhone (Safari) e Android (Chrome), WhatsApp e Instagram; um evento piloto completo |
| **Total do bloco A** | | | **41–60** | | | Com duas pessoas em tempo integral, cerca de 4 a 6 semanas de calendário. |

**B. Importante, mas pode ser simplificado**

| Item | Versão simples no lançamento | Tam. | Dias |
|---|---|---|---|
| Cartão de QR para imprimir | PNG do QR no MVP; cartão bonito em PDF depois | PP | 1 |
| Aumentar convidados depois da compra | Pelo suporte, com cobrança avulsa manual | P | 2–3 |
| Painel ao vivo (contagem) | Só números, atualizados ao recarregar | PP | 1–2 |
| Aviso de revelação por e-mail ao convidado | Anfitrião avisa no grupo; e-mail opcional depois | P | 2 |
| Reembolso pelo sistema | Feito no painel do provedor, à mão | — | 0 |
| Ambiente de homologação | Segundo docker compose com sandbox do provedor | P | 2 |
| Denúncia de foto | Botão que envia e-mail ao suporte | PP | 1 |

**C. Pode esperar:** slideshow ao vivo, fotolivro impresso, marca personalizada para empresas, vídeo-resumo, app nativo ou App Clip, coanfitriões, conta de convidado, cupons e indicação, parceria com cerimonialistas, filtros de filme, outros idiomas, extensão paga de prazo.

### 4.2 Backend e infraestrutura

**O que existe hoje:** servidor Ubuntu 24.04 com 4 núcleos, 15 GB de RAM e 165 GB livres em disco único; container nginx servindo o build estático; imagem publicada no GHCR pela Action no push da `main`; script de atualização com rollback. Nenhum banco, nenhuma API.

| Peça | Recomendação | Por quê | Aprovação |
|---|---|---|---|
| API | Node 24 + TypeScript num segundo container, com um framework pequeno (Hono) | Mesma linguagem do front; Node 24 já está no Dockerfile | PRECISA DE APROVAÇÃO DO RAZIEL |
| Banco | PostgreSQL em container no mesmo servidor, com volume persistente | Relacional combina com eventos, estados e pagamentos; roda folgado na máquina | PRECISA DE APROVAÇÃO DO RAZIEL |
| Fotos | Cloudflare R2, com upload direto do navegador por URL assinada | Saída gratuita, API S3, tira o tráfego pesado do servidor | PRECISA DE APROVAÇÃO DO RAZIEL |
| Assinatura de URL S3 | Biblioteca pequena (aws4fetch) em vez do SDK da AWS | Uma função, poucos KB | PRECISA DE APROVAÇÃO DO RAZIEL |
| E-mail | Provedor transacional (por exemplo Resend ou Amazon SES); escolher pelo preço vigente | Link mágico, recibo, avisos | PRECISA DE APROVAÇÃO DO RAZIEL |
| Imagens | Compressão e miniatura no aparelho (já existe a compressão); servidor só valida tipo, tamanho (máx. 2 MB) e dimensões | Sem processamento pesado no servidor | — |
| Jobs | Agendador simples dentro da API, rodando a cada minuto (início, fim, revelação, expiração, avisos) | Sem fila nem serviço extra; transições idempotentes | — |
| Fila de envio | Reaproveitar o IndexedDB atual como fila: foto salva, enviada, marcada como enviada | O código de armazenamento local vira resiliência | — |
| Abuso | Limite de requisições por IP e por token, teto de poses e convidados no servidor, tamanho máximo de arquivo | Evita lotar armazenamento | — |
| Backup | pg_dump diário enviado ao R2 (outro bucket), retenção de 30 dias | Disco único no servidor | — |
| Monitoramento | Endpoint de saúde + verificação externa de disponibilidade com alerta; logs estruturados | Saber da queda antes do cliente | Se for serviço pago: PRECISA DE APROVAÇÃO DO RAZIEL |
| Ambientes | Local, homologação e produção no mesmo servidor, em docker compose separados | Simples; nada de nuvem extra | Mudança estrutural: PRECISA DE APROVAÇÃO DO RAZIEL |

**Alternativa que merece comparação: Supabase** (banco, autenticação e armazenamento gerenciados, o que o Once usa). Corta talvez 1 a 2 semanas do bloco A, mas adiciona custo mensal, dependência de fornecedor e dados fora do servidor que vocês já operam. Recomendação do plano: caminho próprio, porque a infraestrutura de deploy já existe e o volume inicial é pequeno.

**Por que não guardar as fotos no disco do servidor:** o disco é único (sem redundância), um erro de volume num deploy apaga tudo, o backup das fotos teria que ser montado à parte, e todo download de álbum passaria pela banda do servidor. Com 165 GB livres caberiam cerca de 75 casamentos no pior caso, então o espaço não é o problema; a confiabilidade é.

> **Nota:** no chat, o Raziel disse que, por agora, a VPS dá certo para guardar as fotos, e que um serviço externo pode ser avaliado depois. Se começar na VPS, deixar o armazenamento atrás de uma interface (`salvar`, `ler`, `apagar`) para trocar por R2 sem mexer no resto, e garantir backup das fotos.

**O que o backend valida, mesmo que a interface esconda:** estado do evento em cada ação, dono do evento, limite de convidados e de poses, pagamento confirmado, acesso ao álbum (revelado, não privado, não expirado) e tamanho e tipo de arquivo.

### 4.3 Armazenamento e custo por evento

Premissas: foto comprimida de ~400 KB (1600 px, JPEG 0,8) mais miniatura de ~50 KB, total 0,45 MB; uso real de 50% das poses e pior caso de 100%; 24 poses; álbum guardado 12 meses; cada convidado abre todas as miniaturas e 20% das fotos ampliadas. Preços do R2: armazenamento US$ 0,015/GB-mês, gravação US$ 4,50 por milhão, leitura US$ 0,36 por milhão, saída gratuita, 10 GB grátis por mês. *Oficial Cloudflare R2.*

| Cenário | Convidados | Fotos (real / pior) | Volume (real / pior) | Custo em 12 meses, pior caso |
|---|---|---|---|---|
| Pequeno | 30 | 360 / 720 | 0,16 / 0,32 GB | ≈ US$ 0,07 (R$ 0,40) |
| Médio | 80 | 960 / 1.920 | 0,43 / 0,86 GB | ≈ US$ 0,24 (R$ 1,30) |
| Grande | 200 | 2.400 / 4.800 | 1,08 / 2,16 GB | ≈ US$ 0,85 (R$ 4,70) |

No evento grande, metade do custo é leitura (1,15 milhão de miniaturas vistas). Servir o bucket por domínio próprio atrás do cache da Cloudflare reduz isso. Os primeiros 10 GB mensais grátis cobrem os primeiros dezenas de eventos.

Comparação: Backblaze B2 cobra US$ 6,95/TB-mês com saída grátis até 3 vezes o volume armazenado. *Oficial Backblaze.* É mais barato para guardar, mas a diferença é de centavos por evento e o R2 não cobra saída em nenhum caso. Recomendação: R2.

O custo que importa: taxa de pagamento (R$ 1 a R$ 5 por venda de R$ 99), e-mail (centavos), servidor (já pago) e, principalmente, tempo de suporte.

### 4.4 Pagamentos no Brasil

| Provedor | Pix | Cartão à vista | Fonte |
|---|---|---|---|
| Mercado Pago (Checkout Pro) | 0,99% | 4,98% na hora · 4,49% em 14 dias · 3,99% em 30 dias | *Secundária* guia de fev/2025; a página oficial bloqueou a leitura. Confirmar no painel da conta. |
| Asaas | R$ 1,99 por Pix (R$ 0,99 nos 3 primeiros meses) | 2,99% + R$ 0,49 (1,99% + R$ 0,49 nos 3 primeiros meses) | *Oficial* asaas.com |
| Stripe Brasil | 1,19%, só por convite | 3,99% + R$ 0,39 | *Oficial* stripe.com |

**Recomendação: Mercado Pago Checkout Pro** (PRECISA DE APROVAÇÃO DO RAZIEL)
- Página de pagamento hospedada: o Mango nunca toca em dado de cartão.
- Pix, cartão e saldo Mercado Pago, marca que o consumidor brasileiro conhece.
- Pix percentual de ~1% é mais barato que a tarifa fixa do Asaas nos tíquetes de R$ 49 a R$ 199.
- Integração por API REST e webhook, sem SDK obrigatório.
- Ponto fraco: as taxas não foram confirmadas em fonte oficial nesta pesquisa. Se o cartão na hora vier perto de 5%, o Asaas vira a melhor opção para cartão; as taxas dele estão confirmadas e o webhook tem fila de reenvio por 14 dias documentada. *Oficial docs Asaas.*

**Fluxo de liberação**
1. Anfitrião escolhe o pacote; a API cria a cobrança com o preço do servidor e guarda o id externo ligado ao evento.
2. Navegador vai ao checkout hospedado.
3. Provedor chama o webhook. A API valida a assinatura, grava o id do evento de pagamento (se já existe, responde 200 e para), reconsulta o pagamento na API do provedor e só então muda o evento para `pronto`.
4. O retorno do navegador mostra "Confirmando pagamento" e consulta o estado até mudar.
5. Conciliação: job diário compara pagamentos aprovados no provedor com eventos `pronto` e alerta divergências.
6. Reembolso: no painel do provedor no início; o webhook de estorno muda o evento para `cancelado`.

**Pendência que bloqueia:** conta em nome de quem? Pessoa física (CPF) funciona para testar, mas vender de forma recorrente pede CNPJ. Se um MEI cobre esta atividade é pergunta para o contador. **Validar com contador.**

### 4.5 Aspectos legais e operacionais

| Item | Precisa de jurídico? | Boa prática de produto |
|---|---|---|
| Termos de uso | Sim | Responsabilidade do anfitrião pelo evento e pelos convidados; conteúdo proibido; idade mínima |
| Política de privacidade | Sim | Linguagem simples; lista de fornecedores (R2, provedor de pagamento, e-mail); onde os dados ficam |
| Aviso ao convidado | Revisão | Uma linha na entrada com link para a política |
| Fotos de crianças | Sim | Álbum nunca público; remoção rápida a pedido do responsável |
| Pedidos de titulares (LGPD) | Revisão | E-mail de contato com prazo de resposta definido; registro dos pedidos |
| Cancelamento e reembolso | Sim (CDC art. 49) | Regra visível antes de pagar |
| Incidente de segurança | Revisão | Procedimento escrito: conter, avaliar, avisar clientes e a ANPD quando aplicável |
| Atividade comercial | Contador | CNPJ, emissão de nota fiscal de serviço, guarda de registros de pagamento |
| Contato e suporte | Não | E-mail exibido como texto e WhatsApp no começo |

Publicar uma política e coletar um aceite não torna o produto conforme à LGPD. O que conta é o que o sistema faz de verdade: coletar pouco, apagar no prazo e atender pedidos.

### 4.6 Roteiro

| Marco | Resultado | Pronto quando | Bloqueio para começar |
|---|---|---|---|
| 0. Decisões | Respostas da lista final; entrevistas com anfitriões | Regras e provedores aprovados | — |
| 1. Fundação | API, banco, R2, deploy (A1, A12) | API em produção com saúde e backup | Aprovação da stack pelo Raziel |
| 2. Evento e captura | Conta, evento, convite, captura remota (A2–A5) | Evento grátis de ponta a ponta até a captura, testado com modo avião | Marco 1 |
| 3. Revelação e álbum | A7, A8, A9, A10 | Evento grátis completo, da criação à expiração simulada | Marco 2 |
| 4. Pagamento | A6 | Pacote pago liberado só pelo webhook, em sandbox e com uma compra real de teste | Conta no provedor (CPF/CNPJ) |
| 5. Lançamento | A11, A13, itens B escolhidos | Termos publicados, piloto feito, primeiro cliente pago | Revisão jurídica |

O pagamento vem depois do álbum de propósito: um evento grátis completo já valida a experiência com amigos enquanto a conta do provedor e o jurídico andam em paralelo.

**O que alimenta a seção 5**
- Uma rota de convidado que muda conforme o estado do evento.
- Telas novas: preços, entrar, criar, painel, confirmação de pagamento, espera, álbum, foto ampliada, termos.
- Estados de rede e de envio precisam aparecer na câmera.

---

## 5. Planejamento de UI/UX e arquitetura de telas

Skills usadas: `frontend-design` e `interface-design`. Nenhuma tela foi alterada.

### 5.1 O que existe

| Peça | Estado | Reaproveitar? |
|---|---|---|
| Rotas /, /camera, /galeria | React Router 7 com BrowserRouter | Sim; /camera e /galeria viram partes de /c/:codigo |
| CameraView | Câmera traseira, cantoneiras de visor, disparo de 72 px, erros de permissão tratados | Sim, quase inteiro |
| compress.ts | 1600 px, JPEG 0,8, sem EXIF | Sim; acrescentar miniatura |
| storage.ts (IndexedDB) | Galeria local | Sim, como fila de envio |
| Landing | Mobile e desktop, animações de entrada, quadros que revelam ao toque | Sim; trocar o destino do CTA para /criar |
| Tokens | base, surface, line, paper, muted | Sim; faltam tokens de erro e de foco sobre o creme |

**Inconsistências a corrigir junto com as telas novas**
- Tocar numa foto da galeria baixa o arquivo em vez de ampliar; o link da foto não tem nome acessível.
- Alvos de toque pequenos ("Câmera" 57×23, excluir 36×36) e excluir com emoji.
- O anel de foco é creme e some sobre o bloco creme da landing.
- Vermelhos de erro vêm direto do Tailwind, fora do sistema.
- Rodapé da landing mostra "mango.cam", que não é o domínio atual.
- Animações infinitas (brilho do botão e quadros flutuando) disputam atenção e custam em celulares fracos; vale reavaliar com o Raziel. Baixa prioridade.

### 5.2 Direção

**Quem usa:** o anfitrião organiza pelo celular, dias antes, entre outras tarefas da festa; o convidado está em pé, com bebida na mão, luz baixa, sinal ruim e pressa de voltar para a pista.

**O mundo do produto:** rolo de filme, contador de poses, envelope do laboratório, quarto escuro, folha de contato, ampliação. As cores existem nesse mundo: o preto do quarto escuro (a base), o creme do papel fotográfico (o bloco creme), o cinza do negativo. A paleta atual já veio daí; não é preciso mudar.

**Assinatura:** o contador de poses. Na câmera descartável, o número na janelinha é a única interface. No Mango ele aparece em DM Serif, com algarismos tabulares, na câmera, na espera e no painel, sempre como "poses", nunca como "fotos restantes".

**Padrões que vamos evitar:**
- Painel do anfitrião com cards de métricas → uma "ficha do evento", como o envelope do laboratório: nome, data, estado e uma única próxima ação.
- Galeria em mosaico genérico → folha de contato: grade regular com número do quadro e o nome de quem fotografou.
- Assistente de criação em cinco passos → uma página só, com padrões prontos e as escolhas que importam visíveis.

### 5.3 Telas do MVP

| Tela | Para | Objetivo e informação principal | Ações | Estados alternativos | Origem → destino | Backend | Prior. |
|---|---|---|---|---|---|---|---|
| Landing / (existe) | Anfitrião | Entender e querer | Criar uma câmera, ver preços | — | Externo → /precos, /criar | — | MVP |
| Preços /precos (nova) | Anfitrião | Escolher pelo número de convidados | Escolher pacote | — | Landing → /criar | Pacotes | MVP |
| Entrar /entrar (nova) | Anfitrião | Receber o link mágico | Enviar link, reenviar | Link expirado, e-mail inválido | /criar ou /eventos → e-mail → /eventos | Auth | MVP |
| Criar /criar (nova) | Anfitrião | Nome, data, horários, poses, revelação, pacote | Continuar para pagamento ou criar grátis | Datas inválidas, sessão expirada (rascunho salvo) | /precos → checkout ou painel | Evento | MVP |
| Confirmando pagamento /eventos/:id/pagamento (nova) | Anfitrião | "Recebemos? Ainda não?" | Tentar de novo, pagar com Pix | Pendente, recusado, demorando | Checkout → painel | Estado do pagamento | MVP |
| Meus eventos /eventos (nova) | Anfitrião | Lista de fichas | Abrir, criar outro | Vazio | Entrar → painel | Eventos do usuário | MVP |
| Painel /eventos/:id (nova) | Anfitrião | Estado, link, QR, contagem, próxima ação | Copiar link, baixar QR, encerrar, revelar, moderar, ZIP, privacidade, excluir | Um bloco por estado do evento | Meus eventos → álbum | Evento, fotos, agregados | MVP |
| Convite /c/:codigo (nova, várias vistas) | Convidado (e anfitrião) | Tudo do convidado numa rota: boas-vindas, câmera, espera, álbum, expirado | Depende da vista | Antes do início, lotado, câmera negada, offline, expirado | QR ou link → mesma rota sempre | Estado público, token, upload, álbum | MVP |
| Foto ampliada /c/:codigo/f/:foto (nova) | Ambos | Ver a foto grande | Baixar, compartilhar, anterior/próxima, pedir remoção | Foto removida | Álbum ↔ foto | URL assinada | MVP |
| Termos, privacidade, ajuda (novas) | Todos | Regras e contato | — | — | Rodapés | — | MVP |

As vistas de `/c/:codigo` são estados da mesma página, não rotas separadas. Assim o QR impresso nunca quebra e o convidado não precisa de outro link para o álbum.

### 5.4 Navegação e acesso

- **Públicas:** `/` (landing), `/precos`, `/termos`, `/privacidade`.
- **Anfitrião (exigem login):** `/entrar`, `/eventos`, `/criar`, `/eventos/:id/pagamento`, `/eventos/:id`. A API confere se o evento é do usuário.
- **Convite (link público do evento):** `/c/:codigo` e `/c/:codigo/f/:foto`. Qualquer pessoa com o código; a API decide o que mostrar pelo estado do evento.
- **Álbum:** mesma rota do convite, liberada só se revelado, não privado e não expirado. A interface esconde, mas quem barra é a API.

Fluxo: Landing → /precos → /criar → /eventos/:id/pagamento → /eventos/:id → (copia o link) → /c/:codigo → /c/:codigo/f/:foto. `/entrar` fica antes de `/criar` e `/eventos`.

### 5.5 Direção visual por momento

| Momento | Como a identidade aparece |
|---|---|
| Descoberta e compra | Landing atual. Preços em bloco creme, com o número de convidados em DM Serif grande e o preço em segundo plano. |
| Preparação | Fundo escuro, formulário curto, pré-visualização do convite em creme ao lado (no celular, abaixo). A ficha do evento usa a mesma linguagem do convite. |
| Captura | Tudo some menos o visor, o disparador e o contador de poses. Alvos grandes, alto contraste, nada de texto pequeno. Estado de envio num ponto discreto, nunca um banner que cubra o visor. |
| Espera | Quarto escuro: contagem regressiva grande em DM Serif e o total de fotos do rolo. Nenhuma miniatura. |
| Revelação | Um único momento orquestrado: os quadros aparecem na folha de contato em sequência rápida (30 a 50 ms entre quadros), começando pela primeira foto da noite. Botão "Pular" visível desde o início. Com movimento reduzido ou em aparelho lento, o álbum aparece direto. |
| Álbum | Folha de contato em fundo escuro, número do quadro e autor em texto pequeno, foto ampliada em tela cheia com ações claras. Data de expiração no rodapé. |

### 5.6 Esboços das telas principais

Esboços de estrutura, não de estilo. Premissas: regras da seção 3.

```
CONVITE · BOAS-VINDAS
┌───────────────────────────┐
│ ▮ mango                   │
│                           │
│ Casamento da Ana e do Léo │
│ sáb, 14 de nov            │
│                           │
│ Você tem 24 poses.        │
│ Ninguém vê até a          │
│ revelação: dom, 10h.      │
│                           │
│ Seu nome no álbum         │
│ [ Marina           ]      │
│                           │
│ [    Abrir a câmera    ]  │
│ Ao entrar, você concorda  │
│ com os termos.            │
└───────────────────────────┘
```

```
CONVITE · CÂMERA
┌───────────────────────────┐
│ ▮ mango            17     │
│                  poses    │
│ ┌───────────────────────┐ │
│ │⌜                     ⌝│ │
│ │                       │ │
│ │        (visor)        │ │
│ │                       │ │
│ │⌞                     ⌟│ │
│ └───────────────────────┘ │
│                           │
│ • 2 aguardando envio      │
│            ( ◉ )          │
└───────────────────────────┘
```

```
CONVITE · ESPERA
┌───────────────────────────┐
│ ▮ mango                   │
│                           │
│ Revelação em              │
│                           │
│   13:20:04                │
│                           │
│ 412 fotos no rolo.        │
│ Volte neste mesmo link.   │
│                           │
│ Suas fotos: 24 enviadas   │
│                           │
│ ───────────────────────── │
│ Feito com Mango ·         │
│ crie a sua                │
└───────────────────────────┘
```

```
CONVITE · ÁLBUM (FOLHA DE CONTATO)
┌───────────────────────────┐
│ Casamento da Ana e do Léo │
│ 412 fotos · 63 pessoas    │
│ [Todas] [Minhas]          │
│ ┌────┐┌────┐┌────┐        │
│ │    ││    ││    │        │
│ └────┘└────┘└────┘        │
│ 001    002    003         │
│ ┌────┐┌────┐┌────┐        │
│ │    ││    ││    │        │
│ └────┘└────┘└────┘        │
│ 004    005    006         │
│ Disponível até 15/11/2027 │
└───────────────────────────┘
```

```
PAINEL DO ANFITRIÃO (FICHA)
┌───────────────────────────┐
│ ← Meus eventos            │
│ Casamento da Ana e do Léo │
│ ● Câmera aberta até 2h    │
│                           │
│ 63 de 80 convidados       │
│ 412 fotos                 │
│                           │
│ Link do convidado         │
│ mango.../c/K7P2QD [Copiar]│
│ [Baixar QR]               │
│                           │
│ [   Encerrar a câmera   ] │
│ Revelação: dom, 10h       │
│ [Revelar agora]           │
│ ───────────────────────── │
│ Moderar fotos · Excluir   │
└───────────────────────────┘
```

```
CRIAR EVENTO
┌───────────────────────────┐
│ Nova câmera               │
│ Nome do evento            │
│ [                    ]    │
│ Data       Início   Fim   │
│ [14/11]    [19:00] [02:00]│
│ Poses por convidado       │
│ ( 12 ) (•24 ) ( 36 )      │
│ Revelação                 │
│ (•Dia seguinte, 10h)      │
│ ( Escolher horário )      │
│ Convidados                │
│ ( 10 grátis ) (•30 R$49 ) │
│ ( 80 R$99 ) ( 200 R$199 ) │
│ [  Continuar · R$ 49   ]  │
└───────────────────────────┘
```

### 5.7 Componentes compartilhados

- **Contador de poses:** câmera, espera, painel.
- **Ficha do evento:** painel e lista de eventos.
- **Quadro:** miniatura com número e autor; usado na folha de contato, na landing e na moderação.
- **Indicador de envio:** ponto com contagem pendente; um único lugar na câmera.
- **Bloco de estado:** mensagem + próxima ação para cada estado do evento (antes do início, lotado, expirado, erro).
- **Confirmação na página:** substitui `confirm()` para encerrar, revelar e excluir.

**O que alimenta a implementação**
- Rotas: `/precos`, `/entrar`, `/criar`, `/eventos`, `/eventos/:id`, `/c/:codigo`.
- Primeiro PR de interface sugerido: vistas de `/c/:codigo` com dados de exemplo, reaproveitando `CameraView`.

---

## 6. Decisões que Lucas e Raziel precisam tomar

Em ordem de impacto e dependência.

### D1. Aprovamos a stack de backend: API em Node/TypeScript (Hono), PostgreSQL em container e fotos no Cloudflare R2?
- **Recomendação:** sim. **Motivo:** mesma linguagem do front, roda no servidor que já existe e o R2 não cobra saída. **Impacto:** bloqueia todo o bloco A. **Aprovação:** PRECISA DE APROVAÇÃO DO RAZIEL.
- *Resposta parcial do Raziel no chat:* fotos na VPS por agora, com possível serviço externo depois. Falta confirmar API e banco.

### D2. Qual provedor de pagamento: Mercado Pago Checkout Pro ou Asaas?
- **Recomendação:** Mercado Pago, depois de conferir as taxas no painel da conta. **Motivo:** checkout hospedado, Pix percentual barato nos nossos tíquetes, marca conhecida. **Impacto:** marco 4; define o formato do webhook. **Aprovação:** PRECISA DE APROVAÇÃO DO RAZIEL.

### D3. A conta de recebimento fica em CPF de alguém ou abrimos CNPJ antes de vender?
- **Recomendação:** abrir CNPJ antes do primeiro cliente pago; testar com CPF só em sandbox. **Motivo:** nota fiscal, separação de responsabilidade e conta do provedor sem limite de PF. **Impacto:** bloqueia o marco 4 em produção. **Aprovação:** decisão dos dois.

### D4. O convidado pode apagar ou ver as próprias fotos antes da revelação?
- **Recomendação:** não. Só o contador de poses. **Motivo:** é o que torna o Mango uma câmera descartável e não mais um app de fotos. **Impacto:** remove a galeria local atual do fluxo do convidado. **Aprovação:** decisão de produto dos dois.

### D5. O anfitrião vê as fotos antes da revelação (para moderar)?
- **Recomendação:** sim, numa tela de moderação separada e com aviso de que estraga a surpresa. **Motivo:** responsabilidade por conteúdo indevido em festa com crianças; o POV faz igual. **Impacto:** mais uma tela no painel (A9). **Aprovação:** decisão de produto dos dois.

### D6. Os pacotes e preços de lançamento são Grátis (10), R$ 49 (30), R$ 99 (80) e R$ 199 (200)?
- **Recomendação:** sim, como hipótese, revisada depois de 10 a 15 entrevistas. **Motivo:** abaixo dos concorrentes convertidos e com margem alta. **Impacto:** tabela de pacotes no servidor e tela de preços. **Aprovação:** decisão dos dois.

### D7. O álbum fica disponível 12 meses (pago) e 30 dias (grátis)?
- **Recomendação:** sim. **Motivo:** prazo claro que dá para cumprir; o custo de guardar é baixo, o de prometer "para sempre" não. **Impacto:** jobs de aviso e expiração; textos dos termos. **Aprovação:** decisão dos dois.

### D8. O anfitrião entra por link mágico no e-mail, e qual provedor de e-mail usamos?
- **Recomendação:** link mágico; provedor escolhido pelo preço vigente entre Resend e Amazon SES. **Motivo:** sem senha, e o mesmo e-mail serve para recibos e avisos. **Impacto:** A2 e todos os avisos. **Aprovação:** PRECISA DE APROVAÇÃO DO RAZIEL.
- *Resposta parcial do Raziel no chat:* prefere link secreto do anfitrião (sem login) no piloto. Reconciliar.

### D9. Um único link por evento serve para câmera, espera e álbum?
- **Recomendação:** sim, com opção de trocar o link e de deixar o álbum só para o anfitrião. **Motivo:** QR impresso nunca quebra; nada novo para o convidado decorar. **Impacto:** estrutura de rotas (`/c/:codigo`). **Aprovação:** decisão de produto dos dois.

### D10. Contratamos uma revisão jurídica de termos, privacidade e reembolso antes do primeiro cliente?
- **Recomendação:** sim, focada em CDC art. 49, LGPD e ECA Digital. **Motivo:** fotos de crianças e arrependimento de 7 dias são riscos reais e específicos deste produto. **Impacto:** bloqueia o marco 5. **Aprovação:** decisão dos dois (tem custo).

---

## Fontes

- pov.camera: preços, termos, privacidade, llms.txt, escolas, blog, App Store.
- once.film: preços, termos, privacidade, App Store.
- Knipsmig, preços verificados em jul/2026 (concorrente dos dois; usado só como fonte secundária).
- Registros do Dia, Casamentos.com.br.
- Cloudflare R2, preços · Backblaze B2, preços.
- Asaas, taxas · Asaas, webhooks · Stripe Brasil, preços · taxas do Mercado Pago (guia de fev/2025).
- ECA Digital, Machado Meyer · Enunciado ANPD nº 1/2023, Lefosse.
