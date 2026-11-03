import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import vm from 'node:vm';
import { setupDOM, memory } from './helpers/dom.js';
const win = setupDOM();
const root = new URL('..', import.meta.url);
const read = (p) => readFileSync(new URL(p, root), 'utf8');
const { renderSw, precacheList } = await import('../scripts/build-sw.mjs');
const P = await import('../js/pwa.js');
const { createStore } = await import('../js/store.js');
const { TABS } = await import('../js/app.js');

test('sw.js est à jour : sinon lance « npm run build:sw »', () => {
  assert.equal(read('sw.js'), renderSw(new URL('.', root).pathname), 'sw.js ne correspond plus aux fichiers de l\'app : npm run build:sw');
  const list = precacheList(new URL('.', root).pathname);
  for (const f of ['index.html', 'manifest.webmanifest', 'css/base.css', 'js/main.js', 'js/app.js', 'js/modules/revision.js', 'icons/icon-192.png', 'vendor/pdfjs/pdf.min.mjs', 'vendor/pdfjs/pdf.worker.min.mjs']) assert.ok(list.includes(f), f);
  assert.ok(!list.some((f) => /^(tests|scripts|docs|node_modules|data)\//.test(f)) && !list.includes('sw.js'));
});

test('manifeste, icônes (dimensions réelles), index.html et CSP', () => {
  const m = JSON.parse(read('manifest.webmanifest'));
  assert.deepEqual([m.name, m.display, m.start_url, m.scope, m.lang], ['Student Hub', 'standalone', './index.html', './', 'fr']);
  assert.ok(/^#[0-9a-f]{6}$/i.test(m.theme_color) && /^#[0-9a-f]{6}$/i.test(m.background_color));
  const purposes = m.icons.map((i) => `${i.sizes}:${i.purpose}`); assert.ok(purposes.includes('192x192:any') && purposes.includes('512x512:any') && purposes.includes('512x512:maskable'));
  for (const i of m.icons) {
    assert.ok(existsSync(new URL(i.src, root)), i.src);
    const png = readFileSync(new URL(i.src, root)); const w = png.readUInt32BE(16); const h = png.readUInt32BE(20);
    assert.equal(png.subarray(1, 4).toString(), 'PNG'); assert.equal(`${w}x${h}`, i.sizes);
  }
  const html = read('index.html');
  assert.ok(html.includes('rel="manifest" href="manifest.webmanifest"') && html.includes('rel="apple-touch-icon"') && html.includes('name="theme-color"'));
  assert.match(html, /manifest-src 'self'/); assert.match(html, /worker-src 'self'/);
  assert.ok(!/unsafe-inline|unsafe-eval/.test(html), 'la CSP reste stricte');
});

// ---- Le service worker lui-même, dans un faux environnement ----
function loadSw() {
  const handlers = {}; const stores = new Map(); const calls = { fetch: [], skip: 0, claimed: 0 };
  const keyOf = (r) => (typeof r === 'string' ? new URL(r, 'https://x.test/app/').href : r.url);
  const cache = (name) => { if (!stores.has(name)) stores.set(name, new Map()); const st = stores.get(name); return { addAll: async (list) => { for (const f of list) st.set(keyOf(f), `precache:${f}`); }, put: async (r, res) => { st.set(keyOf(r), res); } }; };
  const caches = {
    open: async (n) => cache(n), keys: async () => [...stores.keys()], delete: async (n) => stores.delete(n),
    match: async (r) => { for (const st of stores.values()) if (st.has(keyOf(r))) return st.get(keyOf(r)); return undefined; },
  };
  const net = { online: true, pages: {} };
  const fetch = async (r) => { calls.fetch.push(keyOf(r)); if (!net.online) throw new Error('offline'); return { ok: true, body: net.pages[keyOf(r)] ?? `réseau:${keyOf(r)}`, clone() { return this; } }; };
  const self = { addEventListener: (t, f) => { handlers[t] = f; }, location: { origin: 'https://x.test' }, skipWaiting: () => { calls.skip += 1; }, clients: { claim: () => { calls.claimed += 1; } } };
  vm.runInNewContext(read('sw.js'), { self, caches, fetch, URL, Promise, JSON, Object, Array, Error });
  const ev = (init) => { const e = { ...init, done: null, respondWith(p) { e.done = Promise.resolve(p); }, waitUntil(p) { e.done = Promise.resolve(p); } }; return e; };
  return { handlers, stores, calls, net, ev, caches };
}

test('service worker : installation (liste complète), activation (anciennes versions supprimées)', async () => {
  const sw = loadSw();
  sw.stores.set('studenthub-ancienne', new Map()); sw.stores.set('autre-site', new Map()); sw.stores.set('studenthub-runtime', new Map());
  const inst = sw.ev({}); sw.handlers.install(inst); await inst.done;
  const names = [...sw.stores.keys()].filter((n) => /^studenthub-[0-9a-f]{12}$/.test(n)); assert.equal(names.length, 1);
  assert.equal(sw.stores.get(names[0]).size, precacheList(new URL('.', root).pathname).length); assert.equal(sw.calls.skip, 1);
  const act = sw.ev({}); sw.handlers.activate(act); await act.done;
  assert.deepEqual([...sw.stores.keys()].sort(), ['autre-site', names[0], 'studenthub-runtime'].sort()); assert.equal(sw.calls.claimed, 1);
});

test('service worker : cache d\'abord, données fraîches si possible, hors ligne, rien d\'extérieur', async () => {
  const sw = loadSw(); const i = sw.ev({}); sw.handlers.install(i); await i.done;
  const req = (url, extra = {}) => ({ method: 'GET', mode: 'cors', url: `https://x.test${url}`, ...extra });
  const run = async (r) => { const e = sw.ev({ request: r }); sw.handlers.fetch(e); return e.done ? e.done : undefined; };
  const key = [...sw.stores.keys()].find((n) => n !== 'studenthub-runtime');
  // fichier de l'app : servi depuis le cache, même hors ligne
  sw.stores.get(key).set('https://x.test/js/app.js', 'precache:js/app.js'); sw.net.online = false;
  assert.equal(await run(req('/js/app.js')), 'precache:js/app.js');
  // navigation hors ligne : index.html du cache
  sw.stores.get(key).set(new URL('index.html', 'https://x.test/app/').href, 'precache:index.html');
  assert.equal(await run(req('/app/', { mode: 'navigate' })), 'precache:index.html');
  // données : réseau d'abord, cache de secours
  sw.net.online = true; sw.net.pages['https://x.test/data/summaries.json'] = '[{"id":1}]';
  assert.equal((await run(req('/data/summaries.json'))).body, '[{"id":1}]');
  sw.net.online = false; assert.equal((await run(req('/data/summaries.json'))).body, '[{"id":1}]');
  await assert.rejects(() => run(req('/data/videos.json')), /hors ligne/);
  // fichier inconnu : réseau puis mémorisé pour la prochaine fois
  sw.net.online = true; assert.equal((await run(req('/vendor/pdfjs/cmaps/x.bcmap'))).body, 'réseau:https://x.test/vendor/pdfjs/cmaps/x.bcmap');
  sw.net.online = false; assert.equal((await run(req('/vendor/pdfjs/cmaps/x.bcmap'))).body, 'réseau:https://x.test/vendor/pdfjs/cmaps/x.bcmap');
  // jamais interceptés : autre origine, autre méthode
  sw.calls.fetch.length = 0;
  assert.equal(await run({ method: 'GET', mode: 'cors', url: 'https://i.ytimg.com/vi/x/hq.jpg' }), undefined);
  assert.equal(await run(req('/rest/v1/user_state', { method: 'POST' })), undefined);
});

test('enregistrement : seulement en http(s), avec avertissement à la mise à jour', async () => {
  assert.equal(await P.registerSW({ nav: {}, loc: { protocol: 'https:' } }), null); // navigateur sans service worker
  assert.equal(await P.registerSW({ nav: { serviceWorker: { register: async () => 'x', addEventListener() {} } }, loc: { protocol: 'file:' } }), null);
  const calls = { reg: [], msgs: [] }; const listeners = {};
  const nav = { serviceWorker: { controller: {}, register: async (u) => { calls.reg.push(u); return { scope: '/' }; }, addEventListener: (t, f) => { listeners[t] = f; } } };
  assert.deepEqual(await P.registerSW({ nav, loc: { protocol: 'https:' }, onUpdate: (m) => calls.msgs.push(m) }), { scope: '/' });
  assert.deepEqual(calls.reg, ['sw.js']); listeners.controllerchange(); assert.match(calls.msgs[0], /Nouvelle version/);
  const first = { serviceWorker: { controller: null, register: async () => ({}), addEventListener: (t, f) => { listeners.first = f; } } }; // première installation : pas d'avertissement
  await P.registerSW({ nav: first, loc: { protocol: 'https:' }, onUpdate: (m) => calls.msgs.push(m) }); listeners.first(); assert.equal(calls.msgs.length, 1);
  assert.equal(P.offlineReady({ serviceWorker: { controller: {} } }), true); assert.equal(P.offlineReady({ serviceWorker: { controller: null } }), false); assert.equal(P.offlineReady({}), false);
  assert.equal(P.isStandalone({ matchMedia: () => ({ matches: true }) }), true); assert.equal(P.isStandalone({ matchMedia: () => ({ matches: false }), navigator: { standalone: true } }), true); assert.equal(P.isStandalone({ matchMedia: () => ({ matches: false }), navigator: {} }), false);
});

test('installation : invite mémorisée, proposée au clic, oubliée après usage', async () => {
  const handlers = {}; P.initInstall({ addEventListener: (t, f) => { handlers[t] = f; } });
  assert.equal(P.canInstall(), false); assert.equal(await P.promptInstall(), 'indisponible');
  let prevented = false; let prompted = 0; let changed = 0; const off = P.onInstallChange(() => { changed += 1; });
  handlers.beforeinstallprompt({ preventDefault: () => { prevented = true; }, prompt: () => { prompted += 1; }, userChoice: Promise.resolve({ outcome: 'accepted' }) });
  assert.ok(prevented && P.canInstall()); assert.equal(await P.promptInstall(), 'accepted');
  assert.equal(prompted, 1); assert.equal(P.canInstall(), false); assert.ok(changed >= 2); off();
});

test('Paramètres : section Application (état, hors ligne, installation)', () => {
  const store = createStore(memory()); const mod = TABS.find(([k]) => k === 'settings')[2];
  const host = document.createElement('div'); const ctx = { store, data: {}, rerender: () => {} }; host.append(mod.render(ctx));
  const section = host.querySelector('[data-pref="Application"]');
  assert.ok(section.textContent.includes('n\'est pas installée') && section.textContent.includes('hors ligne') && section.textContent.includes('Ajouter à l\'écran d\'accueil'));
});
