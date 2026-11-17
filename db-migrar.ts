/**
 * Aplica as migrações de banco/migracoes em um banco EcommFlow JÁ EXISTENTE (produção).
 * Cada migração é idempotente e registrada em schema_migracoes; nada é recriado ou apagado.
 *   npm run db:migrar
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { Client } from 'pg';

process.loadEnvFile?.('.env');

async function main() {
  const c = new Client({ connectionString: process.env.DATABASE_URL });
  await c.connect();
  c.on('notice', (n) => n.message && /Migra/.test(n.message) && console.log('  ', n.message));
  const existe = await c.query("SELECT to_regclass('public.tarefas') IS NOT NULL AS e");
  if (!existe.rows[0].e) { console.log('Banco sem a estrutura do EcommFlow. Use npm run db:setup em banco vazio.'); return c.end(); }
  for (const f of readdirSync('banco/migracoes').filter((x) => x.endsWith('.sql')).sort()) {
    process.stdout.write(`→ ${f} ... `);
    await c.query(readFileSync(join('banco/migracoes', f), 'utf8'));
    console.log('ok');
  }
  await c.end();
}
main().catch((e) => { console.error('\nERRO:', e.message); process.exit(1); });
