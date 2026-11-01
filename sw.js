const VERSION = 'v2';
const CACHE = 'faco-tools-' + VERSION;

const FILES = [
  '/brief/instruments.html',
  '/brief/lines.html',
  '/brief/e6b.html',
  '/brief/phaser.min.js',
  '/brief/inst/navdata.js',
  '/brief/inst/aircraft.js',
  '/brief/inst/sim.js',
  '/brief/inst/navdb.js',
  '/brief/inst/map.js',
  '/brief/inst/vecfont.js',
  '/brief/inst/glass.js',
  '/brief/inst/t6a.js',
  '/brief/inst/hud.js',
  '/brief/inst/panel.js',
  '/brief/inst/controls.js',
  '/brief/inst/ui.js',
  '/brief/src/sim.js',
  '/brief/src/scene.js',
  '/brief/src/ui.js',
  '/brief/src/view3d.js',
  '/brief/src/advanced.js',
  '/brief/src/bscope.js',
  '/brief/src/save.js',
  '/brief/e6b/calc.js',
  '/brief/e6b/ui.js',
  '/js/theme.js',
  '/img/favicon.png',
  '/img/icon-192.png',
  '/img/icon-512.png',
  '/manifest.webmanifest',
];

const KNOWN = new Set(FILES);

const OFFLINE_PAGE = '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Offline | FACO</title>' +
  '<body style="font:16px/1.5 system-ui,sans-serif;max-width:32rem;margin:15vh auto;padding:0 1.25rem;background:#0a0e13;color:#c9d4df">' +
  '<h1 style="font-size:1.4rem">You are offline</h1><p>That page needs a connection. These tools work without one:</p>' +
  '<ul><li><a style="color:#4da3ff" href="/brief/instruments.html">Flight Instruments</a></li>' +
  '<li><a style="color:#4da3ff" href="/brief/lines.html">Briefing Lines</a></li>' +
  '<li><a style="color:#4da3ff" href="/brief/e6b.html">Flight Calculator</a></li></ul>';

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll(FILES.map(f => new Request(f, { cache: 'reload' }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k.startsWith('faco-tools-') && k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  const known = KNOWN.has(url.pathname);
  if (!known && req.mode !== 'navigate') return;
  event.respondWith(
    caches.open(CACHE).then(cache => cache.match(url.pathname).then(hit => {
      const fresh = known
        ? fetch(req).then(res => { if (res.ok) cache.put(url.pathname, res.clone()); return res; })
        : fetch(req);
      if (hit) { fresh.catch(() => { }); return hit; }
      return fresh.catch(() => req.mode === 'navigate'
        ? new Response(OFFLINE_PAGE, { headers: { 'Content-Type': 'text/html; charset=utf-8' } })
        : Response.error());
    }))
  );
});
