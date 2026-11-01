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
