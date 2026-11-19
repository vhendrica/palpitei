import assert from 'node:assert/strict';
import { after, before, beforeEach, test } from 'node:test';

import { selecionarJogos } from '../functions/_core/admin.ts';
import { importarOdds, mercadosDaApi, mercadosDasOdds } from '../functions/_core/odds.ts';
import { limpar, setupDb, type Sql } from './helpers.ts';

let sql: Sql;
before(async () => (sql = await setupDb()));
after(async () => sql.end());
beforeEach(async () => limpar(sql));

const fixture = (id: number, liga: string, home: string, away: string) => ({
  id,
  league: { id: 1, name: liga },
  teams: { home: { id: 1, name: home }, away: { id: 2, name: away } },
  kickoff_utc: '2030-03-10T20:00:00Z',
  kickoff_ts: 0,
  status: 'scheduled',
});
const FIXTURES = [
  fixture(101, 'England Premier League', 'Arsenal', 'Chelsea'),
  fixture(102, 'Spain La Liga', 'Barcelona', 'Sevilla'),
  fixture(103, 'Liga Fora do MVP', 'X', 'Y'),
];
const ODDS = {
  fixture_id: 101,
  bookmakers: [
    {
      slug: 'bet365',
      odds: {
        '1x2': { closing: { home: 1.85, draw: 3.5, away: 4.5 } },
        btts: { closing: { yes: 1.75, no: 2.07 } },
      },
    },
  ],
};
const fakeFetch = (async (u: string) =>
  new Response(JSON.stringify({ data: /\/odds$/.test(u) ? ODDS : FIXTURES }))) as unknown as typeof fetch;

test('importa só as ligas do MVP, em 1 request', async () => {
  const urls: string[] = [];
  const r = await importarOdds(sql, { apiKey: 'k', fetch: ((u: string) => (urls.push(u), fakeFetch(u))) as typeof fetch }, '2030-03-10');
  assert.equal(urls.length, 1);
  assert.match(urls[0], /\/fixtures\?start_time=\d+&end_time=\d+/);
  assert.deepEqual(r.importados.map((i) => i.fixture_id), [101, 102]);
  // Reimportar não duplica.
  await importarOdds(sql, { apiKey: 'k', fetch: fakeFetch }, '2030-03-10');
  assert.equal((await sql`select count(*)::int as n from fixtures_dia`)[0].n, 2);
});

test('sem chave configurada dá erro amigável', async () => {
  await assert.rejects(importarOdds(sql, undefined, '2030-03-10'), /não configurada/);
});

test('mercadosDasOdds: RESULTADO, AMBOS MARCAM logo depois e derivados', () => {
  const ms = mercadosDasOdds(ODDS as never, 'Arsenal', 'Chelsea');
  assert.deepEqual([...new Set(ms.map((m) => m.grupo))], ['RESULTADO', 'AMBOS MARCAM', 'DUPLA CHANCE', 'EMPATE ANULA']);
  assert.deepEqual(ms.filter((m) => m.grupo === 'RESULTADO').map((m) => [m.descricao, m.multiplicador]), [
    ['ARSENAL', 1.85], ['EMPATE', 3.5], ['CHELSEA', 4.5],
  ]);
});

test('mercadosDaApi busca as odds do jogo e recusa jogo manual', async () => {
  await importarOdds(sql, { apiKey: 'k', fetch: fakeFetch }, '2030-03-10');
  await sql`insert into fixtures_dia (fixture_id, data, time_casa, time_fora, horario, campeonato)
            values (999, '2030-03-10', 'A', 'B', '2030-03-10T20:00:00Z', 'Manual')`;
  const la = await selecionarJogos(sql, { data: '2030-03-10', fixture_ids: [101, 999] });
  let url = '';
  const f = ((u: string) => ((url = u), fakeFetch(u))) as typeof fetch;
  const arsenal = la.jogos.find((j: any) => j.fixture_id === 101)!;
  const r = await mercadosDaApi(sql, { apiKey: 'k', fetch: f }, arsenal.id);
  assert.match(url, /\/fixtures\/101\/odds$/);
  assert.ok(r.mercados.length >= 5);
  const manual = la.jogos.find((j: any) => j.fixture_id === 999)!;
  await assert.rejects(mercadosDaApi(sql, { apiKey: 'k', fetch: f }, manual.id), /cadastrado na mão/);
});
