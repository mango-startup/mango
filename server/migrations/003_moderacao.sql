-- Moderação (plano, itens A9 e A10): remoção definitiva dos arquivos e pedidos de remoção.
alter table fotos add column arquivo_apagado_em timestamptz;   -- quando os arquivos saíram do armazenamento
create index fotos_limpeza_idx on fotos (removida_em) where arquivo_apagado_em is null;

create table pedidos_remocao (
  id uuid primary key default gen_random_uuid(),
  evento_id uuid not null references eventos(id) on delete cascade,
  foto_id uuid not null references fotos(id) on delete cascade,
  solicitante text not null,                 -- 'c:<convidado_id>' ou 'ip:<hash curto>': um pedido por pessoa e foto
  motivo text,
  resolucao text check (resolucao in ('removida', 'mantida')),
  resolvido_em timestamptz,
  criado_em timestamptz not null default now(),
  unique (foto_id, solicitante)
);
create index pedidos_remocao_pendentes_idx on pedidos_remocao (evento_id) where resolvido_em is null;
