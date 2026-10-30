/**
 * Servidor de desenvolvimento em Node: mesma API da Edge Function, sem precisar do Supabase CLI.
 *   DATABASE_URL=postgres://... npm run dev   →  http://localhost:8787
 */
import { createServer } from 'node:http';
import postgres from 'postgres';

import { createApi } from './functions/_core/http.ts';
import { createWhatsappSender, otpMockAtivo } from './functions/_core/whatsapp.ts';

const env = (k: string) => process.env[k];
const url = env('DATABASE_URL') ?? env('SUPABASE_DB_URL');
if (!url) throw new Error('Defina DATABASE_URL (ou SUPABASE_DB_URL)');

const sql = postgres(url, { onnotice: () => {} });
const handle = createApi({
  sql,
  send: createWhatsappSender(env),
  otp: { expor: otpMockAtivo(env) && env('OTP_EXPOR_CODIGO') !== 'false' },
  odds: env('THE_ODDS_API_KEY')
    ? { apiKey: env('THE_ODDS_API_KEY')!, esportes: env('THE_ODDS_API_SPORTS')?.split(',').map((s) => s.trim()) }
    : undefined,
});
const port = Number(env('PORT') ?? 8787);

createServer(async (req, res) => {
  const chunks: Buffer[] = [];
  for await (const c of req) chunks.push(c as Buffer);
  const body = chunks.length ? Buffer.concat(chunks) : undefined;
  const response = await handle(
    new Request(`http://localhost:${port}${req.url}`, {
      method: req.method,
      headers: req.headers as Record<string, string>,
      body: req.method === 'GET' || req.method === 'HEAD' ? undefined : body,
    }),
  );
  res.writeHead(response.status, Object.fromEntries(response.headers));
  res.end(Buffer.from(await response.arrayBuffer()));
}).listen(port, () => console.log(`PALPIT API dev em http://localhost:${port}`));
