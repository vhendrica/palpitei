/**
 * Dados de desenvolvimento: admin, pool de jogos de hoje e a múltipla do dia com mercados.
 *   DATABASE_URL=... ADMIN_WHATSAPP=85999990000 npx tsx scripts/seed-dev.ts
 * O admin já fica ativo (entre pelo app com o WhatsApp; o código aparece no log do dev server).
 */
import postgres from 'postgres';

import { definirMercados, marcarDestaque, selecionarJogos, upsertFixture } from '../functions/_core/admin.ts';
import { hojeISO } from '../functions/_core/validation.ts';

const sql = postgres(process.env.DATABASE_URL!, { onnotice: () => {} });
const hoje = hojeISO();
const whatsapp = process.env.ADMIN_WHATSAPP ?? '85999990000';

await sql`
  insert into users (nome, whatsapp, cpf, data_nascimento, bairro, saldo_pontos, is_admin,
                     terms_accepted_at, terms_version, data_consent_accepted_at, data_consent_version, ativado_em)
  values ('Admin PALPIT', ${whatsapp}, '52998224725', '1990-01-01', 'Aldeota', 500, true,
          now(), 'dev', now(), 'dev', now())
  on conflict (whatsapp) do update set is_admin = true, ativado_em = coalesce(users.ativado_em, now())`;

// Jogos começam daqui a algumas horas, para o palpite ficar aberto durante o desenvolvimento.
const horario = (h: number) => new Date(Date.now() + h * 3600_000).toISOString();
const pool = [
  [1001, 'Fortaleza', 'Ceará', 2, 'Brasileirão Série A'],
  [1002, 'Flamengo', 'Palmeiras', 3, 'Brasileirão Série A'],
  [1003, 'Ferroviário', 'Floresta', 4, 'Série C'],
  [1004, 'Bahia', 'Sport', 4, 'Copa do Nordeste'],
] as const;
for (const [fixture_id, time_casa, time_fora, h, campeonato] of pool) {
  await upsertFixture(sql, { fixture_id, time_casa, time_fora, horario: horario(h), campeonato, data: hoje });
}

const [liga] = await sql`select id from ligas where data = ${hoje}`;
if (!liga) {
  const montada = await selecionarJogos(sql, { data: hoje, fixture_ids: [1001, 1002, 1003], premio_desc: 'Voucher PALPIT' });
  const mercados = (casa: string, fora: string) => [
    { descricao: `${casa} vence`, multiplicador: 2.1 },
    { descricao: 'Empate', multiplicador: 3.2 },
    { descricao: `${fora} vence`, multiplicador: 3.5 },
    { descricao: 'Ambos marcam', multiplicador: 1.85 },
    { descricao: 'Mais de 2.5 gols', multiplicador: 2.4 },
  ];
  for (const j of montada.jogos) await definirMercados(sql, j.id, mercados(j.time_casa, j.time_fora));
  await marcarDestaque(sql, montada.jogos.find((j) => j.fixture_id === 1001)!.id);
}
console.log(`seed ok (${hoje}) — admin: ${whatsapp}`);
await sql.end();
