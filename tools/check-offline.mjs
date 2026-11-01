import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('..', import.meta.url));
const pages = ['brief/instruments.html', 'brief/lines.html', 'brief/e6b.html'];

const sw = readFileSync(path.join(root, 'sw.js'), 'utf8');
const files = new Set([...sw.slice(sw.indexOf('const FILES'), sw.indexOf('];')).matchAll(/'(\/[^']+)'/g)].map(m => m[1]));

const problems = [];
const wanted = new Set(['/manifest.webmanifest']);
for (const page of pages) {
  wanted.add('/' + page);
  const html = readFileSync(path.join(root, page), 'utf8');
  for (const m of html.matchAll(/<(?:script|link|img)\b[^>]*?\b(?:src|href)="([^"#?]+)"[^>]*>/g)) {
    const ref = m[1];
    if (/^(?:[a-z]+:)?\/\//i.test(ref) || ref.startsWith('data:') || /rel="canonical"/.test(m[0]) || /rel="(?:alternate|dns-prefetch)"/.test(m[0])) continue;
    if (/<a\b/.test(m[0])) continue;
    wanted.add(path.posix.normalize(ref.startsWith('/') ? ref : path.posix.join(path.posix.dirname('/' + page), ref)));
  }
}
for (const f of wanted) if (!files.has(f)) problems.push(`not in sw.js FILES: ${f}`);
for (const f of files) if (!existsSync(path.join(root, f))) problems.push(`in sw.js FILES but missing on disk: ${f}`);

if (problems.length) { console.error(problems.join('\n')); process.exit(1); }
console.log(`ok: ${files.size} files cached, every file the three pages load is covered`);
