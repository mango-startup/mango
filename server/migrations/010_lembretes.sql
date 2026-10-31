-- Lembretes por e-mail via n8n (#191, #193): cada evento recebe cada lembrete no máximo uma vez.
alter table eventos add column lembrete_festa_em timestamptz;
alter table eventos add column lembrete_pagamento_em timestamptz;
-- Eventos que já existem não disparam lembretes retroativos.
update eventos set lembrete_festa_em = now(), lembrete_pagamento_em = now();
