-- Username público único: exibido no ranking no lugar do nome real.
alter table users add column if not exists username text;

create extension if not exists unaccent;

-- Backfill: slug do nome (minúsculo, sem acento, separadores viram ponto); conflito ganha sufixo.
do $$
declare
  r record;
  base text;
  cand text;
  i int;
begin
  for r in select id, nome from users where username is null loop
    base := trim(both '.' from regexp_replace(
      lower(unaccent(coalesce(r.nome, ''))), '[^a-z0-9]+', '.', 'g'));
    if base = '' or length(base) < 3 then base := 'palpiteiro'; end if;
    base := left(base, 20);
    cand := base;
    i := 0;
    while exists (select 1 from users where username = cand and id <> r.id) loop
      i := i + 1;
      cand := left(base, greatest(1, 20 - length(i::text))) || i;
    end loop;
    update users set username = cand where id = r.id;
  end loop;
end $$;

alter table users alter column username set not null;
create unique index if not exists users_username_key on users (username);
