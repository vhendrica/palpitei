/**
 * Envio de e-mail transacional (recuperação de senha).
 * Com RESEND_API_KEY envia pelo Resend; sem a chave só registra no log (nada é exposto na resposta).
 */
export type Env = (key: string) => string | undefined;
export type EmailSender = (para: string, assunto: string, html: string) => Promise<void>;

export function createEmailSender(env: Env, fetchFn: typeof fetch = fetch): EmailSender {
  const chave = env('RESEND_API_KEY');
  if (!chave) {
    return async (para, assunto) => {
      console.log(`[email:sem-provedor] ${para} -> ${assunto}`);
    };
  }
  const de = env('EMAIL_FROM') ?? 'PALPIT <onboarding@resend.dev>';
  return async (para, assunto, html) => {
    const r = await fetchFn('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${chave}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: de, to: [para], subject: assunto, html }),
    });
    if (!r.ok) throw new Error(`Resend ${r.status}: ${await r.text()}`);
  };
}
