import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { after, before, beforeEach, describe, test } from 'node:test';

import { removerPalpiteiro } from '../functions/_core/admin.ts';
import { incompativeis, oddTotal, type OpcaoCompat } from '../functions/_core/compat.ts';
import { apostar, calcularRanking, entrarNaLiga, fichasDisponiveis, pontuacaoUsuario } from '../functions/_core/rules.ts';
import { palpiteirosDoDia } from '../functions/_core/services.ts';
import { criarLiga, criarUser, limpar, setupDb, type Sql } from './helpers.ts';

const op = (grupo: string, descricao: string, jogo_id = 'j1'): OpcaoCompat => ({
  jogo_id,
  time_casa: 'Coritiba',
  time_fora: 'Vitória',
  grupo,
  descricao,
});

describe('incompativeis', () => {
  test('bloqueia quando um garante o outro ou nenhum placar faz os dois baterem', () => {
    const casa = op('RESULTADO', 'CORITIBA');
    assert.equal(incompativeis(casa, op('GOLS 0.5', 'MAIS DE 0.5')), true);
    assert.equal(incompativeis(casa, op('DUPLA CHANCE', 'CORITIBA OU EMPATE')), true);
    assert.equal(incompativeis(op('GOLS 2.5', 'MAIS DE 2.5'), op('GOLS 1.5', 'MENOS DE 1.5')), true);
    assert.equal(incompativeis(op('GOLS 0.5', 'MAIS DE 0.5'), op('GOLS 0.5', 'MENOS DE 0.5')), true);
    assert.equal(incompativeis(op('AMBOS MARCAM', 'SIM'), op('GOLS 1.5', 'MAIS DE 1.5')), true);
    assert.equal(incompativeis(casa, op('RESULTADO', 'EMPATE')), true);
    assert.equal(incompativeis(casa, op('EMPATE ANULA', 'CORITIBA')), true);
  });

  test('libera combinações que podem ou não acontecer juntas, e jogos diferentes', () => {
    const casa = op('RESULTADO', 'CORITIBA');
    assert.equal(incompativeis(casa, op('GOLS 2.5', 'MAIS DE 2.5')), false);
    assert.equal(incompativeis(casa, op('AMBOS MARCAM', 'SIM')), false);
    assert.equal(incompativeis(op('RESULTADO', 'EMPATE'), op('GOLS 2.5', 'MENOS DE 2.5')), false);
    assert.equal(incompativeis(casa, op('RESULTADO', 'EMPATE', 'j2')), false);
    assert.equal(incompativeis(op('ESPECIAL', 'XYZ'), op('OUTRO', 'ABC')), false);
  });

  test('odd total é o produto exato', () => {
    assert.equal(oddTotal([2.1, 1.85]), 3.885);
    assert.equal(oddTotal([1.85, 1.95]), 3.6075);
    assert.equal(oddTotal([1.95, 2.1, 1.85]), 7.57575);
  });

  test('cópia do app é idêntica', () => {
    const raiz = join(import.meta.dirname, '..', '..');
    assert.equal(
      readFileSync(join(raiz, 'mobile/src/lib/compat.ts'), 'utf8'),
      readFileSync(join(raiz, 'supabase/functions/_core/compat.ts'), 'utf8'),
    );
  });
});

let sql: Sql;
before(async () => (sql = await setupDb()));
after(async () => sql.end());
beforeEach(async () => limpar(sql));

