-- Pagamentos com Stripe: uma linha por Checkout Session. O evento só sai de "aguardando pagamento" pelo webhook.
create table pagamentos (
  id uuid primary key default gen_random_uuid(),
  evento_id uuid not null references eventos (id) on delete cascade,
  stripe_session_id text not null unique,
  stripe_payment_intent_id text,
  valor_centavos integer not null check (valor_centavos > 0),  -- o que o servidor cobrou; o webhook confere contra isso
  moeda text not null default 'brl',
  status text not null default 'pendente'
    check (status in ('pendente', 'aprovado', 'recusado', 'expirado', 'estornado', 'aprovado_orfao')),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index pagamentos_evento_idx on pagamentos (evento_id, criado_em desc);
create index pagamentos_intent_idx on pagamentos (stripe_payment_intent_id) where stripe_payment_intent_id is not null;

-- Ids dos eventos do Stripe já processados: a mesma entrega pode chegar mais de uma vez.
create table stripe_eventos (
  id text primary key,
  tipo text not null,
  recebido_em timestamptz not null default now()
);
