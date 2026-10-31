import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, test } from 'node:test';

import { RuleError } from '../functions/_core/errors.ts';
import {
  apostar,
  calcularRanking,
  entrarNaLiga,
  fichasDisponiveis,
  finalizarLiga,
  getLigaAtual,
  reativarLiga,
  pontuacaoUsuario,
} from '../functions/_core/rules.ts';
import { removerPalpiteiro } from '../functions/_core/admin.ts';
import { palpiteirosDoDia } from '../functions/_core/services.ts';
import { criarLiga, criarUser, limpar, saldo, setupDb, type Sql } from './helpers.ts';

let sql: Sql;
before(async () => (sql = await setupDb()));
after(async () => sql.end());
beforeEach(async () => limpar(sql));

describe('entrarNaLiga', () => {
  test('debita 100 PONTOS e libera 200 FICHAS', async () => {
    const u = await criarUser(sql);
    const { ligaId } = await criarLiga(sql);
    const r = await entrarNaLiga(sql, u, ligaId);
    assert.equal(r.saldo_pontos, 400);
    assert.equal(await saldo(sql, u), 400);
    assert.equal(await fichasDisponiveis(sql, u, ligaId), 200);
  });

  test('saldo insuficiente', async () => {
    const u = await criarUser(sql, { saldo_pontos: 99 });
    const { ligaId } = await criarLiga(sql);
    await assert.rejects(entrarNaLiga(sql, u, ligaId), { message: 'Saldo insuficiente. Você precisa de 100 PONTOS.' });
    assert.equal(await saldo(sql, u), 99);
  });

  test('entrada duplicada (inclusive concorrente) cobra uma vez só', async () => {
    const u = await criarUser(sql);
    const { ligaId } = await criarLiga(sql);
    const res = await Promise.allSettled([entrarNaLiga(sql, u, ligaId), entrarNaLiga(sql, u, ligaId)]);
    assert.equal(res.filter((r) => r.status === 'fulfilled').length, 1);
    const falha = res.find((r) => r.status === 'rejected') as PromiseRejectedResult;
    assert.equal(falha.reason.message, 'Você já está nesse palpite.');
    assert.equal(await saldo(sql, u), 400);
    await assert.rejects(entrarNaLiga(sql, u, ligaId), { message: 'Você já está nesse palpite.' });
  });

  test('liga fechada', async () => {
    const u = await criarUser(sql);
    const { ligaId } = await criarLiga(sql, '2030-01-02', 'em_andamento');
    await assert.rejects(entrarNaLiga(sql, u, ligaId), { message: 'Esse palpite não está aberto para entrada.' });
  });

  test('liga inexistente', async () => {
    const u = await criarUser(sql);
    await assert.rejects(entrarNaLiga(sql, u, '00000000-0000-0000-0000-000000000000'), {
      message: 'Palpite não encontrado.',
    });
  });
});

