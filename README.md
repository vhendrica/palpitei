# PALPITEI // Deck 16:9

Apresentação interativa oficial do app **Palpitei** — "A emoção da BET sem o risco da BET".
Next.js (App Router) + Tailwind CSS. Palco fixo 1600x900 (16:9) que escala para qualquer tela (notebook, TV, projetor).

## Navegação

- Setas na tela ou teclado `←` / `→` (também `PageUp`/`PageDown`, `Home`/`End`)
- Swipe no celular/tablet
- Botão **Apresentar em Tela Cheia** no topo
- Slide 5: botão **Simular Abertura do App** abre o anúncio de tela cheia dentro do celular

## Rodar local

```bash
npm install
npm run dev     # http://localhost:3000
```

## Deploy na Vercel

1. Suba esta pasta para um repositório no GitHub.
2. Em https://vercel.com/new importe o repositório (Framework: **Next.js**, sem variáveis de ambiente).
3. Clique em **Deploy**.

Ou pela CLI: `npx vercel` (preview) e `npx vercel --prod` (produção).

## App dentro do celular (DEMO)

O celular mostra o app Palpitei de verdade: é o export web do projeto Expo, que fica em `public/app/` e é servido em `/app`. O deck controla o app (troca de tela a cada slide, anúncio, Premium, reset) via `postMessage`.

Para atualizar o app depois de mudar o projeto Expo:

```bash
cd ../ligas-fortaleza   # projeto Expo do Palpitei
npx expo export --platform web --output-dir ../palpitei-deck/public/app
```

(`app.json` do Expo já tem `experiments.baseUrl: "/app"`.)

## Publicar no GitHub Pages

O código do app Expo fica em `mobile/`. Para gerar o site estático (deck + app) em `out/`:

```bash
npm install && (cd mobile && npm install)
REPO=palpitei ./scripts/build-pages.sh
```

Depois publique o conteúdo de `out/` na branch `gh-pages` (Settings → Pages → Branch: `gh-pages`).

---

# PALPIT — Produto (Fase 1)

```
mobile/ (Expo)  ──HTTP + Bearer token──▶  supabase/functions/api (Edge Function)
                                              │  _core/: regras, auth/OTP, admin, prêmio
                                              ▼
                                         Postgres (Supabase) — supabase/migrations/
```

- **Banco**: `supabase/migrations/*.sql` (users, config, premio_escada, fixtures_dia, ligas, jogos, mercados, entradas, apostas, vouchers, otp_codes, sessions). RLS ligada sem policies: o app só acessa via API.
- **Regras** (`supabase/functions/_core/rules.ts`): entrada (PONTOS → FICHAS), distribuição de fichas, pontuação, ranking (desempate: 1ª aposta, depois `users.created_at`), finalização com `premio_final` pela `premio_escada` (última faixa = meta/teto) e voucher. Tudo em transação com lock.
- **Auth**: cadastro (nome, WhatsApp, CPF, nascimento 18+, bairro, 2 consentimentos com timestamp + versão) → OTP de 6 dígitos (10 min) pelo WhatsApp → conta ativa com 500 PONTOS. Login = novo código. Sessão = token próprio (`Authorization: Bearer`).
- **Admin**: usuários com `users.is_admin = true` veem a aba Admin no app (pool de jogos, montar múltipla, jogo do dia, mercados, escada de prêmio, regras, finalizar).

## Variáveis de ambiente

**Edge Function `api`** (`supabase secrets set NOME=valor`):

| Variável | Descrição |
| --- | --- |
| `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_DB_URL` | Injetadas automaticamente pelo Supabase. A API usa `SUPABASE_DB_URL` (conexão Postgres direta). |
| `WHATSAPP_PROVIDER` | `mock` (padrão: só loga o código), `meta` ou `twilio`. |
| `OTP_MOCK` | `true` força o mock mesmo com provider configurado. |
| `OTP_EXPOR_CODIGO` | `true` devolve o código na resposta (só em mock; útil em staging). No dev server local já vem ligado. |
| `META_WHATSAPP_TOKEN`, `META_WHATSAPP_PHONE_NUMBER_ID` | WhatsApp Cloud API (Meta). |
| `META_WHATSAPP_TEMPLATE`, `META_WHATSAPP_TEMPLATE_LANG`, `META_GRAPH_VERSION` | Template de autenticação aprovado (padrão `palpit_codigo`, `pt_BR`, `v21.0`). |
| `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_WHATSAPP_FROM` | Twilio (`TWILIO_WHATSAPP_FROM` ex.: `whatsapp:+14155238886`). |
| `TWILIO_CONTENT_SID` | Opcional: template de conteúdo do Twilio. |
| `CORS_ORIGIN` | Origem permitida (padrão `*`). |

**App Expo** (`mobile/.env`):

| Variável | Descrição |
| --- | --- |
| `EXPO_PUBLIC_API_URL` | URL da API, ex.: `https://<ref>.supabase.co/functions/v1/api` (padrão `http://localhost:8787`). |

**Scripts locais** (`supabase/`): `DATABASE_URL` (Postgres), `ADMIN_WHATSAPP` (seed), `PORT` (dev server).

## Rodar local

```bash
docker run -d --name palpit-pg -e POSTGRES_PASSWORD=postgres -p 54329:5432 postgres:15
cd supabase && npm install
export DATABASE_URL=postgres://postgres:postgres@localhost:54329/postgres
npm run db:migrate              # aplica migrations (--reset recria do zero)
ADMIN_WHATSAPP=85999990000 npm run db:seed   # admin + pool + múltipla de hoje
npm run dev                     # API em http://localhost:8787 (código OTP aparece no log)
npm test                        # testes de regras/auth/API contra o Postgres
cd ../mobile && npm install && EXPO_PUBLIC_API_URL=http://localhost:8787 npx expo start
```

## Deploy no Supabase

```bash
supabase link --project-ref <ref>
supabase db push                           # migrations
supabase functions deploy api --no-verify-jwt
supabase secrets set WHATSAPP_PROVIDER=meta META_WHATSAPP_TOKEN=... META_WHATSAPP_PHONE_NUMBER_ID=...
```

Para virar admin: `update users set is_admin = true where whatsapp = '85999990000';`

Fase 2 (fora deste escopo): jobs da API-Football alimentando `fixtures_dia` e resultados (`mercados.resultado_final`), resgate de voucher, métricas.

> O build do GitHub Pages embute o export web de `mobile/`; com a Fase 1 o app precisa da API (`EXPO_PUBLIC_API_URL`) no momento do build.
