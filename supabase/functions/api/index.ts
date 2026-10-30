// Edge Function única da API do PALPIT. Deploy: `supabase functions deploy api --no-verify-jwt`
// (o app usa token de sessão próprio no header Authorization, não o JWT do Supabase Auth).
import postgres from 'postgres';

import { createApi } from '../_core/http.ts';
import { createWhatsappSender, otpMockAtivo } from '../_core/whatsapp.ts';

const env = (k: string) => Deno.env.get(k);

// SUPABASE_DB_URL é injetada automaticamente nas Edge Functions. prepare:false por causa do pooler (modo transação).
const sql = postgres(env('SUPABASE_DB_URL')!, { prepare: false, max: 5 });

const handle = createApi({
  sql,
  send: createWhatsappSender(env),
  otp: { expor: otpMockAtivo(env) && env('OTP_EXPOR_CODIGO') === 'true' },
  corsOrigin: env('CORS_ORIGIN') ?? '*',
  odds: env('THE_ODDS_API_KEY')
    ? { apiKey: env('THE_ODDS_API_KEY')!, esportes: env('THE_ODDS_API_SPORTS')?.split(',').map((s) => s.trim()) }
    : undefined,
});

Deno.serve(handle);
