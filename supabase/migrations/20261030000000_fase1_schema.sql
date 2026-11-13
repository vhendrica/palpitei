-- PALPIT — Fase 1: schema base.
-- Todo acesso passa pela Edge Function `api` (conexão direta ao Postgres);
-- RLS fica ligada em todas as tabelas sem policies, bloqueando anon/authenticated via PostgREST.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------- users
create table public.users (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (char_length(nome) between 2 and 120),
  whatsapp text not null unique check (whatsapp ~ '^[0-9]{10,11}$'),
  cpf text not null unique check (cpf ~ '^[0-9]{11}$'),
  data_nascimento date not null,
  bairro text not null,
  saldo_pontos integer not null default 0 check (saldo_pontos >= 0),
  is_admin boolean not null default false,
  terms_accepted_at timestamptz not null,
  terms_version text not null,
  data_consent_accepted_at timestamptz not null,
  data_consent_version text not null,
  -- null = cadastro pendente de confirmação do código OTP
  ativado_em timestamptz,
  -- clock_timestamp() (e não now()) para ter precisão real de ms mesmo dentro da mesma transação;
  -- usado como critério final de desempate do ranking.
  created_at timestamptz not null default clock_timestamp()
);

-- ---------------------------------------------------------------- config (linha única)
create table public.config (
  id smallint primary key default 1 check (id = 1),
  qtd_jogos_dia integer not null default 3 check (qtd_jogos_dia > 0),
  fichas_por_entrada integer not null default 200 check (fichas_por_entrada > 0),
  custo_entrada_pontos integer not null default 100 check (custo_entrada_pontos > 0),
  pontos_boas_vindas integer not null default 500 check (pontos_boas_vindas >= 0),
  termos_versao text not null default '2026-10-v1',
  consentimento_versao text not null default '2026-10-v1',
  updated_at timestamptz not null default now()
);
insert into public.config (id) values (1);

-- ---------------------------------------------------------------- premio_escada
-- A linha de maior `ordem` é a META/TETO do prêmio.
create table public.premio_escada (
  id uuid primary key default gen_random_uuid(),
  ordem integer not null unique check (ordem > 0),
  usuarios_min integer not null unique check (usuarios_min > 0),
  valor numeric(10,2) not null check (valor > 0)
);
insert into public.premio_escada (ordem, usuarios_min, valor) values
  (1, 100, 100), (2, 250, 300), (3, 500, 500);

-- ---------------------------------------------------------------- fixtures_dia (pool)
-- Fase 1: alimentado manualmente no admin. Fase 2: job da API-Football (fixture_id).
create table public.fixtures_dia (
  id uuid primary key default gen_random_uuid(),
  fixture_id bigint not null unique,
  data date not null,
  time_casa text not null,
  time_fora text not null,
  horario timestamptz not null,
  campeonato text not null,
  selecionado boolean not null default false,
  created_at timestamptz not null default now()
);
create index fixtures_dia_data_idx on public.fixtures_dia (data);

-- ---------------------------------------------------------------- ligas (= múltipla do dia)
create table public.ligas (
  id uuid primary key default gen_random_uuid(),
  data date not null unique,
  premio_desc text,
  premio_final numeric(10,2),
  status text not null default 'aberta' check (status in ('aberta', 'em_andamento', 'finalizada')),
  custo_entrada integer not null check (custo_entrada > 0),
  fichas_por_entrada integer not null check (fichas_por_entrada > 0),
  finalizada_em timestamptz,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- jogos
create table public.jogos (
  id uuid primary key default gen_random_uuid(),
  liga_id uuid not null references public.ligas (id) on delete cascade,
  fixture_id bigint not null,
  time_casa text not null,
  time_fora text not null,
  horario timestamptz not null,
  campeonato text not null,
  destaque boolean not null default false,
  ordem integer not null default 0,
  unique (liga_id, fixture_id)
);
create unique index jogos_um_destaque_por_liga on public.jogos (liga_id) where destaque;

-- ---------------------------------------------------------------- mercados
create table public.mercados (
  id uuid primary key default gen_random_uuid(),
  jogo_id uuid not null references public.jogos (id) on delete cascade,
  descricao text not null check (char_length(descricao) between 1 and 80),
  multiplicador numeric(6,2) not null check (multiplicador > 0),
  resultado_final boolean not null default false,
  ordem integer not null default 0
);
create index mercados_jogo_idx on public.mercados (jogo_id);

-- ---------------------------------------------------------------- entradas
create table public.entradas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id),
  liga_id uuid not null references public.ligas (id),
  pontos_pagos integer not null,
  fichas_total integer not null check (fichas_total > 0),
  created_at timestamptz not null default clock_timestamp(),
  unique (user_id, liga_id)
);
create index entradas_liga_idx on public.entradas (liga_id);

-- ---------------------------------------------------------------- apostas
create table public.apostas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id),
  mercado_id uuid not null references public.mercados (id),
  fichas_apostadas integer not null check (fichas_apostadas > 0),
  created_at timestamptz not null default clock_timestamp()
);
create index apostas_user_idx on public.apostas (user_id);
create index apostas_mercado_idx on public.apostas (mercado_id);

-- ---------------------------------------------------------------- vouchers
create table public.vouchers (
  id uuid primary key default gen_random_uuid(),
  liga_id uuid not null unique references public.ligas (id),
  user_id uuid not null references public.users (id),
  codigo text not null unique,
  valor numeric(10,2) not null default 0,
  resgatado boolean not null default false,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- otp_codes
-- `codigo` guarda o SHA-256 do código (nunca o código em texto).
create table public.otp_codes (
  id uuid primary key default gen_random_uuid(),
  whatsapp text not null,
  codigo text not null,
  expires_at timestamptz not null,
  usado boolean not null default false,
  tentativas integer not null default 0,
  created_at timestamptz not null default clock_timestamp()
);
create index otp_codes_whatsapp_idx on public.otp_codes (whatsapp, created_at desc);

-- ---------------------------------------------------------------- sessions
create table public.sessions (
  token_hash text primary key,
  user_id uuid not null references public.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);
create index sessions_user_idx on public.sessions (user_id);

-- ---------------------------------------------------------------- RLS
alter table public.users enable row level security;
alter table public.config enable row level security;
alter table public.premio_escada enable row level security;
alter table public.fixtures_dia enable row level security;
alter table public.ligas enable row level security;
alter table public.jogos enable row level security;
alter table public.mercados enable row level security;
alter table public.entradas enable row level security;
alter table public.apostas enable row level security;
alter table public.vouchers enable row level security;
alter table public.otp_codes enable row level security;
alter table public.sessions enable row level security;
