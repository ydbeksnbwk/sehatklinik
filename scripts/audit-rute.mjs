import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

function getFiles(dir) {
  const entries = readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...getFiles(full));
    } else if (entry.name === 'route.js') {
      files.push(full);
    }
  }
  return files;
}

const routes = getFiles('src/app/api');
const audit = [];

for (const r of routes) {
  const content = readFileSync(r, 'utf8');
  const usesDenganRls = content.includes('denganRls');
  const usesDb = /\bdb\b/.test(content);
  const rel = relative(process.cwd(), r).replace(/\\/g, '/');
  audit.push({
    route: rel,
    denganRls: usesDenganRls,
    dbLangsung: usesDb,
  });
}

console.table(audit);
