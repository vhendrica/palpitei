-- ---------------------------------------------------------------- simulador
-- Modo análise: aposta com dinheiro virtual em mercados REAIS (odd real da casa).
-- Objetivo educativo: mostrar ao usuário quanto ele perderia no longo prazo.
-- Valores sempre em centavos.

create table public.sim_conta (
  user_id          uuid primary key references public.users (id),
  saldo            integer not null default 0 check (saldo >= 0),
  total_depositado integer not null default 0,
  total_apostado   integer not null default 0,
  total_retornado  integer not null default 0,
  recargas         integer not null default 0,
  estouros         integer not null default 0, -- quantas vezes zerou a banca
  created_at       timestamptz not null default clock_timestamp()
);

create table public.sim_recarga (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.users (id),
  valor      integer not null check (valor > 0),
  created_at timestamptz not null default clock_timestamp()
);
create index sim_recarga_user_idx on public.sim_recarga (user_id, created_at desc);

create table public.sim_aposta (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.users (id),
  mercado_id   uuid not null references public.mercados (id),
  valor        integer not null check (valor > 0),
  odd          numeric(6,2) not null check (odd > 0), -- snapshot: a odd pode mudar
  status       text not null default 'aberta'
                 check (status in ('aberta', 'ganhou', 'perdeu', 'anulada')),
  retorno      integer not null default 0,
  created_at   timestamptz not null default clock_timestamp(),
  resolvida_em timestamptz
);
create index sim_aposta_user_idx on public.sim_aposta (user_id, created_at desc);
create index sim_aposta_abertas_idx on public.sim_aposta (mercado_id) where status = 'aberta';
