alter table users add column if not exists login_streak int not null default 0, add column if not exists ultimo_login date, add column if not exists maior_streak int not null default 0;
