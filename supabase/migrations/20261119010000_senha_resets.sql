-- Recuperação de senha por e-mail: link com token de uso único (guardado só o hash).
create table if not exists public.senha_resets (
  token_hash text primary key,
  user_id uuid not null references public.users (id) on delete cascade,
  expires_at timestamptz not null,
  usado boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists senha_resets_user_idx on public.senha_resets (user_id, created_at desc);
alter table public.senha_resets enable row level security;
