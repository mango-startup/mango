-- Preço por participante virou o padrão (#178): os pacotes fixos saem de venda. Os eventos já criados continuam
-- apontando para eles (histórico, pagamentos e relatórios); só deixam de aparecer para quem cria evento novo.
update pacotes set ativo = false where id in ('festa', 'celebracao', 'casamento');
