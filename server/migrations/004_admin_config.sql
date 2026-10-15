-- Área de admin: pacotes e configurações no banco (antes fixos no código), admins, sessões e auditoria.

-- Pacotes: nome, preço e limites editáveis. Os quatro de hoje entram com os valores atuais.
create table pacotes (
  id text primary key check (id ~ '^[a-z][a-z0-9_]{1,29}$'),
  nome text not null check (char_length(nome) between 1 and 40),
  convidados integer not null check (convidados > 0),
  preco_centavos integer not null check (preco_centavos >= 0),
  retencao_dias integer not null check (retencao_dias > 0),
  poses_max integer not null check (poses_max > 0),
  ativo boolean not null default true,
  ordem integer not null default 0,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
insert into pacotes (id, nome, convidados, preco_centavos, retencao_dias, poses_max, ordem) values
  ('teste',      'Teste',      10,     0,  30, 12, 1),
  ('festa',      'Festa',      30,  4900, 365, 36, 2),
  ('celebracao', 'Celebração', 80,  9900, 365, 36, 3),
  ('casamento',  'Casamento', 200, 19900, 365, 36, 4);

-- O evento passa a apontar para o pacote (qualquer id novo) e a poses livres; as regras ficam na aplicação.
alter table eventos drop constraint if exists eventos_pacote_check;
alter table eventos drop constraint if exists eventos_poses_por_convidado_check;
alter table eventos add constraint eventos_poses_positivas check (poses_por_convidado > 0);
alter table eventos add constraint eventos_pacote_fk foreign key (pacote) references pacotes (id);

-- Retenção do álbum é gravada no evento ao criar: mudar o pacote depois não muda a promessa já feita.
alter table eventos add column retencao_dias integer;
update eventos set retencao_dias = case when pacote = 'teste' then 30 else 365 end;
alter table eventos alter column retencao_dias set not null;

-- Só o que foi alterado pelo admin; o resto vale o padrão do código (src/configuracao.ts).
create table configuracoes (
  chave text primary key,
  valor jsonb not null,
  atualizado_em timestamptz not null default now(),
  atualizado_por uuid
);

create table admins (
  id uuid primary key default gen_random_uuid(),
  usuario text not null unique check (usuario ~ '^[a-z0-9._-]{3,30}$'),
  nome text not null,
  senha_hash text not null,
  trocar_senha boolean not null default true,   -- senha inicial/temporária: obriga trocar no próximo login
  tentativas_falhas integer not null default 0,
  bloqueado_ate timestamptz,
  ultimo_login_em timestamptz,
  criado_em timestamptz not null default now()
);

create table admin_sessoes (
  token_hash text primary key,                  -- só o hash do cookie fica no banco
  admin_id uuid not null references admins (id) on delete cascade,
  criado_em timestamptz not null default now(),
  expira_em timestamptz not null
);
create index admin_sessoes_admin_idx on admin_sessoes (admin_id);

create table auditoria_admin (
  id bigserial primary key,
  admin_id uuid references admins (id) on delete set null,
  usuario text not null,
  acao text not null,
  alvo text,
  antes jsonb,
  depois jsonb,
  criado_em timestamptz not null default now()
);
create index auditoria_admin_criado_idx on auditoria_admin (criado_em desc);
