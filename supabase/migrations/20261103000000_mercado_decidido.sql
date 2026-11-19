-- Mercado já decidido com o jogo em andamento (ex.: "Mais de 2.5" depois do 3º gol).
alter table public.mercados add column decidido_em timestamptz;
