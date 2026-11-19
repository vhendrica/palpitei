-- Mercado = pergunta (grupo, ex.: RESULTADO) com opções (linhas de mercados, cada uma com sua odd).
alter table public.mercados add column grupo text not null default '' check (char_length(grupo) <= 40);
