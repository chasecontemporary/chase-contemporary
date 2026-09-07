// Run a migration file straight against Postgres.
//
// The Supabase management token was revoked and PostgREST cannot do DDL, so migrations go
// through a direct connection using the database password from SECRETS.local.md.
//
//   node scripts/migrate.mjs db/migrations/0038-reserves.sql
//
// Uses the shared pooler (the per-project host disappears whenever the project is paused).
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
// `pg` lives in crm/node_modules; resolve from there rather than next to this file.
const require = createRequire(new URL('../crm/package.json', import.meta.url));
const pg = require('pg');

const file = process.argv[2];
if (!file) { console.error('usage: node scripts/migrate.mjs <file.sql>'); process.exit(1); }

const PASSWORD = process.env.SUPABASE_DB_PASSWORD;
const REF = 'iplqycxyqmutswhlbbgj';
if (!PASSWORD) { console.error('set SUPABASE_DB_PASSWORD (see SECRETS.local.md)'); process.exit(1); }

const client = new pg.Client({
  host: 'aws-0-us-east-1.pooler.supabase.com',
  port: 5432,
  user: `postgres.${REF}`,
  password: PASSWORD,
  database: 'postgres',
  ssl: { rejectUnauthorized: false },
});

const sql = readFileSync(file, 'utf8');
await client.connect();
try {
  await client.query(sql);
  console.log(`  applied ${file}`);
} catch (e) {
  console.error(`  FAILED ${file}\n  ${e.message}`);
  process.exitCode = 1;
} finally {
  await client.end();
}
