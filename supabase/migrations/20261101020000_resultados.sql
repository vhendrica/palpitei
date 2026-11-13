-- Placar final dos jogos (buscado na The Odds API a cada 10 min enquanto houver jogo rolando).
alter table public.jogos
  add column placar_casa integer check (placar_casa >= 0),
  add column placar_fora integer check (placar_fora >= 0),
  add column finalizado_em timestamptz;
-- Bairro saiu do cadastro.
alter table public.users alter column bairro set default '';
