-- ------------------------------------------------------ simulador: múltiplas
-- Bilhete acumulado virtual: um valor só × produto das odds. Ganha só se
-- TODAS as pernas baterem; basta uma errar pra perder tudo.

create table public.sim_multipla (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.users (id),
  valor        integer not null check (valor > 0),
  odd_total    numeric(10,2) not null check (odd_total > 0),
  status       text not null default 'aberta'
                 check (status in ('aberta', 'ganhou', 'perdeu')),
  retorno      integer not null default 0,
  created_at   timestamptz not null default clock_timestamp(),
  resolvida_em timestamptz
);
create index sim_multipla_user_idx on public.sim_multipla (user_id, created_at desc);
create index sim_multipla_abertas_idx on public.sim_multipla (id) where status = 'aberta';

create table public.sim_multipla_perna (
  multipla_id uuid not null references public.sim_multipla (id) on delete cascade,
  mercado_id  uuid not null references public.mercados (id),
  odd         numeric(6,2) not null check (odd > 0),
  primary key (multipla_id, mercado_id)
);
create index sim_multipla_perna_mercado_idx on public.sim_multipla_perna (mercado_id);
