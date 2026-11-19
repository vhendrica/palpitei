-- Fecha cron_config e as tabelas do simulador para anon/authenticated (PostgREST).
-- A API usa SUPABASE_DB_URL (role postgres), que ignora RLS.
alter table public.cron_config enable row level security;
alter table public.sim_conta enable row level security;
alter table public.sim_recarga enable row level security;
alter table public.sim_aposta enable row level security;
alter table public.sim_multipla enable row level security;
alter table public.sim_multipla_perna enable row level security;
