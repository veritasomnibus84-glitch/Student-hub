// Génère sw.js (service worker) : liste des fichiers à mettre en cache + version = empreinte de leur contenu.
// Lance : npm run build:sw   (à refaire après toute modification de fichiers de l'app ; `npm test` vérifie qu'il est à jour)
import { readFileSync, readdirSync, writeFileSync, statSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const FOLDERS = ['css', 'js', 'assets', 'icons'];
const EXTRA = ['index.html', 'manifest.webmanifest', 'vendor/pdfjs/pdf.min.mjs', 'vendor/pdfjs/pdf.worker.min.mjs'];

const walk = (dir) => (existsSync(dir) ? readdirSync(dir).flatMap((n) => { const p = join(dir, n); return statSync(p).isDirectory() ? walk(p) : [p]; }) : []);

export function precacheList(root = ROOT) {
  const files = [...EXTRA.map((f) => join(root, f)), ...FOLDERS.flatMap((f) => walk(join(root, f)))].filter((f) => existsSync(f));
  return [...new Set(files.map((f) => relative(root, f).split(sep).join('/')))].sort();
}

export function versionOf(list, root = ROOT) {
  const h = createHash('sha256');
  for (const f of list) { h.update(f); h.update(readFileSync(join(root, f))); }
  return h.digest('hex').slice(0, 12);
}

export function renderSw(root = ROOT) {
  const list = precacheList(root);
  return `// Fichier généré par scripts/build-sw.mjs : ne pas modifier à la main (npm run build:sw).
const VERSION = '${versionOf(list, root)}';
const CACHE = \`studenthub-\${VERSION}\`;
const RUNTIME = 'studenthub-runtime';
const PRECACHE = ${JSON.stringify(list, null, 2)};

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k.startsWith('studenthub-') && k !== CACHE && k !== RUNTIME).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

// Données de Hermes et des Actions GitHub : réseau d'abord (fraîches), cache si hors ligne.
const networkFirst = (req) => fetch(req).then((res) => { if (res.ok) { const copy = res.clone(); caches.open(RUNTIME).then((c) => c.put(req, copy)); } return res; })
  .catch(() => caches.match(req).then((hit) => hit || Promise.reject(new Error('hors ligne'))));

// Le reste : cache d'abord (l'app marche sans réseau), puis réseau, mis de côté pour la prochaine fois.
const cacheFirst = (req) => caches.match(req).then((hit) => hit || fetch(req).then((res) => { if (res.ok) { const copy = res.clone(); caches.open(RUNTIME).then((c) => c.put(req, copy)); } return res; }));

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // vignettes YouTube, Supabase… : jamais interceptés
  if (/\\/data\\/[^/]+\\.json$/.test(url.pathname)) { e.respondWith(networkFirst(req)); return; }
  if (req.mode === 'navigate') { e.respondWith(caches.match('index.html').then((hit) => hit || fetch(req))); return; }
  e.respondWith(cacheFirst(req));
});
`;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  writeFileSync(join(ROOT, 'sw.js'), renderSw());
  console.log(`sw.js généré (${precacheList().length} fichiers)`);
}
