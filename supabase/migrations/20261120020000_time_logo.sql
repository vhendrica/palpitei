-- Escudos dos times: participant id da OddsPapi por time + cache do URL da imagem.
alter table public.fixtures_dia
  add column if not exists p1_id integer,
  add column if not exists p2_id integer;

alter table public.jogos
  add column if not exists p1_id integer,
  add column if not exists p2_id integer;

-- Jogos já criados a partir do pool ganham os ids do fixture de origem.
update public.jogos j
set p1_id = f.p1_id, p2_id = f.p2_id
from public.fixtures_dia f
where j.fixture_id = f.fixture_id and (j.p1_id is null or j.p2_id is null);

-- URL final do PNG (CDN). '' = time sem imagem na OddsPapi (não tenta de novo).
create table if not exists public.time_logo (
  participant_id integer primary key,
  url text not null default '',
  resolvido_em timestamptz not null default now()
);
