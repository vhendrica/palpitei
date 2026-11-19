import assert from 'node:assert/strict';
import { after, before, beforeEach, test } from 'node:test';

import { selecionarJogos } from '../functions/_core/admin.ts';
import { _limparCatalogo, importarOdds, mercadosDaApi, mercadosDasOdds, principais } from '../functions/_core/odds.ts';
import { limpar, setupDb, type Sql } from './helpers.ts';

let sql: Sql;
before(async () => (sql = await setupDb()));
after(async () => sql.end());
beforeEach(async () => (_limparCatalogo(), limpar(sql)));

const fixture = (id: string, home: string, away: string, startTime = '2030-03-10T20:00:00.000Z') => ({
  fixtureId: id,
  tournamentId: 325,
  tournamentName: 'Brasileiro Serie A',
  participant1Name: home,
  participant2Name: away,
  startTime,
  hasOdds: true,
});
const FIXTURES = [
  fixture('id101', 'CR Flamengo RJ', 'SE Palmeiras SP'),
  fixture('id102', 'Sao Paulo FC SP', 'Santos FC SP'),
  // Dia seguinte em Fortaleza (03:00Z+): fica fora.
  fixture('id103', 'X', 'Y', '2030-03-11T04:00:00.000Z'),
];
const CATALOGO = [
  { marketId: 101, marketType: '1x2', period: 'fulltime', handicap: 0, playerProp: false, outcomes: [{ outcomeId: 101, outcomeName: '1' }, { outcomeId: 102, outcomeName: 'X' }, { outcomeId: 103, outcomeName: '2' }] },
  { marketId: 104, marketType: 'bothteamsscore', period: 'fulltime', handicap: 0, playerProp: false, outcomes: [{ outcomeId: 104, outcomeName: 'Yes' }, { outcomeId: 105, outcomeName: 'No' }] },
  { marketId: 1010, marketType: 'totals', period: 'fulltime', handicap: 2.5, playerProp: false, outcomes: [{ outcomeId: 1010, outcomeName: 'Over' }, { outcomeId: 1011, outcomeName: 'Under' }] },
  { marketId: 1012, marketType: 'totals', period: 'fulltime', handicap: 2.25, playerProp: false, outcomes: [{ outcomeId: 1012, outcomeName: 'Over' }, { outcomeId: 1013, outcomeName: 'Under' }] },
  { marketId: 1020, marketType: 'totals-corners', period: 'fulltime', handicap: 9.5, playerProp: false, outcomes: [{ outcomeId: 1020, outcomeName: 'Over' }, { outcomeId: 1021, outcomeName: 'Under' }] },
  { marketId: 1030, marketType: 'totals', period: 'p2', handicap: 0.5, playerProp: false, outcomes: [{ outcomeId: 1030, outcomeName: 'Over' }, { outcomeId: 1031, outcomeName: 'Under' }] },
  { marketId: 2000, marketType: 'players-anytimegoalscorer', period: 'result', handicap: 0, playerProp: true, outcomes: [{ outcomeId: 2000, outcomeName: 'Yes' }, { outcomeId: 2001, outcomeName: 'No' }] },
];
const preco = (price: number, playerName: string | null = null) => ({ players: { [playerName ? '7' : '0']: { active: true, price, playerName } } });
const ODDS = {
  fixtureId: 'id101',
  bookmakerOdds: {
    '1xbet': {
      bookmakerIsActive: true,
      markets: {
        101: { outcomes: { 101: preco(1.85), 102: preco(3.5), 103: preco(4.5) } },
        104: { outcomes: { 104: preco(1.75), 105: preco(2.07) } },
        1010: { outcomes: { 1010: preco(1.9), 1011: preco(1.95) } },
        1012: { outcomes: { 1012: preco(1.7), 1013: preco(2.1) } },
        1020: { outcomes: { 1020: preco(1.8), 1021: preco(2.0) } },
        1030: { outcomes: { 1030: preco(1.3), 1031: preco(3.2) } },
        2000: { outcomes: { 2000: preco(2.4, 'Pedro, Guilherme'), 2001: preco(1.5, 'Pedro, Guilherme') } },
      },
    },
    bet365: { markets: { 101: { outcomes: { 101: preco(9) } } } },
  },
};
const CAT = new Map(CATALOGO.map((m) => [m.marketId, m]));

