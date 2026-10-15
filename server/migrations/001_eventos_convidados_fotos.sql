-- Estados do evento: docs/PLANO-MVP.md seção 3.3.
create table eventos (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique,                 -- link /c/:codigo (longo e aleatório)
  anfitriao_email text not null,
  nome text not null,
  estado text not null default 'rascunho'
    check (estado in ('rascunho','aguardando_pagamento','pronto','captura_aberta',
                      'captura_encerrada','revelado','expirado','cancelado')),
  pacote text not null default 'teste'
    check (pacote in ('teste','festa','celebracao','casamento','grande')),
  limite_convidados integer not null check (limite_convidados > 0),
  poses_por_convidado integer not null default 24 check (poses_por_convidado in (12, 24, 36)),
  limite_fotos integer check (limite_fotos > 0),
  captura_inicio timestamptz,
  captura_fim timestamptz,
  revelacao_em timestamptz,
  revelacao_manual boolean not null default false,
  album_privado boolean not null default false, -- "só eu vejo o álbum"
  revelado_em timestamptz,
  expira_em timestamptz,
  excluido_em timestamptz,                      -- exclusão lógica; fotos somem em até 30 dias
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index eventos_anfitriao_idx on eventos (anfitriao_email);
create index eventos_estado_idx on eventos (estado) where excluido_em is null;

create table convidados (
  id uuid primary key default gen_random_uuid(),
  evento_id uuid not null references eventos(id) on delete cascade,
  token_hash text not null unique,              -- guarda só o hash do token do aparelho
  apelido text,
  criado_em timestamptz not null default now()
);
create index convidados_evento_idx on convidados (evento_id);

create table fotos (
  id uuid primary key default gen_random_uuid(),
  evento_id uuid not null references eventos(id) on delete cascade,
  convidado_id uuid not null references convidados(id) on delete cascade,
  chave_storage text not null unique,
  miniatura_chave text,
  tipo_mime text not null,
  tamanho_bytes integer not null check (tamanho_bytes > 0),
  largura integer,
  altura integer,
  tirada_em timestamptz,                        -- horário no aparelho
  enviada_em timestamptz not null default now(),
  removida_em timestamptz,                      -- apagada pelo anfitrião
  criado_em timestamptz not null default now()
);
create index fotos_evento_idx on fotos (evento_id) where removida_em is null;
create index fotos_convidado_idx on fotos (convidado_id);
