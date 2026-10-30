-- Preço por participante (#178): o evento guarda o valor combinado na criação e aponta para um pacote-marcador.
-- O marcador nunca aparece para o cliente (inativo) e existe só para o evento ter um pacote válido.
alter table eventos add column valor_centavos integer check (valor_centavos > 0);

insert into pacotes (id, nome, convidados, preco_centavos, retencao_dias, poses_max, ativo, ordem)
values ('por_participante', 'Por participante', 5000, 0, 365, 100, false, 0)
on conflict (id) do nothing;
