-- Bilhete com Simples (apostas) e Múltiplas (multiplas + multipla_pernas).
-- A odd fica travada no momento da confirmação.
alter table public.apostas add column odd numeric(6,2);
update public.apostas a set odd = m.multiplicador from public.mercados m where m.id = a.mercado_id;
alter table public.apostas alter column odd set not null;
alter table public.apostas add constraint apostas_odd_check check (odd > 0);

create table public.multiplas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id),
  liga_id uuid not null references public.ligas (id) on delete cascade,
  fichas_apostadas integer not null check (fichas_apostadas > 0),
  created_at timestamptz not null default clock_timestamp()
);
create index multiplas_liga_user_idx on public.multiplas (liga_id, user_id);

create table public.multipla_pernas (
  multipla_id uuid not null references public.multiplas (id) on delete cascade,
  mercado_id uuid not null references public.mercados (id) on delete cascade,
  odd numeric(6,2) not null check (odd > 0),
  primary key (multipla_id, mercado_id)
);
create index multipla_pernas_mercado_idx on public.multipla_pernas (mercado_id);

alter table public.multiplas enable row level security;
alter table public.multipla_pernas enable row level security;
