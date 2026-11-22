-- Programa de indicação: quem convidou ganha pontos quando o amigo se cadastra.
alter table public.users add column indicado_por uuid references public.users (id);
alter table public.config add column pontos_indicacao integer not null default 100 check (pontos_indicacao >= 0);
