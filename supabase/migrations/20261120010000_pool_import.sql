-- Controle de importação do pool por data: sem ele, cada acesso à lista de
-- fixtures de um dia vazio reimportava todos os campeonatos (~9 requests).
create table if not exists public.pool_import (
  data date primary key,
  importado_em timestamptz not null default now()
);
