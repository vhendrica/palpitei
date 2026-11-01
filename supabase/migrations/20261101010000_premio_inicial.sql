-- Prêmio que a rodada já começa valendo; a escada só faz ele subir.
alter table public.config add column premio_inicial numeric(10,2) not null default 0 check (premio_inicial >= 0);
