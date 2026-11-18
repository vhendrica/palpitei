-- Login por e-mail + senha. WhatsApp vira opcional (verificação OTP fica dormente no backend).
-- Senha nunca em claro: senha_hash em formato pbkdf2$iters$salt$hash (crypto.subtle, 600k iters).
alter table public.users
  add column if not exists email text,
  add column if not exists senha_hash text,
  add column if not exists senha_erros integer not null default 0,
  add column if not exists bloqueado_ate timestamptz,
  alter column whatsapp drop not null;

-- E-mail único case-insensitive; nullable (contas antigas criadas só com WhatsApp).
create unique index if not exists users_email_uk
  on public.users (lower(email)) where email is not null;

-- WhatsApp continua único quando informado, mas agora admite vários NULLs.
alter table public.users drop constraint if exists users_whatsapp_key;
create unique index if not exists users_whatsapp_uk
  on public.users (whatsapp) where whatsapp is not null;
