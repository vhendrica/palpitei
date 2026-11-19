-- Pool alimentado pela The Odds API: id do evento externo e mercados sugeridos (odds = multiplicadores).
alter table public.fixtures_dia
  add column fonte text not null default 'manual' check (fonte in ('manual', 'the_odds_api', 'api_football')),
  add column externo_id text unique,
  add column mercados_sugeridos jsonb not null default '[]'::jsonb,
  add column odds_atualizadas_em timestamptz;
