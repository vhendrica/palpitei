import assert from 'node:assert/strict';
import { after, before, beforeEach, test } from 'node:test';

import { selecionarJogos } from '../functions/_core/admin.ts';
import { fixtureIdDoEvento, importarOdds, mercadosDoEvento } from '../functions/_core/odds.ts';
import { limpar, setupDb, type Sql } from './helpers.ts';

let sql: Sql;
before(async () => (sql = await setupDb()));
after(async () => sql.end());
beforeEach(async () => limpar(sql));

const evento = (id: string, home: string, away: string, commence: string) => ({
  id,
  sport_key: 'soccer_brazil_campeonato',
  sport_title: 'Brazil Série A',
  commence_time: commence,
  home_team: home,
  away_team: away,
  bookmakers: [
    { markets: [
      { key: 'h2h', outcomes: [{ name: home, price: 1.8 }, { name: away, price: 4.6 }, { name: 'Draw', price: 3.6 }] },
      { key: 'totals', outcomes: [{ name: 'Over', price: 2.0, point: 2.5 }, { name: 'Under', price: 1.8, point: 2.5 }] },
    ] },
    { markets: [{ key: 'h2h', outcomes: [{ name: home, price: 1.9 }, { name: away, price: 4.4 }, { name: 'Draw', price: 3.4 }] }] },
  ],
});

const EVENTOS = [
  evento('aaaa1111bbbb2222cccc3333dddd4444', 'Corinthians', 'Mirassol', '2030-03-10T23:00:00Z'),
  evento('bbbb1111bbbb2222cccc3333dddd4444', 'Coritiba', 'Vitoria', '2030-03-10T19:00:00Z'),
  evento('cccc1111bbbb2222cccc3333dddd4444', 'Bahia', 'Santos', '2030-03-11T02:30:00Z'), // 23:30 em Fortaleza, ainda dia 10
  evento('dddd1111bbbb2222cccc3333dddd4444', 'Flamengo', 'Palmeiras', '2030-03-11T19:00:00Z'), // outro dia
];

const fakeFetch = (async () =>
  new Response(JSON.stringify(EVENTOS), { headers: { 'x-requests-remaining': '480' } })) as unknown as typeof fetch;

test('mercadosDoEvento usa a mediana das casas', () => {
  const m = mercadosDoEvento(EVENTOS[0]);
  assert.deepEqual(m, [
    { descricao: 'VITÓRIA CORINTHIANS', multiplicador: 1.85 },
    { descricao: 'EMPATE', multiplicador: 3.5 },
    { descricao: 'VITÓRIA MIRASSOL', multiplicador: 4.5 },
    { descricao: 'MAIS DE 2.5 GOLS', multiplicador: 2 },
    { descricao: 'MENOS DE 2.5 GOLS', multiplicador: 1.8 },
  ]);
});

test('importarOdds faz upsert só dos jogos do dia (fuso de Fortaleza) e é idempotente', async () => {
  const r = await importarOdds(sql, { apiKey: 'k', fetch: fakeFetch }, '2030-03-10');
  assert.equal(r.importados.length, 3);
  assert.equal(r.creditos_restantes, 480);
  await importarOdds(sql, { apiKey: 'k', fetch: fakeFetch }, '2030-03-10');
  const rows = await sql`select * from fixtures_dia order by horario`;
  assert.equal(rows.length, 3);
  assert.equal(rows[0].fonte, 'the_odds_api');
  assert.equal(rows[0].campeonato, 'Brasileirão Série A');
});

test('sem chave configurada dá erro amigável', async () => {
  await assert.rejects(importarOdds(sql, undefined, '2030-03-10'), /não configurada/);
});

test('montar a múltipla cria os mercados sugeridos pelas odds', async () => {
  await importarOdds(sql, { apiKey: 'k', fetch: fakeFetch }, '2030-03-10');
  const ids = EVENTOS.slice(0, 3).map((e) => fixtureIdDoEvento(e.id));
  const la = await selecionarJogos(sql, { data: '2030-03-10', fixture_ids: ids });
  assert.equal(la.jogos.length, 3);
  const corinthians = la.jogos.find((j: any) => j.time_casa === 'Corinthians')!;
  assert.deepEqual(corinthians.mercados.map((m: any) => [m.descricao, m.multiplicador]), [
    ['VITÓRIA CORINTHIANS', 1.85], ['EMPATE', 3.5], ['VITÓRIA MIRASSOL', 4.5], ['MAIS DE 2.5 GOLS', 2], ['MENOS DE 2.5 GOLS', 1.8],
  ]);
  // Remontar não duplica mercados.
  const la2 = await selecionarJogos(sql, { data: '2030-03-10', fixture_ids: ids });
  assert.equal(la2.jogos.find((j: any) => j.time_casa === 'Corinthians')!.mercados.length, 5);
});
