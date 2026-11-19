-- Resultados automaticos: pg_cron bate no endpoint /cron/resultados a cada 10min.
create table if not exists cron_config (chave text primary key, valor text not null);
insert into cron_config (chave, valor) values ('cron_secret', gen_random_uuid()::text)
  on conflict (chave) do nothing;

-- pg_cron/pg_net só existem no Supabase; no Postgres dos testes o agendamento é pulado.
do $do$
begin
  if not exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    return;
  end if;
  create extension if not exists pg_cron;
  create extension if not exists pg_net;
  perform cron.schedule(
  'resultados-10m',
  '*/10 * * * *',
  $job$select net.http_post(
    url := 'https://mkhpkguwjwtoxsgwcgmm.supabase.co/functions/v1/api/cron/resultados',
    headers := jsonb_build_object(
      'x-cron-secret', (select valor from cron_config where chave = 'cron_secret'),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );$job$
);
end
$do$;
