-- Ordem dos especiais do dia (admin define quais aparecem primeiro na home).
alter table mercados add column if not exists especial_ordem int;

-- Catálogo de mercados da OddsPapi cacheado no banco: sem ele, cada isolate novo
-- da Edge Function gasta 1 request em /markets a cada consulta de odds.
create table if not exists odds_catalogo (
  sport_id int primary key,
  mercados jsonb not null,
  atualizado_em timestamptz not null default now()
);
