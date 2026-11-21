// Edge Function única da API do PALPIT. Deploy: `supabase functions deploy api --no-verify-jwt`
// (o app usa token de sessão próprio no header Authorization, não o JWT do Supabase Auth).
import postgres from 'postgres';

import { createApi } from '../_core/http.ts';
import { createEmailSender } from '../_core/email.ts';
import { createWhatsappSender, otpMockAtivo } from '../_core/whatsapp.ts';

const env = (k: string) => Deno.env.get(k);

// SUPABASE_DB_URL é injetada automaticamente nas Edge Functions. prepare:false por causa do pooler (modo transação).
const sql = postgres(env('SUPABASE_DB_URL')!, { prepare: false, max: 5 });

const handle = createApi({
  sql,
  send: createWhatsappSender(env),
  email: createEmailSender(env),
  appUrl: env('APP_URL'),
  otp: { expor: otpMockAtivo(env) && env('OTP_EXPOR_CODIGO') === 'true' },
  corsOrigin: env('CORS_ORIGIN') ?? '*',
  cronSecret: env('CRON_SECRET'),
  odds: env('ODDS_PAPI_KEY')
    ? {
        apiKey: env('ODDS_PAPI_KEY')!,
        bookmaker: env('ODDS_PAPI_BOOKMAKER') ?? '1xbet',
        bookmakerProps: env('ODDS_PAPI_BOOKMAKER_PROPS') ?? 'betano',
        torneios: env('ODDS_PAPI_TORNEIOS')?.split(',').map(Number).filter(Boolean),
      }
    : undefined,
});

Deno.serve(handle);
