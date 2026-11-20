-- Nomes de grupo gerados com time + período + linha estouravam os 40 chars
-- (ex.: "ESCANTEIOS PARIS SAINT-GERMAIN 1º TEMPO 9.5") e o admin não salvava.
alter table public.mercados drop constraint mercados_grupo_check;
alter table public.mercados add constraint mercados_grupo_check check (char_length(grupo) <= 60);
