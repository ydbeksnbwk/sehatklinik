// Menjalankan file migrasi SQL berurutan dan mencatat yang sudah dijalankan (tabel public._migrations).
//   node --env-file=.env.local scripts/migrate.mjs                 -> jalankan migrasi yang belum
//   node --env-file=.env.local scripts/migrate.mjs --seed          -> sekaligus seed (09,10,11)
//   node --env-file=.env.local scripts/migrate.mjs --baseline 08   -> tandai 01-08 sudah dijalankan TANPA menjalankan
//                                                                     (untuk database yang sudah diisi manual lewat SQL Editor)
//   node ... --local                                               -> database lokal: jalankan juga tiruan skema Supabase
import { readdirSync, readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import pg from 'pg'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const args = process.argv.slice(2)
const has = (f) => args.includes(f)
const val = (f) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : null }

const url = process.env.DATABASE_URL
if (!url) { console.error('DATABASE_URL belum diisi'); process.exit(1) }
const local = has('--local')
const client = new pg.Client({ connectionString: url, ssl: local ? false : { rejectUnauthorized: false } })
await client.connect()

await client.query(`create table if not exists public._migrations (name text primary key, applied_at timestamptz not null default now())`)
await client.query('alter table public._migrations enable row level security')
await client.query(`do $$ begin if exists (select 1 from pg_roles where rolname = 'anon') then revoke all on public._migrations from anon, authenticated; end if; end $$`)
const done = new Set((await client.query('select name from public._migrations')).rows.map((r) => r.name))

const files = []
if (local) files.push(['local', 'db/local/00_supabase_stub.sql'])
for (const f of readdirSync(join(root, 'db/migrations')).filter((x) => x.endsWith('.sql')).sort()) files.push(['migrations', `db/migrations/${f}`])
if (has('--seed')) for (const f of readdirSync(join(root, 'db/seed')).filter((x) => x.endsWith('.sql')).sort()) files.push(['seed', `db/seed/${f}`])

const baseline = val('--baseline')
for (const [, path] of files) {
  const name = path.split('/').pop()
  if (done.has(name)) { console.log('lewati   ', name); continue }
  if (baseline && name.slice(0, 2) <= baseline) {
    await client.query('insert into public._migrations(name) values ($1)', [name]); console.log('baseline ', name); continue
  }
  process.stdout.write(`jalankan  ${name} ... `)
  try {
    await client.query(readFileSync(join(root, path), 'utf8'))
    await client.query('insert into public._migrations(name) values ($1)', [name])
    console.log('ok')
  } catch (e) {
    console.log('GAGAL'); console.error(e.message); process.exit(1)
  }
}
await client.end()