describe('apostar (distribuição de fichas)', () => {
  test('distribui entre mercados de jogos diferentes sem mexer nos PONTOS', async () => {
    const u = await criarUser(sql);
    const { ligaId, mercados } = await criarLiga(sql);
    await entrarNaLiga(sql, u, ligaId);
    const r = await apostar(sql, u, ligaId, { [mercados[0]]: 50, [mercados[2]]: 30, [mercados[5]]: 20 });
    assert.deepEqual(r, { fichas_distribuidas: 100, fichas_livres: 100 });
    assert.equal(await fichasDisponiveis(sql, u, ligaId), 100);
    assert.equal(await saldo(sql, u), 400);
    await apostar(sql, u, ligaId, { [mercados[0]]: 100 });
    assert.equal(await fichasDisponiveis(sql, u, ligaId), 0);
  });

  test('não passa das fichas livres', async () => {
    const u = await criarUser(sql);
    const { ligaId, mercados } = await criarLiga(sql);
    await entrarNaLiga(sql, u, ligaId);
    await apostar(sql, u, ligaId, { [mercados[0]]: 150 });
    await assert.rejects(apostar(sql, u, ligaId, { [mercados[1]]: 60 }), {
      message: 'Você tem 50 fichas livres e tentou distribuir 60.',
    });
  });

  test('distribuições simultâneas não estouram o total', async () => {
    const u = await criarUser(sql);
    const { ligaId, mercados } = await criarLiga(sql);
    await entrarNaLiga(sql, u, ligaId);
    const res = await Promise.allSettled([
      apostar(sql, u, ligaId, { [mercados[0]]: 150 }),
      apostar(sql, u, ligaId, { [mercados[1]]: 150 }),
    ]);
    assert.equal(res.filter((r) => r.status === 'fulfilled').length, 1);
    assert.equal(await fichasDisponiveis(sql, u, ligaId), 50);
  });

  test('erros de regra', async () => {
    const u = await criarUser(sql);
    const { ligaId, mercados } = await criarLiga(sql);
    const outra = await criarLiga(sql, '2030-01-03');
    await assert.rejects(apostar(sql, u, ligaId, { [mercados[0]]: 10 }), {
      message: 'Entre no palpite antes de distribuir fichas.',
    });
    await entrarNaLiga(sql, u, ligaId);
    await assert.rejects(apostar(sql, u, ligaId, {}), { message: 'Distribua pelo menos 1 ficha.' });
    await assert.rejects(apostar(sql, u, ligaId, { [mercados[0]]: 1.5 }), {
      message: 'Use apenas números inteiros de fichas.',
    });
    await assert.rejects(apostar(sql, u, ligaId, { [outra.mercados[0]]: 10 }), {
      message: 'Mercado inválido para esse palpite.',
    });
    await assert.rejects(apostar(sql, u, ligaId, { 'nao-existe': 10 }), { message: 'Mercado inválido para esse palpite.' });
  });

  test('jogo que já começou e liga fechada', async () => {
    const u = await criarUser(sql);
    const { ligaId, jogos, mercados } = await criarLiga(sql);
    await entrarNaLiga(sql, u, ligaId);
    await sql`update jogos set horario = now() - interval '1 minute' where id = ${jogos[1]}`;
    await assert.rejects(apostar(sql, u, ligaId, { [mercados[2]]: 10 }), {
      message: 'Esse jogo já começou. Apostas encerradas para ele.',
    });
    await sql`update ligas set status = 'em_andamento' where id = ${ligaId}`;
    await assert.rejects(apostar(sql, u, ligaId, { [mercados[0]]: 10 }), {
      message: 'Apostas encerradas para esse palpite.',
    });
  });
});

describe('pontuação e ranking', () => {
  test('pontuação = SUM(fichas × multiplicador) dos mercados vencedores; acerto parcial conta', async () => {
    const u = await criarUser(sql);
    const { ligaId, mercados } = await criarLiga(sql);
    await entrarNaLiga(sql, u, ligaId);
    await apostar(sql, u, ligaId, { [mercados[0]]: 50, [mercados[1]]: 50, [mercados[2]]: 100 });
    assert.equal(await pontuacaoUsuario(sql, u, ligaId), 0);
    // jogo 0: CASA VENCE (2x) bateu; jogo 1: EMPATE bateu mas o user apostou em CASA VENCE.
    await sql`update mercados set resultado_final = true where id in ${sql([mercados[0], mercados[3]])}`;
    assert.equal(await pontuacaoUsuario(sql, u, ligaId), 100);
  });

  test('desempate: quem apostou primeiro; depois quem criou a conta antes; sem aposta vai pro fim', async () => {
    const antigo = await criarUser(sql, { nome: 'Antigo Silva', created_at: '2026-01-01T00:00:00.000Z' });
    const novo = await criarUser(sql, { nome: 'Novo Souza', created_at: '2026-06-01T00:00:00.000Z' });
    const rapido = await criarUser(sql, { nome: 'Rápido Lima', created_at: '2026-09-01T00:00:00.000Z' });
    const parado = await criarUser(sql, { nome: 'Parado Costa', created_at: '2025-01-01T00:00:00.000Z' });
    const { ligaId, mercados } = await criarLiga(sql);
    for (const u of [antigo, novo, rapido, parado]) await entrarNaLiga(sql, u, ligaId);

    await apostar(sql, rapido, ligaId, { [mercados[0]]: 100 });
    await apostar(sql, novo, ligaId, { [mercados[0]]: 100 });
    await apostar(sql, antigo, ligaId, { [mercados[0]]: 100 });
    // empate exato de timestamp entre `novo` e `antigo` → decide users.created_at
    await sql`update apostas set created_at = '2030-01-01T12:00:00.123Z' where user_id in ${sql([novo, antigo])}`;
    await sql`update apostas set created_at = '2030-01-01T12:00:00.122Z' where user_id = ${rapido}`;
    await sql`update mercados set resultado_final = true where id = ${mercados[0]}`;

    const r = await calcularRanking(sql, ligaId);
    assert.deepEqual(
      r.map((x) => [x.posicao, x.nome, x.pontuacao]),
      [
        [1, 'Rápido L.', 200],
        [2, 'Antigo S.', 200],
        [3, 'Novo S.', 200],
        [4, 'Parado C.', 0],
      ],
    );
    assert.equal(r[0].primeira_aposta_em, '2030-01-01T12:00:00.122Z');
  });
});

