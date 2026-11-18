// Ganti semua path lama ke path baru di docs/STATUS.md
import { readFileSync, writeFileSync } from 'node:fs';

const file = 'docs/STATUS.md';
let content = readFileSync(file, 'utf8');

const replacements = [
  // DB scripts
  ['scripts/migrate.mjs', 'scripts/db/migrate.mjs'],
  ['scripts/seed.mjs', 'scripts/db/seed.mjs'],
  ['scripts/verifikasi-db.sql', 'scripts/db/verifikasi-db.sql'],
  ['scripts/bersihkan-outbox.mjs', 'scripts/db/bersihkan-outbox.mjs'],
  // Uji scripts
  ['scripts/uji-suite.ps1', 'scripts/uji/uji-suite.ps1'],
  ['scripts/uji-deploy.ps1', 'scripts/uji/uji-deploy.ps1'],
  ['scripts/uji-push.mjs', 'scripts/uji/uji-push.mjs'],
  ['scripts/uji-push.ps1', 'scripts/uji/uji-push.ps1'],
  ['scripts/uji-worker.mjs', 'scripts/uji/uji-worker.mjs'],
  ['scripts/uji-balapan-klaim.mjs', 'scripts/uji/uji-balapan-klaim.mjs'],
  ['scripts/uji-rls.mjs', 'scripts/uji/uji-rls.mjs'],
  ['scripts/uji-bukti-api.mjs', 'scripts/uji/uji-bukti-api.mjs'],
  ['scripts/uji-bukti-login-cepat.mjs', 'scripts/uji/uji-bukti-login-cepat.mjs'],
  ['scripts/uji-1d.mjs', 'scripts/uji/uji-1d.mjs'],
  ['scripts/uji-1d.ps1', 'scripts/uji/uji-1d.ps1'],
  ['scripts/uji-1e.mjs', 'scripts/uji/uji-1e.mjs'],
  ['scripts/uji-1e.ps1', 'scripts/uji/uji-1e.ps1'],
  ['scripts/uji-api.ps1', 'scripts/uji/uji-api.ps1'],
  ['scripts/uji-celah-role.ps1', 'scripts/uji/uji-celah-role.ps1'],
  ['scripts/uji-pembatalan.ps1', 'scripts/uji/uji-pembatalan.ps1'],
  ['scripts/uji-verifikasi-1c.ps1', 'scripts/uji/uji-verifikasi-1c.ps1'],
  ['scripts/audit-links.mjs', 'scripts/uji/audit-links.mjs'],
  ['scripts/audit-rls-policies.mjs', 'scripts/uji/audit-rls-policies.mjs'],
  ['scripts/audit-rute.mjs', 'scripts/uji/audit-rute.mjs'],
  ['scripts/find-names.mjs', 'scripts/uji/find-names.mjs'],
];

for (const [from, to] of replacements) {
  const regex = new RegExp(from.replace(/\./g, '\\.'), 'g');
  content = content.replace(regex, to);
}

writeFileSync(file, content, 'utf8');
console.log('Done. Verifying no old paths remain:');
for (const [from] of replacements) {
  if (content.includes(from)) {
    console.log('MASIH ADA:', from);
  }
}
console.log('Selesai.');
