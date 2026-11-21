-- OddsPapi vira a única fonte de jogos/odds/placar; estatísticas pós-jogo (escanteios/cartões) informadas pelo admin.
alter table public.fixtures_dia drop constraint if exists fixtures_dia_fonte_check;
alter table public.fixtures_dia
  add constraint fixtures_dia_fonte_check check (fonte in ('manual', 'the_odds_api', 'api_football', 'oddspapi'));
alter table public.jogos add column if not exists estatisticas jsonb not null default '{}'::jsonb;
