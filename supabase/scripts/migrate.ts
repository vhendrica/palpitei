import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import postgres from 'postgres';

/** Aplica as migrations em ordem num Postgres qualquer (dev/test). Em produção use `supabase db push`. */
export async function migrate(url: string, { reset = false } = {}) {
  const sql = postgres(url, { onnotice: () => {} });
  try {
    if (reset) await sql.unsafe('drop schema if exists public cascade; create schema public;');
    const dir = join(import.meta.dirname, '..', 'migrations');
    for (const f of readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()) {
      await sql.unsafe(readFileSync(join(dir, f), 'utf8'));
    }
  } finally {
    await sql.end();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('Defina DATABASE_URL');
  await migrate(url, { reset: process.argv.includes('--reset') });
  console.log('migrations aplicadas');
}
