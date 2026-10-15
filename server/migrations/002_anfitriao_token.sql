-- Piloto: o anfitrião gerencia o evento por um link secreto (token), sem login.
-- Guarda só o hash do token. O e-mail passa a ser opcional (vira obrigatório se entrar login depois).
alter table eventos add column anfitriao_token_hash text unique;
alter table eventos alter column anfitriao_email drop not null;