describe('finalizarLiga', () => {
  test('marca resultados, grava premio_final pela escada, emite voucher e devolve a entrada ao 1º', async () => {
    await sql`delete from premio_escada`;
    await sql`insert into premio_escada (ordem, usuarios_min, valor) values (1, 2, 100), (2, 3, 300), (3, 5, 500)`;
    const a = await criarUser(sql);
    const b = await criarUser(sql);
    const c = await criarUser(sql);
    const { ligaId, mercados } = await criarLiga(sql);
    for (const u of [a, b, c]) await entrarNaLiga(sql, u, ligaId);
    await apostar(sql, a, ligaId, { [mercados[1]]: 200 });
    await apostar(sql, b, ligaId, { [mercados[0]]: 120, [mercados[2]]: 80 });

    const r = await finalizarLiga(sql, ligaId, [mercados[0], mercados[2]]);
    assert.equal(r.palpiteiros, 3);
    assert.equal(r.premio_final, 300);
    assert.equal(r.ranking[0].user_id, b);
    assert.equal(r.ranking[0].pontuacao, 400);
    assert.ok(r.voucher && /^PT-[A-Z2-9]{6}$/.test(r.voucher.codigo));
    assert.equal(r.voucher!.valor, 300);
    assert.equal(r.voucher!.user_id, b);
    assert.equal(await saldo(sql, b), 500);
    assert.equal(await saldo(sql, a), 400);

    const [liga] = await sql`select status, premio_final from ligas where id = ${ligaId}`;
    assert.equal(liga.status, 'finalizada');
    assert.equal(Number(liga.premio_final), 300);
    await assert.rejects(finalizarLiga(sql, ligaId, []), { message: 'Palpite já finalizado.' });
  });

  test('reativar desfaz a finalização: apaga voucher, retira os PONTOS do vencedor e reabre', async () => {
    const a = await criarUser(sql);
    const { ligaId, mercados } = await criarLiga(sql);
    await entrarNaLiga(sql, a, ligaId);
    await apostar(sql, a, ligaId, { [mercados[0]]: 50 });
    await assert.rejects(reativarLiga(sql, ligaId), { message: 'Esse palpite não está finalizado.' });
    await finalizarLiga(sql, ligaId, [mercados[0]]);
    assert.equal(await saldo(sql, a), 500);

    await reativarLiga(sql, ligaId);
    assert.equal(await saldo(sql, a), 400);
    const [liga] = await sql`select status, premio_final, finalizada_em from ligas where id = ${ligaId}`;
    assert.equal(liga.status, 'aberta');
    assert.equal(liga.premio_final, null);
    assert.equal(liga.finalizada_em, null);
    assert.equal((await sql`select 1 from vouchers where liga_id = ${ligaId}`).length, 0);
    assert.equal((await sql`select 1 from mercados where resultado_final`).length, 0);
    assert.equal(await pontuacaoUsuario(sql, a, ligaId), 0);
    assert.equal(await fichasDisponiveis(sql, a, ligaId), 150);

    await finalizarLiga(sql, ligaId, [mercados[0]]);
    await sql`update vouchers set resgatado = true`;
    await assert.rejects(reativarLiga(sql, ligaId), { message: 'O voucher desse palpite já foi resgatado.' });
  });

  test('premio_final limitado à meta (teto)', async () => {
    await sql`delete from premio_escada`;
    await sql`insert into premio_escada (ordem, usuarios_min, valor) values (1, 1, 100), (2, 2, 250)`;
    const users = await Promise.all([1, 2, 3, 4].map(() => criarUser(sql)));
    const { ligaId, mercados } = await criarLiga(sql);
    for (const u of users) await entrarNaLiga(sql, u, ligaId);
    await apostar(sql, users[0], ligaId, { [mercados[0]]: 10 });
    const r = await finalizarLiga(sql, ligaId, [mercados[0]]);
    assert.equal(r.premio_final, 250);
    assert.equal(r.voucher!.valor, 250);
  });

  test('ninguém pontuou: sem voucher; mercado de outra liga é rejeitado', async () => {
    const u = await criarUser(sql);
    const { ligaId, mercados } = await criarLiga(sql);
    const outra = await criarLiga(sql, '2030-01-05');
    await entrarNaLiga(sql, u, ligaId);
    await apostar(sql, u, ligaId, { [mercados[1]]: 10 });
    await assert.rejects(finalizarLiga(sql, ligaId, [outra.mercados[0]]), RuleError);
    const r = await finalizarLiga(sql, ligaId, [mercados[0]]);
    assert.equal(r.voucher, null);
    assert.equal(r.premio_final, 0);
  });
});