const fakeFetch = (async (u: string) => {
  const body = u.includes('/fixtures?') ? FIXTURES : u.includes('/markets?') ? CATALOGO : u.includes('/odds?') ? ODDS : [];
  return new Response(JSON.stringify(body));
}) as unknown as typeof fetch;

test('importa os jogos do dia dos campeonatos configurados', async () => {
  const urls: string[] = [];
  const cfg = { apiKey: 'k', torneios: [325], fetch: ((u: string) => (urls.push(u), fakeFetch(u))) as typeof fetch };
  const r = await importarOdds(sql, cfg, '2030-03-10');
  assert.equal(urls.length, 1);
  assert.match(urls[0], /^https:\/\/api\.oddspapi\.io\/v4\/fixtures\?tournamentId=325&from=2030-03-10&to=2030-03-11&apiKey=k$/);
  assert.deepEqual(r.importados.map((i) => i.fixture_id), [101, 102]);
  const [f] = await sql`select fonte, externo_id, campeonato from fixtures_dia where fixture_id = 101`;
  assert.deepEqual([f.fonte, f.externo_id, f.campeonato], ['oddspapi', 'id101', 'Brasileirão Série A']);
  await importarOdds(sql, cfg, '2030-03-10');
  assert.equal((await sql`select count(*)::int as n from fixtures_dia`)[0].n, 2);
});

test('sem chave configurada dá erro amigável', async () => {
  await assert.rejects(importarOdds(sql, undefined, '2030-03-10'), /não configurada/);
});

test('mercadosDasOdds: só a 1xBet, nomes no formato que liquida pelo placar e props por jogador', () => {
  const ms = mercadosDasOdds(ODDS as never, CAT, 'Flamengo', 'Palmeiras');
  assert.deepEqual(ms.filter((m) => m.grupo === 'RESULTADO').map((m) => [m.descricao, m.multiplicador]), [
    ['FLAMENGO', 1.85], ['EMPATE', 3.5], ['PALMEIRAS', 4.5],
  ]);
  const grupos = [...new Set(ms.map((m) => m.grupo))];
  // linha asiática (2.25) e 2º tempo ficam fora
  assert.deepEqual(grupos, ['RESULTADO', 'AMBOS MARCAM', 'GOLS 2.5', 'ESCANTEIOS 9.5', 'MARCA NO JOGO']);
  assert.deepEqual(ms.find((m) => m.grupo === 'MARCA NO JOGO'), {
    grupo: 'MARCA NO JOGO', descricao: 'GUILHERME PEDRO', multiplicador: 2.4, casas: 1, real: undefined, categoria: 'JOGADOR',
  });
  assert.deepEqual(principais(ms).map((m) => m.grupo), ['RESULTADO', 'RESULTADO', 'RESULTADO', 'AMBOS MARCAM', 'AMBOS MARCAM', 'GOLS 2.5', 'GOLS 2.5']);
});

test('mercadosDaApi busca as odds do jogo e recusa jogo manual', async () => {
  await importarOdds(sql, { apiKey: 'k', torneios: [325], fetch: fakeFetch }, '2030-03-10');
  await sql`insert into fixtures_dia (fixture_id, data, time_casa, time_fora, horario, campeonato)
            values (999, '2030-03-10', 'A', 'B', '2030-03-10T20:00:00Z', 'Manual')`;
  const la = await selecionarJogos(sql, { data: '2030-03-10', fixture_ids: [101, 999] });
  const urls: string[] = [];
  const f = ((u: string) => (urls.push(u), fakeFetch(u))) as typeof fetch;
  const jogo = la.jogos.find((j: any) => j.fixture_id === 101)!;
  const r = await mercadosDaApi(sql, { apiKey: 'k', fetch: f }, jogo.id);
  assert.ok(urls.some((u) => /\/v4\/odds\?fixtureId=id101&bookmakers=1xbet&apiKey=k$/.test(u)));
  assert.ok(r.mercados.length >= 8);
  const manual = la.jogos.find((j: any) => j.fixture_id === 999)!;
  await assert.rejects(mercadosDaApi(sql, { apiKey: 'k', fetch: f }, manual.id), /cadastrado na mão/);
});
