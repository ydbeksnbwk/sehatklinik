import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname, relative, resolve } from 'node:path';
import { execSync } from 'node:child_process';

const files = ['README.md'];
for (const f of readdirSync('docs')) {
  if (f.endsWith('.md')) {
    files.push(join('docs', f));
  }
}

const trackedFiles = files.filter(f => {
  try {
    const res = execSync(`git check-ignore "${f}"`, { stdio: 'pipe' }).toString().trim();
    return res.length === 0;
  } catch {
    return true; // tidak di-ignore
  }
});

console.log('Berkas Markdown yang di-track git:', trackedFiles);

const ignoredLinks = [];
const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;

for (const file of trackedFiles) {
  const content = readFileSync(file, 'utf8');
  let match;
  while ((match = linkRegex.exec(content)) !== null) {
    const text = match[1];
    let target = match[2];

    if (target.startsWith('#') || target.startsWith('http://') || target.startsWith('https://') || target.startsWith('mailto:')) {
      continue;
    }

    const [pathPart] = target.split('#');
    if (!pathPart) continue;

    let cleanPath = pathPart;
    if (cleanPath.startsWith('file:///')) {
      cleanPath = decodeURIComponent(cleanPath.replace(/^file:\/\/\/?/, ''));
    }

    let fullTarget;
    if (cleanPath.startsWith('/') || /^[A-Za-z]:[\\/]/.test(cleanPath)) {
      fullTarget = cleanPath;
    } else {
      fullTarget = resolve(dirname(file), cleanPath);
    }

    const relTarget = relative(process.cwd(), fullTarget).replace(/\\/g, '/');

    try {
      const ign = execSync(`git check-ignore "${relTarget}"`, { stdio: 'pipe' }).toString().trim();
      if (ign) {
        ignoredLinks.push({
          source: file,
          linkText: text,
          target: target,
          ignoredFile: ign,
        });
      }
    } catch {
      // not ignored
    }
  }
}

console.log(`Ditemukan ${ignoredLinks.length} tautan dari berkas ter-track ke berkas ter-ignore:`);
console.table(ignoredLinks);
