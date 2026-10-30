-- Preço dinâmico por participante (#169): uma única linha com os parâmetros publicados pelo admin.
-- Enquanto a cobrança não usa esta tabela, ela só guarda e serve os valores.
create table preco_modelo (
  id smallint primary key default 1 check (id = 1),
  params jsonb not null,
  atualizado_em timestamptz not null default now(),
  atualizado_por text not null
);
