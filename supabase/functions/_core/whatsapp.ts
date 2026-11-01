/**
 * Envio do código OTP por WhatsApp.
 * Driver escolhido por WHATSAPP_PROVIDER: `meta` (WhatsApp Cloud API), `twilio` ou `mock` (padrão: só loga).
 */
export type Env = (key: string) => string | undefined;
export type WhatsappSender = (whatsapp: string, codigo: string) => Promise<void>;

export const otpMockAtivo = (env: Env) =>
  (env('WHATSAPP_PROVIDER') ?? 'mock') === 'mock' || env('OTP_MOCK') === 'true';

/** E.164 brasileiro a partir de DDD + número. */
export const e164 = (whatsapp: string) => `+55${whatsapp}`;

export function createWhatsappSender(env: Env, fetchFn: typeof fetch = fetch): WhatsappSender {
  if (otpMockAtivo(env)) {
    return async (whatsapp, codigo) => {
      console.log(`[otp:mock] ${e164(whatsapp)} -> ${codigo}`);
    };
  }
  const provider = env('WHATSAPP_PROVIDER');
  if (provider === 'meta') return metaSender(env, fetchFn);
  if (provider === 'twilio') return twilioSender(env, fetchFn);
  throw new Error(`WHATSAPP_PROVIDER desconhecido: ${provider}`);
}

function required(env: Env, key: string) {
  const v = env(key);
  if (!v) throw new Error(`Variável ${key} não configurada`);
  return v;
}

/** Template de autenticação (categoria AUTHENTICATION) aprovado no WhatsApp Manager, com botão "copiar código". */
function metaSender(env: Env, fetchFn: typeof fetch): WhatsappSender {
  const token = required(env, 'META_WHATSAPP_TOKEN');
  const phoneId = required(env, 'META_WHATSAPP_PHONE_NUMBER_ID');
  const template = env('META_WHATSAPP_TEMPLATE') ?? 'palpit_codigo';
  const lang = env('META_WHATSAPP_TEMPLATE_LANG') ?? 'pt_BR';
  const version = env('META_GRAPH_VERSION') ?? 'v21.0';
  return async (whatsapp, codigo) => {
    const res = await fetchFn(`https://graph.facebook.com/${version}/${phoneId}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: e164(whatsapp).slice(1),
        type: 'template',
        template: {
          name: template,
          language: { code: lang },
          components: [
            { type: 'body', parameters: [{ type: 'text', text: codigo }] },
            { type: 'button', sub_type: 'url', index: '0', parameters: [{ type: 'text', text: codigo }] },
          ],
        },
      }),
    });
    if (!res.ok) throw new Error(`Meta WhatsApp ${res.status}: ${await res.text()}`);
  };
}

function twilioSender(env: Env, fetchFn: typeof fetch): WhatsappSender {
  const sid = required(env, 'TWILIO_ACCOUNT_SID');
  const auth = required(env, 'TWILIO_AUTH_TOKEN');
  const from = required(env, 'TWILIO_WHATSAPP_FROM');
  const contentSid = env('TWILIO_CONTENT_SID');
  return async (whatsapp, codigo) => {
    const body = new URLSearchParams({ From: `whatsapp:${from}`, To: `whatsapp:${e164(whatsapp)}` });
    if (contentSid) {
      body.set('ContentSid', contentSid);
      body.set('ContentVariables', JSON.stringify({ 1: codigo }));
    } else {
      body.set('Body', `Seu código PALPIT é ${codigo}. Ele expira em 10 minutos. Não compartilhe.`);
    }
    const res = await fetchFn(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: 'POST',
      headers: { Authorization: `Basic ${btoa(`${sid}:${auth}`)}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });
    if (!res.ok) throw new Error(`Twilio ${res.status}: ${await res.text()}`);
  };
}
