-- Indicação por marcos: o indicador pontua por cada etapa que o amigo completa.
-- cadastro (50) + palpite no dia do cadastro (50) + 100 por login nos 3 dias
-- seguintes (300) + bônus ao completar os 3 logins (100) = até 500 por amigo.
alter table public.config alter column pontos_indicacao set default 50;
update public.config set pontos_indicacao = 50 where id = 1;
alter table public.config add column indicacao_palpite integer not null default 50 check (indicacao_palpite >= 0);
alter table public.config add column indicacao_login integer not null default 100 check (indicacao_login >= 0);
alter table public.config add column indicacao_bonus integer not null default 100 check (indicacao_bonus >= 0);

-- Registro do que já foi pago por amigo indicado (evita pagamento em dobro).
create table public.indicacao_recompensas (
  indicado_id uuid not null references public.users (id),
  tipo text not null,
  indicador_id uuid not null references public.users (id),
  pontos integer not null,
  created_at timestamptz not null default now(),
  primary key (indicado_id, tipo)
);