describe('bilhete com Simples e Múltiplas', () => {
  test('desconta fichas das simples e das múltiplas; mesmo palpite em vários grupos', async () => {
    const u = await criarUser(sql);
    const { ligaId, mercados } = await criarLiga(sql);
    await entrarNaLiga(sql, u, ligaId);
    const r = await apostar(sql, u, ligaId, {
      simples: { [mercados[0]]: 30 },
      multiplas: [
        { mercados: [mercados[0], mercados[2]], fichas: 90 },
        { mercados: [mercados[2], mercados[4]], fichas: 40 },
      ],
    });
    assert.deepEqual(r, { fichas_distribuidas: 160, fichas_livres: 40 });
    assert.equal(await fichasDisponiveis(sql, u, ligaId), 40);
    const p = await palpiteirosDoDia(sql, null, '2030-01-01');
    assert.equal(p.palpiteiros[0].fichas_apostadas, 160);
    assert.equal(p.palpiteiros[0].multiplas.length, 2);
    assert.equal(p.palpiteiros[0].multiplas[0].odd, 4);
  });

  test('validações da múltipla', async () => {
    const u = await criarUser(sql);
    const { ligaId, mercados } = await criarLiga(sql);
    await entrarNaLiga(sql, u, ligaId);
    const m = (ids: string[], fichas = 10) => apostar(sql, u, ligaId, { multiplas: [{ mercados: ids, fichas }] });
    await assert.rejects(m([mercados[0]]), { message: 'Múltipla precisa de pelo menos 2 palpites.' });
    await assert.rejects(m([mercados[0], mercados[0]]), { message: 'Palpite repetido na mesma múltipla.' });
    await assert.rejects(m([mercados[0], mercados[1]]), { message: 'Evento incompatível na múltipla.' });
    await assert.rejects(m([mercados[0], mercados[2]], 0), { message: 'Coloque fichas em cada múltipla.' });
    await assert.rejects(
      apostar(sql, u, ligaId, {
        multiplas: [
          { mercados: [mercados[0], mercados[2]], fichas: 10 },
          { mercados: [mercados[2], mercados[0]], fichas: 10 },
        ],
      }),
      { message: 'Você montou duas múltiplas iguais.' },
    );
    await m([mercados[0], mercados[2]]);
    await assert.rejects(m([mercados[2], mercados[0]]), { message: 'Você já tem uma múltipla igual a essa.' });
    await assert.rejects(m([mercados[0], mercados[4]], 500), { message: 'Você tem 190 fichas livres e tentou distribuir 500.' });
  });

  test('múltipla só pontua com todas as pernas certas; odd travada na confirmação', async () => {
    const a = await criarUser(sql, { nome: 'Ana Lima' });
    const b = await criarUser(sql, { nome: 'Bia Souza' });
    const { ligaId, mercados } = await criarLiga(sql);
    await entrarNaLiga(sql, a, ligaId);
    await entrarNaLiga(sql, b, ligaId);
    await apostar(sql, a, ligaId, { multiplas: [{ mercados: [mercados[0], mercados[2]], fichas: 50 }] });
    await apostar(sql, b, ligaId, { multiplas: [{ mercados: [mercados[0], mercados[3]], fichas: 50 }] });
    await sql`update mercados set multiplicador = 9 where id = ${mercados[0]}`;
    await sql`update mercados set resultado_final = true where id in ${sql([mercados[0], mercados[2]])}`;
    assert.equal(await pontuacaoUsuario(sql, a, ligaId), 200);
    assert.equal(await pontuacaoUsuario(sql, b, ligaId), 0);
    const r = await calcularRanking(sql, ligaId);
    assert.deepEqual(r.map((x) => [x.nome, x.pontuacao, x.fichas_apostadas]), [
      ['Ana L.', 200, 50],
      ['Bia S.', 0, 50],
    ]);
  });

  test('remover palpiteiro apaga as múltiplas dele', async () => {
    const u = await criarUser(sql);
    const { ligaId, mercados } = await criarLiga(sql);
    await entrarNaLiga(sql, u, ligaId);
    await apostar(sql, u, ligaId, { multiplas: [{ mercados: [mercados[0], mercados[2]], fichas: 50 }] });
    await removerPalpiteiro(sql, ligaId, u);
    assert.equal((await sql`select count(*)::int as n from multiplas`)[0].n, 0);
  });
});
