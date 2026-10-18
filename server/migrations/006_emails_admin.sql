-- E-mails que os admins mandam aos anfitriões (histórico, para ninguém escrever duas vezes sem saber).
create table emails_admin (
  id uuid primary key default gen_random_uuid(),
  evento_id uuid not null references eventos (id) on delete cascade,
  admin_id uuid references admins (id) on delete set null,
  usuario text not null,
  destinatario text not null,
  assunto text not null,
  corpo text not null,
  status text not null check (status in ('enviado', 'falhou')),
  erro text,
  criado_em timestamptz not null default now()
);
create index emails_admin_evento_idx on emails_admin (evento_id, criado_em desc);
