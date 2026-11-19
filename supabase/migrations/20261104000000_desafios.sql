-- DESAFIO: rodada criada por usuário (não só pelo admin). Reaproveita ligas/jogos/mercados/
-- entradas/apostas/ranking. owner_id null = múltipla oficial do dia.
alter table public.ligas
  add column owner_id uuid references public.users (id) on delete set null,
  add column titulo text check (titulo is null or char_length(titulo) between 1 and 60),
  add column convite text unique,
  -- público: aparece na aba Desafio pra qualquer usuário; privado: só entra com o link.
  add column publico boolean not null default false;

-- A data continua única, mas só entre rodadas oficiais: desafios podem dividir o dia.
alter table public.ligas drop constraint ligas_data_key;
create unique index ligas_data_oficial_uk on public.ligas (data) where owner_id is null;

-- Desafio é grátis (sem PONTOS); a oficial continua cobrando.
alter table public.ligas drop constraint ligas_custo_entrada_check;
alter table public.ligas add constraint ligas_custo_entrada_check check (custo_entrada >= 0);

create index ligas_desafios_publicos_idx on public.ligas (created_at desc) where owner_id is not null and publico;
