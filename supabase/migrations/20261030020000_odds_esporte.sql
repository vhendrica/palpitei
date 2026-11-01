-- Campeonato (sport_key) do evento na The Odds API, para buscar mercados extras por jogo.
alter table public.fixtures_dia add column externo_esporte text;
