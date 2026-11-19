-- Especiais do dia: até 10 mercados da rodada que o admin destaca na home (faixa "ESPECIAIS DO DIA").
alter table public.mercados add column if not exists especial boolean not null default false;
create index if not exists mercados_especial_idx on public.mercados (jogo_id) where especial;