test('liga atual: próxima múltipla não finalizada a partir de hoje; senão a de hoje', async () => {
  assert.equal(await getLigaAtual(sql, '2030-01-01'), null);
  await criarLiga(sql, '2029-12-30', 'aberta');
  await criarLiga(sql, '2030-01-01', 'finalizada');
  assert.equal((await getLigaAtual(sql, '2030-01-01'))?.data, '2030-01-01');
  await criarLiga(sql, '2030-01-03', 'aberta');
  await criarLiga(sql, '2030-01-02', 'em_andamento');
  assert.equal((await getLigaAtual(sql, '2030-01-01'))?.data, '2030-01-02');
  assert.equal((await getLigaAtual(sql, '2030-01-04')), null);
});

test('remover palpiteiro apaga as fichas e a entrada e devolve os PONTOS', async () => {
  const a = await criarUser(sql);
  const b = await criarUser(sql);
  const { ligaId, mercados } = await criarLiga(sql);
  await entrarNaLiga(sql, a, ligaId);
  await entrarNaLiga(sql, b, ligaId);
  await apostar(sql, a, ligaId, { [mercados[0]]: 50 });
  await apostar(sql, b, ligaId, { [mercados[0]]: 30 });
  const r = await removerPalpiteiro(sql, ligaId, a);
  assert.equal(r.palpiteiros, 1);
  assert.equal(r.participantes[0].fichas_apostadas, 30);
  assert.equal(await saldo(sql, a), 500);
  assert.equal((await sql`select 1 from apostas where user_id = ${a}`).length, 0);
  await assert.rejects(removerPalpiteiro(sql, ligaId, a), { message: 'Palpiteiro não encontrado.' });
  await entrarNaLiga(sql, a, ligaId);
  await finalizarLiga(sql, ligaId, [mercados[0]]);
  await assert.rejects(removerPalpiteiro(sql, ligaId, b), { message: 'Reative o palpite antes de remover palpiteiros.' });
});

test('palpiteiros do dia lista quem entrou e as fichas de cada um', async () => {
  const a = await criarUser(sql, { nome: 'Ana' });
  const b = await criarUser(sql, { nome: 'Bia' });
  const { ligaId, mercados } = await criarLiga(sql);
  await entrarNaLiga(sql, a, ligaId);
  await entrarNaLiga(sql, b, ligaId);
  await apostar(sql, a, ligaId, { [mercados[0]]: 50, [mercados[1]]: 20 });
  const [{ data }] = await sql`select to_char(data, 'YYYY-MM-DD') as data from ligas where id = ${ligaId}`;
  const r = await palpiteirosDoDia(sql, null, data);
  assert.deepEqual(r.palpiteiros.map((p) => [p.nome, p.fichas_apostadas, p.palpites.length]), [['Ana', 70, 2], ['Bia', 0, 0]]);
});
