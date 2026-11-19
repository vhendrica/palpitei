-- Empate anula: no empate o palpite é anulado e as fichas voltam (odd 1.0).
alter table mercados add column if not exists anulado boolean not null default false;
