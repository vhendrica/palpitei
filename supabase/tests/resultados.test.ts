import assert from 'node:assert/strict';
import { after, before, beforeEach, test } from 'node:test';

import { aplicarPlacar, atualizarResultados } from '../functions/_core/resultados.ts';
import { criarLiga, limpar, setupDb, type Sql } from './helpers.ts';

let sql: Sql;
before(async () => (sql = await setupDb()));
after(async () => sql.end());
beforeEach(async () => limpar(sql));

const marcados = async (jogo: string) =>
  (await sql`select descricao from mercados where jogo_id = ${jogo} and resultado_final order by descricao`).map(
    (m) => m.descricao,
  );

test('aplicarPlacar marca os mercados que bateram', async () => {
  const { jogos } = await criarLiga(sql);
  await sql`insert into mercados (jogo_id, grupo, descricao, multiplicador) values
    (${jogos[0]}, 'GOLS 2.5', 'MAIS DE 2.5', 2), (${jogos[0]}, 'AMBOS MARCAM', 'SIM', 2)`;
  await aplicarPlacar(sql, jogos[0], 2, 1);
  assert.deepEqual(await marcados(jogos[0]), ['CASA VENCE', 'MAIS DE 2.5', 'SIM']);
  const [j] = await sql`select placar_casa, placar_fora, finalizado_em from jogos where id = ${jogos[0]}`;
  assert.deepEqual([j.placar_casa, j.placar_fora, !!j.finalizado_em], [2, 1, true]);
});

test('atualizarResultados só consulta a API com jogo rolando e aplica os finalizados', async () => {
  const { jogos } = await criarLiga(sql);
  const urls: string[] = [];
  const fakeFetch = (async (u: string) => {
    urls.push(u);
    return new Response(
      JSON.stringify([
        { id: 'ev1', completed: true, home_team: 'Casa0', away_team: 'Fora0', scores: [{ name: 'Casa0', score: '1' }, { name: 'Fora0', score: '1' }] },
      ]),
      { headers: { 'x-requests-remaining': '400' } },
    );
  }) as unknown as typeof fetch;
  const cfg = { apiKey: 'k', fetch: fakeFetch };
  assert.equal((await atualizarResultados(sql, cfg)).consultados, 0);
  assert.equal(urls.length, 0);

  const [j] = await sql`select fixture_id from jogos where id = ${jogos[0]}`;
  await sql`insert into fixtures_dia (fixture_id, data, time_casa, time_fora, horario, campeonato, fonte, externo_id, externo_esporte)
            values (${j.fixture_id}, '2030-01-01', 'Casa0', 'Fora0', now(), 'Série A', 'the_odds_api', 'ev1', 'soccer_epl')`;
  await sql`update jogos set horario = now() - interval '2 hours' where id = ${jogos[0]}`;
  const r = await atualizarResultados(sql, cfg);
  assert.equal(r.finalizados.length, 1);
  assert.match(urls[0], /soccer_epl\/scores\/.*eventIds=ev1/);
  assert.deepEqual(await marcados(jogos[0]), ['EMPATE']);
  assert.equal((await atualizarResultados(sql, cfg)).consultados, 0);
});

test('placar parcial marca na hora só os mercados que já não mudam', async () => {
  const { jogos } = await criarLiga(sql);
  const jogo = jogos[0];
  await sql`insert into mercados (jogo_id, grupo, descricao, multiplicador, ordem) values
    (${jogo}, 'GOLS 2.5', 'Mais de 2.5', 2, 90), (${jogo}, 'GOLS 2.5', 'Menos de 2.5', 1.8, 91),
    (${jogo}, 'GOLS 4.5', 'Mais de 4.5', 5, 92)`;
  const [j] = await sql`select fixture_id from jogos where id = ${jogo}`;
  await sql`insert into fixtures_dia (fixture_id, data, time_casa, time_fora, horario, campeonato, fonte, externo_id, externo_esporte)
            values (${j.fixture_id}, '2030-01-01', 'Casa0', 'Fora0', now(), 'Série A', 'the_odds_api', 'ev2', 'soccer_epl')`;
  await sql`update jogos set horario = now() - interval '30 minutes' where id = ${jogo}`;
  const fakeFetch = (async () =>
    new Response(JSON.stringify([
      { id: 'ev2', completed: false, home_team: 'Casa0', away_team: 'Fora0', scores: [{ name: 'Casa0', score: '2' }, { name: 'Fora0', score: '1' }] },
    ]))) as unknown as typeof fetch;
  const r = await atualizarResultados(sql, { apiKey: 'k', fetch: fakeFetch });
  assert.equal(r.finalizados.length, 0);
  const ms = await sql`select descricao, resultado_final, decidido_em is not null as decidido from mercados
                       where jogo_id = ${jogo} and ordem >= 90 order by ordem`;
  assert.deepEqual(ms.map((m) => [m.descricao, m.decidido, m.resultado_final]), [
    ['Mais de 2.5', true, true],
    ['Menos de 2.5', true, false],
    ['Mais de 4.5', false, false],
  ]);
  const [pl] = await sql`select placar_casa, finalizado_em from jogos where id = ${jogo}`;
  assert.equal(pl.placar_casa, 2);
  assert.equal(pl.finalizado_em, null);
});
