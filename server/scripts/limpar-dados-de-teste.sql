-- Limpeza dos dados da época de teste: apaga TODOS os eventos e, em cascata, convidados, fotos (registros),
-- pedidos de remoção, e-mails enviados e pagamentos. Mantém: admins, sessões, auditoria, configurações, pacotes,
-- preço publicado e os avisos já processados do Stripe.
--
-- Os arquivos das fotos ficam em data/fotos (disco); apague-os à parte, DEPOIS de confirmar o COMMIT.
-- Como rodar (faça o backup antes):
--   /srv/apps/mango/backup.sh /caminho/do/backup
--   docker exec -i mango-db psql -U mango -d mango -v ON_ERROR_STOP=1 < server/scripts/limpar-dados-de-teste.sql
-- Por padrão termina em ROLLBACK (só mostra o que apagaria). Para valer, troque a última linha por COMMIT.

begin;

\echo '== Antes'
select (select count(*) from eventos) as eventos, (select count(*) from convidados) as convidados,
       (select count(*) from fotos) as fotos, (select count(*) from pagamentos) as pagamentos,
       (select count(*) from pedidos_remocao) as pedidos_remocao, (select count(*) from emails_admin) as emails;

-- (A trava de pagamentos aprovados foi retirada em 30/10/2026: o dono confirmou que todos os 4 pagamentos eram de teste.)

delete from eventos;

\echo '== Depois'
select (select count(*) from eventos) as eventos, (select count(*) from convidados) as convidados,
       (select count(*) from fotos) as fotos, (select count(*) from pagamentos) as pagamentos,
       (select count(*) from pedidos_remocao) as pedidos_remocao, (select count(*) from emails_admin) as emails;

rollback;  -- troque por: commit;
