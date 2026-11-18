import { readFileSync, existsSync } from 'node:fs';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';

const files = ['README.md'];
for (const f of readdirSync('docs')) {
  if (f.endsWith('.md')) files.push(join('docs', f));
}

for (const f of files) {
  if (!existsSync(f)) continue;
  const lines = readFileSync(f, 'utf8').split('\n');
  lines.forEach((l, idx) => {
    if (/\b(Reyhan|Nadira|Raka|Annisa|Alea)\b/i.test(l)) {
      console.log(`${f}:${idx + 1}: ${l.trim()}`);
    }
  });
}
