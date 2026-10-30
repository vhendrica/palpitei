import postgres from 'postgres';

import { migrate } from '../scripts/migrate.ts';

export const TEST_DB = process.env.TEST_DATABASE_URL ?? 'postgres://postgres:postgres@localhost:54329/postgres';

export async function setupDb() {
  await migrate(TEST_DB, { reset: true });
  return postgres(TEST_DB, { onnotice: () => {}, max: 10 });
}

export type Sql = Awaited<ReturnType<typeof setupDb>>;

let seq = 0;
export async function criarUser(
  sql: Sql,
  over: Partial<{ nome: string; saldo_pontos: number; is_admin: boolean; created_at: string }> = {},
) {
  seq++;
  const [u] = await sql`
    insert into users (nome, whatsapp, cpf, data_nascimento, bairro, saldo_pontos, is_admin,
                       terms_accepted_at, terms_version, data_consent_accepted_at, data_consent_version, ativado_em,
                       created_at)
    values (${over.nome ?? `User ${seq}`}, ${String(85900000000 + seq)}, ${String(10000000000 + seq)}, '1990-01-01',
            'Aldeota', ${over.saldo_pontos ?? 500}, ${over.is_admin ?? false}, now(), 'v1', now(), 'v1', now(),
            ${over.created_at ?? new Date(Date.now() + seq).toISOString()})
    returning id`;
  return u.id as string;
}

/** Liga com 3 jogos no futuro, 2 mercados cada. */
export async function criarLiga(sql: Sql, data = '2030-01-01', status = 'aberta') {
  const [l] = await sql`
    insert into ligas (data, status, custo_entrada, fichas_por_entrada) values (${data}, ${status}, 100, 200) returning id`;
  const mercados: string[] = [];
  const jogos: string[] = [];
  for (let i = 0; i < 3; i++) {
    const [j] = await sql`
      insert into jogos (liga_id, fixture_id, time_casa, time_fora, horario, campeonato, destaque)
      values (${l.id}, ${1000 + i + Number(data.replace(/-/g, ''))}, ${'Casa' + i}, ${'Fora' + i},
              now() + interval '2 days', 'Série A', ${i === 0})
      returning id`;
    jogos.push(j.id);
    for (const [desc, mult] of [['CASA VENCE', 2], ['EMPATE', 3]] as const) {
      const [m] = await sql`
        insert into mercados (jogo_id, descricao, multiplicador) values (${j.id}, ${desc}, ${mult}) returning id`;
      mercados.push(m.id);
    }
  }
  return { ligaId: l.id as string, jogos, mercados };
}

export const saldo = async (sql: Sql, id: string) =>
  Number((await sql`select saldo_pontos from users where id = ${id}`)[0].saldo_pontos);

export async function limpar(sql: Sql) {
  await sql`truncate users, ligas, jogos, mercados, entradas, apostas, vouchers, sessions, otp_codes, fixtures_dia cascade`;
  await sql`delete from premio_escada`;
  await sql`insert into premio_escada (ordem, usuarios_min, valor) values (1, 100, 100), (2, 250, 300), (3, 500, 500)`;
  await sql`update config set qtd_jogos_dia = 3, fichas_por_entrada = 200, custo_entrada_pontos = 100 where id = 1`;
}
