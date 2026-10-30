import assert from 'node:assert/strict';
import { after, before, beforeEach, test } from 'node:test';

import { createApi } from '../functions/_core/http.ts';
import { limpar, setupDb, type Sql } from './helpers.ts';

let sql: Sql;
let api: ReturnType<typeof createApi>;
let codigos: string[];
const HOJE = '2030-03-10';

before(async () => (sql = await setupDb()));
after(async () => sql.end());
beforeEach(async () => {
  await limpar(sql);
  codigos = [];
  api = createApi({ sql, send: async (_w, c) => void codigos.push(c), otp: { reenvioMs: 0 }, hoje: () => HOJE });
});

async function call(method: string, path: string, body?: unknown, token?: string) {
  const res = await api(
    new Request(`http://x/functions/v1/api${path}`, {
      method,
      headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
  );
  return { status: res.status, body: (await res.json()) as any };
}

async function registrar(whatsapp: string, cpf: string, nome = 'Fulano Teste') {
  const c = await call('POST', '/auth/cadastro', {
    nome, whatsapp, cpf, data_nascimento: '1990-01-01', bairro: 'Benfica', aceita_termos: true, aceita_compartilhamento: true,
  });
  assert.equal(c.status, 200, JSON.stringify(c.body));
  const r = await call('POST', '/auth/confirmar', { whatsapp, codigo: codigos.at(-1) });
  assert.equal(r.status, 200);
  return r.body.token as string;
}

test('fluxo completo: admin monta a múltipla, usuário entra, distribui, ranking e finalização', async () => {
  const adminToken = await registrar('85900000001', '52998224725', 'Admin Palpit');
  const userToken = await registrar('85900000002', '11144477735', 'Maria Souza');
  await sql`update users set is_admin = true where whatsapp = '85900000001'`;

  // usuário comum não acessa admin; anônimo não entra na liga
  assert.equal((await call('GET', '/admin/config', undefined, userToken)).status, 403);
  assert.equal((await call('GET', '/admin/config')).status, 401);

  // home sem múltipla
  let home = await call('GET', '/home');
  assert.equal(home.status, 200);
  assert.equal(home.body.liga, null);
  assert.equal(home.body.premio.meta.valor, 500);

  // admin: escada, pool, seleção, destaque, mercados
  const escada = await call('PUT', '/admin/premio-escada', { faixas: [{ usuarios_min: 1, valor: 50 }, { usuarios_min: 3, valor: 150 }] }, adminToken);
  assert.equal(escada.status, 200);
  for (const [i, casa] of ['Fortaleza', 'Ceará', 'Ferroviário', 'Floresta'].entries()) {
    const f = await call('POST', '/admin/fixtures', {
      fixture_id: 9000 + i, time_casa: casa, time_fora: 'Visitante', horario: '2030-03-10T23:00:00Z', campeonato: 'Cearense', data: HOJE,
    }, adminToken);
    assert.equal(f.status, 200, JSON.stringify(f.body));
  }
  assert.equal((await call('GET', `/admin/fixtures?data=${HOJE}`, undefined, adminToken)).body.fixtures.length, 4);
  const errado = await call('POST', '/admin/liga/selecionar', { data: HOJE, fixture_ids: [9000, 9001] }, adminToken);
  assert.equal(errado.body.error, 'Selecione exatamente 3 jogos.');
  const sel = await call('POST', '/admin/liga/selecionar', { data: HOJE, fixture_ids: [9000, 9001, 9002], premio_desc: 'Voucher' }, adminToken);
  assert.equal(sel.status, 200);
  assert.equal(sel.body.jogos.length, 3);
  const ligaId = sel.body.liga.id;
  const ceara = sel.body.jogos.find((j: any) => j.time_casa === 'Ceará');
  assert.equal((await call('POST', `/admin/jogos/${ceara.id}/destaque`, undefined, adminToken)).status, 200);
  for (const j of sel.body.jogos) {
    const m = await call('PUT', `/admin/jogos/${j.id}/mercados`, {
      mercados: [{ descricao: 'casa vence', multiplicador: 2 }, { descricao: 'empate', multiplicador: 3.2 }],
    }, adminToken);
    assert.equal(m.status, 200, JSON.stringify(m.body));
  }

  // home pública: destaque primeiro, mercados por jogo, barra do prêmio
  home = await call('GET', '/home');
  assert.equal(home.body.jogos[0].time_casa, 'Ceará');
  assert.equal(home.body.jogos[0].destaque, true);
  assert.equal(home.body.jogos[0].mercados[0].descricao, 'CASA VENCE');
  assert.equal(home.body.premio.palpiteiros, 0);
  assert.equal(home.body.premio.faltam_meta, 3);
  assert.equal(home.body.eu, null);

  // usuário entra e distribui
  assert.equal((await call('POST', '/liga/hoje/entrar')).status, 401);
  const e = await call('POST', '/liga/hoje/entrar', undefined, userToken);
  assert.deepEqual([e.status, e.body.fichas_total, e.body.saldo_pontos], [200, 200, 400]);
  const dup = await call('POST', '/liga/hoje/entrar', undefined, userToken);
  assert.deepEqual([dup.status, dup.body.error], [400, 'Você já está nesse palpite.']);

  // depois que alguém entrou não dá pra trocar os jogos
  const troca = await call('POST', '/admin/liga/selecionar', { data: HOJE, fixture_ids: [9000, 9001, 9003] }, adminToken);
  assert.equal(troca.body.error, 'Não dá pra trocar os jogos: já tem palpiteiros nessa múltipla.');

  home = await call('GET', '/home', undefined, userToken);
  const [mA, mB] = [home.body.jogos[0].mercados[0].id, home.body.jogos[1].mercados[1].id];
  const ap = await call('POST', '/liga/hoje/apostas', { distribuicao: { [mA]: 120, [mB]: 80 } }, userToken);
  assert.deepEqual(ap.body, { fichas_distribuidas: 200, fichas_livres: 0 });

  // mercado com fichas não pode ser removido
  const rm = await call('PUT', `/admin/jogos/${home.body.jogos[0].id}/mercados`, { mercados: [] }, adminToken);
  assert.match(rm.body.error, /já recebeu fichas/);

  home = await call('GET', '/home', undefined, userToken);
  assert.equal(home.body.eu.fichas_livres, 0);
  assert.equal(home.body.jogos[0].mercados[0].minhas_fichas, 120);
  assert.equal(home.body.premio.palpiteiros, 1);
  assert.equal(home.body.premio.premio_atual, 50);
  assert.equal(home.body.premio.proxima.faltam, 2);

  const rk = await call('GET', '/liga/hoje/ranking', undefined, userToken);
  assert.equal(rk.body.ranking[0].nome, 'Maria S.');
  assert.equal(rk.body.ranking[0].eu, true);
  assert.equal(rk.body.ranking[0].user_id, undefined);

  const fin = await call('POST', `/admin/liga/${ligaId}/finalizar`, { mercados_vencedores: [mA] }, adminToken);
  assert.equal(fin.status, 200);
  assert.equal(fin.body.premio_final, 50);
  assert.equal(fin.body.voucher.valor, 50);

  const me = await call('GET', '/me', undefined, userToken);
  assert.equal(me.body.user.saldo_pontos, 500);
  assert.equal(me.body.vouchers[0].valor, 50);
  assert.equal(me.body.historico[0].data, HOJE);
});

test('rotas desconhecidas e logout', async () => {
  assert.equal((await call('GET', '/nada')).status, 404);
  assert.equal((await call('DELETE', '/home')).status, 405);
  const t = await registrar('85900000003', '52998224725');
  assert.equal((await call('GET', '/me', undefined, t)).status, 200);
  await call('POST', '/auth/logout', undefined, t);
  assert.equal((await call('GET', '/me', undefined, t)).status, 401);
});
