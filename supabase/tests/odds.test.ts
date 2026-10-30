import assert from 'node:assert/strict';
import { after, before, beforeEach, test } from 'node:test';

import { selecionarJogos } from '../functions/_core/admin.ts';
import { fixtureIdDoEvento, importarOdds, mercadosDaApi, mercadosDoEvento, mercadosExtrasDoEvento } from '../functions/_core/odds.ts';
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
    { grupo: 'RESULTADO', descricao: 'CORINTHIANS', multiplicador: 1.85 },
    { grupo: 'RESULTADO', descricao: 'EMPATE', multiplicador: 3.5 },
    { grupo: 'RESULTADO', descricao: 'MIRASSOL', multiplicador: 4.5 },
    { grupo: 'GOLS 2.5', descricao: 'MAIS DE 2.5', multiplicador: 2 },
    { grupo: 'GOLS 2.5', descricao: 'MENOS DE 2.5', multiplicador: 1.8 },
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
  assert.deepEqual(corinthians.mercados.map((m: any) => [m.grupo, m.descricao, m.multiplicador]), [
    ['RESULTADO', 'CORINTHIANS', 1.85], ['RESULTADO', 'EMPATE', 3.5], ['RESULTADO', 'MIRASSOL', 4.5],
    ['GOLS 2.5', 'MAIS DE 2.5', 2], ['GOLS 2.5', 'MENOS DE 2.5', 1.8],
  ]);
  // Remontar não duplica mercados.
  const la2 = await selecionarJogos(sql, { data: '2030-03-10', fixture_ids: ids });
  assert.equal(la2.jogos.find((j: any) => j.time_casa === 'Corinthians')!.mercados.length, 5);
});

const EXTRAS = {
  ...EVENTOS[0],
  bookmakers: [
    { key: 'coolbet', markets: [
      { key: 'alternate_totals', outcomes: [{ name: 'Over', price: 1.35, point: 2.5 }, { name: 'Over', price: 1.82, point: 3.0 }] },
    ] },
    { key: 'pinnacle', markets: [
      { key: 'btts', outcomes: [{ name: 'Yes', price: 1.75 }, { name: 'No', price: 2.07 }] },
      { key: 'double_chance', outcomes: [
        { name: 'Mirassol or Draw', price: 2.84 }, { name: 'Corinthians or Draw', price: 1.07 }, { name: 'Mirassol or Corinthians', price: 1.27 },
      ] },
      { key: 'draw_no_bet', outcomes: [{ name: 'Mirassol', price: 7.23 }, { name: 'Corinthians', price: 1.1 }] },
      { key: 'alternate_totals', outcomes: [{ name: 'Over', price: 2.19, point: 2.5 }, { name: 'Under', price: 1.7, point: 2.5 }] },
    ] },
    { key: 'matchbook', markets: [{ key: 'btts', outcomes: [{ name: 'Yes', price: 2.06 }, { name: 'No', price: 1.69 }] }] },
  ],
};

test('mercadosExtrasDoEvento: Pinnacle como referência, só linhas .5, ordem estável', () => {
  assert.deepEqual(mercadosExtrasDoEvento(EXTRAS).map((m) => [m.grupo, m.descricao, m.multiplicador, m.casas]), [
    ['AMBOS MARCAM', 'SIM', 1.75, 2],
    ['AMBOS MARCAM', 'NÃO', 2.07, 2],
    ['DUPLA CHANCE', 'CORINTHIANS OU EMPATE', 1.07, 1],
    ['DUPLA CHANCE', 'MIRASSOL OU EMPATE', 2.84, 1],
    ['DUPLA CHANCE', 'MIRASSOL OU CORINTHIANS', 1.27, 1],
    ['EMPATE ANULA', 'CORINTHIANS', 1.1, 1],
    ['EMPATE ANULA', 'MIRASSOL', 7.23, 1],
    ['GOLS 2.5', 'MAIS DE 2.5', 2.19, 2],
    ['GOLS 2.5', 'MENOS DE 2.5', 1.7, 1],
  ]);
});

test('mercadosDaApi busca o evento do jogo e recusa jogo manual', async () => {
  await importarOdds(sql, { apiKey: 'k', fetch: fakeFetch }, '2030-03-10');
  await sql`insert into fixtures_dia (fixture_id, data, time_casa, time_fora, horario, campeonato)
            values (999, '2030-03-10', 'A', 'B', '2030-03-10T20:00:00Z', 'Manual')`;
  const ids = [fixtureIdDoEvento(EVENTOS[0].id), fixtureIdDoEvento(EVENTOS[1].id), 999];
  const la = await selecionarJogos(sql, { data: '2030-03-10', fixture_ids: ids });
  let url = '';
  const f = (async (u: string) => ((url = u), new Response(JSON.stringify(EXTRAS), { headers: { 'x-requests-remaining': '470' } }))) as unknown as typeof fetch;
  const corinthians = la.jogos.find((j: any) => j.time_casa === 'Corinthians')!;
  const r = await mercadosDaApi(sql, { apiKey: 'k', fetch: f }, corinthians.id);
  assert.match(url, /soccer_brazil_campeonato\/events\/aaaa1111bbbb2222cccc3333dddd4444\/odds/);
  assert.equal(r.mercados.length, 9);
  assert.equal(r.creditos_restantes, 470);
  const manual = la.jogos.find((j: any) => j.time_casa === 'A')!;
  await assert.rejects(mercadosDaApi(sql, { apiKey: 'k', fetch: f }, manual.id), /cadastrado na mão/);
});
