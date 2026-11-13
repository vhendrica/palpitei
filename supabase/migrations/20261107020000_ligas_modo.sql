alter table ligas add column if not exists modo text not null default 'grupo' check (modo in ('grupo','duelo'));
