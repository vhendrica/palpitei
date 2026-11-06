import type { Sql, TransactionSql } from 'postgres';

/** Conexão (ou transação) postgres.js. Mesmo client em Node (testes/dev) e Deno (Edge Function). */
export type Db = Sql;
export type Tx = TransactionSql;

export const num = (v: unknown) => (v == null ? 0 : Number(v));
export const iso = (v: Date | string | null | undefined) =>
  v == null ? null : v instanceof Date ? v.toISOString() : new Date(v).toISOString();
