import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('..', import.meta.url));
const origin = 'https://facosim.com';
const skip = new Set(['.git', '.github', 'node_modules', 'css', 'js', 'img', 'fonts', 'tools']);
const problems = [];
const bad = (where, msg) => problems.push(`${where}: ${msg}`);

const walk = dir => readdirSync(path.join(root, dir), { withFileTypes: true }).flatMap(e => {
  const rel = path.posix.join(dir, e.name);
  if (e.isDirectory()) return skip.has(e.name) ? [] : walk(rel);
  return e.name.endsWith('.html') ? [rel] : [];
});
const pages = walk('.').map(p => p.replace(/^\.\//, ''));

const fileFor = url => {
  const p = new URL(url).pathname;
  if (p === '/') return 'index.html';
  const rel = decodeURIComponent(p.slice(1));
  return path.posix.extname(rel) ? rel : rel + '.html';
};
const onDisk = rel => existsSync(path.join(root, rel));

const sitemap = readFileSync(path.join(root, 'sitemap.xml'), 'utf8');
const locs = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]);
for (const loc of locs) if (!loc.startsWith(origin + '/') || !onDisk(fileFor(loc))) bad('sitemap.xml', `no file for ${loc}`);
if (new Set(locs).size !== locs.length) bad('sitemap.xml', 'duplicate entries');

const titles = new Map();
const descriptions = new Map();
const listed = new Set();

for (const page of pages) {
  const html = readFileSync(path.join(root, page), 'utf8');
  const head = (html.match(/<head>([\s\S]*?)<\/head>/) || [, ''])[1];
  const meta = (attr, name) => (head.match(new RegExp(`<meta\\s+${attr}="${name}"\\s+content="([^"]*)"`)) || [])[1];
  const robots = meta('name', 'robots') || '';
  const noindex = /noindex/.test(robots);
  const canonical = (head.match(/<link\s+rel="canonical"\s+href="([^"]*)"/) || [])[1];

  if (noindex) {
    if (canonical && locs.includes(canonical)) bad(page, 'is noindex but listed in sitemap.xml');
    continue;
  }

  if (!/<html[^>]*\slang="[^"]+"/.test(html)) bad(page, 'missing lang on <html>');
  const title = (head.match(/<title>([^<]*)<\/title>/) || [])[1];
  if (!title || title.length < 10 || title.length > 65) bad(page, `title should be 10-65 characters (${title ? title.length : 'missing'})`);
  else if (titles.has(title)) bad(page, `title repeats ${titles.get(title)}`);
  else titles.set(title, page);

  const desc = meta('name', 'description');
  if (!desc || desc.length < 50 || desc.length > 175) bad(page, `description should be 50-175 characters (${desc ? desc.length : 'missing'})`);
  else if (descriptions.has(desc)) bad(page, `description repeats ${descriptions.get(desc)}`);
  else descriptions.set(desc, page);

  if (!canonical || !canonical.startsWith(origin + '/')) bad(page, `canonical must be an absolute ${origin} URL`);
  else {
    if (!locs.includes(canonical)) bad(page, `canonical ${canonical} is not in sitemap.xml`);
    if (fileFor(canonical) !== page) bad(page, `canonical points at ${fileFor(canonical)}`);
    listed.add(canonical);
  }
  if (meta('property', 'og:url') !== canonical) bad(page, 'og:url differs from canonical');
  if (meta('property', 'og:title') !== title) bad(page, 'og:title differs from title');
  if (meta('property', 'og:description') !== desc) bad(page, 'og:description differs from description');
  if (meta('name', 'twitter:title') !== title || meta('name', 'twitter:description') !== desc) bad(page, 'twitter title or description differs');
  if (!meta('property', 'og:type')) bad(page, 'missing og:type');
  if (!meta('name', 'twitter:card')) bad(page, 'missing twitter:card');
  for (const prop of ['og:image', 'twitter:image']) {
    const img = (prop.startsWith('og') ? meta('property', prop) : meta('name', prop)) || '';
    if (!img.startsWith(origin + '/') || !onDisk(img.slice(origin.length + 1))) bad(page, `${prop} is missing or not a file on this site`);
  }
  if (!meta('property', 'og:image:alt')) bad(page, 'missing og:image:alt');

  const body = html.replace(/<(script|style|noscript)\b[\s\S]*?<\/\1>/g, '');
  const h1 = (body.match(/<h1\b/g) || []).length;
  if (h1 !== 1) bad(page, `needs exactly one <h1> (found ${h1})`);
  for (const img of body.match(/<img\b[^>]*>/g) || []) if (!/\balt=/.test(img)) bad(page, `image without alt: ${img.slice(0, 80)}`);

  const lds = [...head.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map(m => m[1]);
  if (!lds.length) bad(page, 'no JSON-LD');
  for (const raw of lds) {
    let data;
    try { data = JSON.parse(raw); } catch (e) { bad(page, `JSON-LD does not parse: ${e.message}`); continue; }
    const graph = data['@graph'] || [data];
    if (!/schema\.org/.test(data['@context'] || '')) bad(page, 'JSON-LD has no schema.org @context');
    const ids = new Set(graph.map(n => n['@id']).filter(Boolean));
    const refs = [];
    (function visit(o) {
      if (Array.isArray(o)) o.forEach(visit);
      else if (o && typeof o === 'object') {
        if (Object.keys(o).length === 1 && o['@id']) refs.push(o['@id']);
        Object.values(o).forEach(visit);
      }
    })(graph);
    for (const r of refs) if (!ids.has(r)) bad(page, `JSON-LD refers to ${r} but does not define it`);
    const types = graph.map(n => n['@type']);
    if (page !== 'index.html' && !types.includes('BreadcrumbList')) bad(page, 'JSON-LD has no BreadcrumbList');
    if (page === 'index.html' && !(types.includes('Organization') && types.includes('WebSite'))) bad(page, 'home page JSON-LD needs Organization and WebSite');
  }
}
for (const loc of locs) if (!listed.has(loc)) bad('sitemap.xml', `${loc} has no indexable page with that canonical`);

const robotsTxt = readFileSync(path.join(root, 'robots.txt'), 'utf8');
if (!robotsTxt.includes(`Sitemap: ${origin}/sitemap.xml`)) bad('robots.txt', 'missing Sitemap line');
if (/^\s*Disallow:\s*\/\s*$/m.test(robotsTxt)) bad('robots.txt', 'blocks the whole site');

for (const file of ['llms.txt', 'llms-full.txt']) {
  if (!onDisk(file)) { bad(file, 'missing'); continue; }
  const text = readFileSync(path.join(root, file), 'utf8');
  if (!/^# \S/.test(text)) bad(file, 'must start with a # title');
  if (!/^> \S/m.test(text)) bad(file, 'needs a > summary line');
  for (const m of text.matchAll(/https:\/\/facosim\.com\/[^\s)#]*/g)) {
    const url = m[0].replace(/[.,]+$/, '');
    if (!onDisk(fileFor(url))) bad(file, `link has no file: ${url}`);
  }
}

if (problems.length) { console.error(problems.join('\n')); process.exit(1); }
console.log(`ok: ${titles.size} indexable pages have a unique title and description, canonical, one h1, valid JSON-LD and a sitemap entry; robots.txt and llms files are consistent`);
