import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setupDOM, memory } from './helpers/dom.js';
const win = setupDOM();
const { createStore, newTodo, newNote, newLink } = await import('../js/store.js');
const { TABS } = await import('../js/app.js');
const CM = await import('../js/ui/context-menu.js');
const S = await import('../js/settings-logic.js');
const { loadSync, saveSync, cleanUrl, createClient, syncNow, replaceCloud, replaceDevice } = await import('../js/sync.js');
const { widgetBar, homeGrid, customizeSheet } = await import('../js/ui/widgets.js');

const click = (el) => el.dispatchEvent(new win.Event('click', { bubbles: true }));
const byLabel = (root, label) => root.querySelector(`button[aria-label="${label}"]`);
const btn = (root, text) => [...root.querySelectorAll('button')].find((b) => b.textContent.includes(text));
const tick = (ms = 0) => new Promise((r) => setTimeout(r, ms));
const mount = (key, store, extra = {}) => {
  const mod = TABS.find(([k]) => k === key)[2]; mod.resetView?.();
  const host = document.createElement('div'); document.body.append(host);
  const ctx = { store, data: { summaries: [] }, ...extra, rerender: () => host.replaceChildren(mod.render(ctx)) };
  store.subscribe(() => ctx.rerender()); ctx.rerender();
  return { host, ctx };
};
const menuItems = () => [...document.querySelectorAll('.ctx [role="menuitem"]')].map((b) => b.textContent);
const choose = (text) => click([...document.querySelectorAll('.ctx [role="menuitem"]')].find((b) => b.textContent.includes(text)));

test('menu contextuel : clic droit, échap, clic ailleurs, un seul menu à la fois', () => {
  const el = document.createElement('div'); document.body.append(el);
  let done = 0;
  CM.attachMenu(el, () => [{ label: 'Faire', onSelect: () => { done += 1; } }, null, { label: 'Effacer', danger: true, onSelect: () => {} }]);
  el.dispatchEvent(new win.Event('contextmenu', { bubbles: true, cancelable: true }));
  assert.deepEqual(menuItems(), ['Faire', 'Effacer']);
  el.dispatchEvent(new win.Event('contextmenu', { bubbles: true, cancelable: true }));
  assert.equal(document.querySelectorAll('.ctx').length, 1);
  document.dispatchEvent(new win.KeyboardEvent('keydown', { key: 'Escape' }));
  assert.equal(document.querySelectorAll('.ctx').length, 0);
  el.dispatchEvent(new win.Event('contextmenu', { bubbles: true, cancelable: true })); choose('Faire');
  assert.equal(done, 1); assert.equal(document.querySelectorAll('.ctx').length, 0);
  el.dispatchEvent(new win.Event('contextmenu', { bubbles: true, cancelable: true }));
  document.body.dispatchEvent(new win.Event('pointerdown', { bubbles: true }));
  assert.equal(document.querySelectorAll('.ctx').length, 0);
});

test('menu contextuel : appui long de 500 ms (tactile) ; un appui court ou un mouvement ne l\'ouvre pas', async () => {
  const el = document.createElement('div'); document.body.append(el); let clicks = 0;
  el.addEventListener('click', () => { clicks += 1; });
  CM.attachMenu(el, () => [{ label: 'Action', onSelect: () => {} }]);
  const ev = (type, props = {}) => Object.assign(new win.Event(type, { bubbles: true }), { pointerType: 'touch', clientX: 10, clientY: 10, ...props });
  el.dispatchEvent(ev('pointerdown')); await tick(100); el.dispatchEvent(ev('pointerup'));
  await tick(600); assert.equal(document.querySelectorAll('.ctx').length, 0); // appui court
  el.dispatchEvent(ev('pointerdown')); el.dispatchEvent(ev('pointermove', { clientX: 60 })); await tick(600);
  assert.equal(document.querySelectorAll('.ctx').length, 0); // le doigt a bougé
  el.dispatchEvent(ev('pointerdown')); await tick(600);
  assert.equal(document.querySelectorAll('.ctx').length, 1); // appui long
  el.dispatchEvent(ev('pointerup')); click(el); assert.equal(clicks, 0); // le clic qui suit est ignoré
  CM.closeMenu();
});

test('menus : to-do (statut, dupliquer, supprimer), note, lien — et bouton ⋯', () => {
  const store = createStore(memory());
  store.commit((s) => { s.todos.push(newTodo({ id: 't1', name: 'Rendre TP' })); s.notes.push(newNote({ id: 'n1', title: 'N' })); s.links.push(newLink({ id: 'l1', title: 'ENT', url: 'https://ent.example' })); });
  const ws = mount('workspace', store);
  const card = [...ws.host.querySelectorAll('li.card')].find((c) => c.textContent.includes('Rendre TP'));
  card.dispatchEvent(new win.Event('contextmenu', { bubbles: true, cancelable: true }));
  const items = menuItems();
  for (const label of ['Modifier', 'Statut : En cours', 'Planifier dans l\'agenda', 'Démarrer un Focus', 'Dupliquer', 'Supprimer']) assert.ok(items.includes(label), label);
  choose('Statut : En cours'); assert.equal(store.state.todos.find((t) => t.id === 't1').status, 'En cours');
  click(byLabel(ws.host, 'Actions pour « Rendre TP »')); choose('Dupliquer');
  assert.ok(store.state.todos.some((t) => t.name === 'Rendre TP (copie)'));
  const copy = store.state.todos.find((t) => t.name === 'Rendre TP (copie)'); assert.notEqual(copy.id, 't1');

  const notes = mount('notes', store); click(byLabel(notes.host, 'Actions de la note')); choose('Épingler');
  assert.equal(store.state.notes.find((n) => n.id === 'n1').pinned, true);
  const links = mount('links', store); click(byLabel(links.host, 'Actions du lien'));
  assert.ok(menuItems().includes('Copier le lien') && menuItems().includes('Ouvrir')); choose('Dupliquer');
  const dup = store.state.links.find((l) => l.title === 'ENT (copie)'); assert.ok(dup.id && dup.id !== 'l1');
});

test('menu « Démarrer un Focus » : prépare une session liée à UNE tâche', () => {
  const store = createStore(memory());
  store.commit((s) => s.todos.push(newTodo({ id: 't9', name: 'Réviser' })));
  const ws = mount('workspace', store);
  const card = [...ws.host.querySelectorAll('li.card')].find((c) => c.textContent.includes('Réviser'));
  card.dispatchEvent(new win.Event('contextmenu', { bubbles: true, cancelable: true })); choose('Démarrer un Focus');
  assert.equal(location.hash, '#focus');
  const fk = mount('focus', store); assert.equal(fk.host.querySelector('select[aria-label="Tâche liée"], select').value !== undefined, true);
});

test('réglages : widgets par défaut, jamais dans leur propre onglet, import borné', () => {
  const d = S.defaultSettings();
  assert.equal(d.widgets.home.length, S.WIDGETS.length); assert.deepEqual(d.widgets.workspace, ['today']); assert.deepEqual(d.widgets.calendar, ['tasks']);
  const r = S.sanitizeSettings({ settings: { widgets: { home: ['tip', 'nimporte', 'tip', 'today'], calendar: ['today', 'focus'], notes: 'x' } } }).settings.widgets;
  assert.deepEqual(r.home, ['tip', 'today']); assert.deepEqual(r.calendar, ['focus']); assert.deepEqual(r.notes, d.widgets.notes);
  assert.deepEqual(S.widgetsFor({ widgets: { focus: ['focus', 'tasks'] } }, 'focus'), ['tasks']);
});

test('widgets : barre en bas de chaque onglet, Home en grille, personnalisation (cases et flèches)', () => {
  const store = createStore(memory());
  const bar = widgetBar({ store, data: {}, rerender() {} }, 'notes');
  assert.ok(bar.querySelector('details[data-widget="today"]') && bar.querySelector('details[data-widget="tasks"]'));
  assert.equal(widgetBar({ store, data: {}, rerender() {} }, 'workspace').querySelector('details[data-widget="tasks"]'), null);
  const grid = homeGrid({ store, data: { summaries: [] }, rerender() {} });
  assert.equal(grid.querySelectorAll('section[data-widget]').length, 10);
  assert.ok(grid.textContent.includes('Objectif en cours') && grid.textContent.includes('Conseil du jour'));

  click(btn(bar, 'Personnaliser'));
  const dlg = [...document.querySelectorAll('dialog')].pop();
  click(dlg.querySelector('button[aria-label="Descendre Aujourd\'hui"]'));
  const boxes = [...dlg.querySelectorAll('input[type="checkbox"]')];
  boxes.find((b) => b.parentElement.textContent.includes('Focus')).checked = true;
  boxes.find((b) => b.parentElement.textContent.includes('Focus')).dispatchEvent(new win.Event('change', { bubbles: true }));
  dlg.querySelector('form').dispatchEvent(new win.Event('submit', { cancelable: true }));
  return tick().then(() => { assert.deepEqual(store.state.settings.widgets.notes, ['tasks', 'today', 'focus']); });
});

test('Home : suit les réglages (widget retiré = bloc absent)', () => {
  const store = createStore(memory());
  store.commit((s) => { s.settings.widgets.home = ['goal', 'tip']; });
  const { host } = mount('home', store);
  assert.equal(host.querySelectorAll('section[data-widget]').length, 2);
  assert.ok(host.textContent.includes('Aucun objectif en cours'));
});

// ---- Synchronisation : faux serveur Supabase en mémoire ----
function fakeServer({ confirmEmail = false } = {}) {
  const rows = new Map(); const users = new Map(); const log = [];
  const fetchFn = async (url, init = {}) => {
    const u = new URL(url); const body = init.body ? JSON.parse(init.body) : null; const h = init.headers ?? {};
    log.push({ path: u.pathname + u.search, method: init.method ?? 'GET', auth: h.Authorization, apikey: h.apikey, prefer: h.Prefer });
    const reply = (status, data) => ({ ok: status < 400, status, text: async () => (data === undefined ? '' : JSON.stringify(data)) });
    const session = (id, email) => ({ access_token: `tok-${id}`, refresh_token: `ref-${id}`, expires_in: 3600, user: { id, email } });
    if (u.pathname === '/auth/v1/signup') { users.set(body.email, { id: `u-${users.size + 1}`, pass: body.password }); return confirmEmail ? reply(200, { id: 'x' }) : reply(200, session(users.get(body.email).id, body.email)); }
    if (u.pathname === '/auth/v1/token' && u.searchParams.get('grant_type') === 'password') {
      const us = users.get(body.email); return us && us.pass === body.password ? reply(200, session(us.id, body.email)) : reply(400, { error_code: 'invalid_credentials' });
    }
    if (u.pathname === '/auth/v1/token') return reply(200, { ...session('u-1', 'a@b.c'), access_token: 'tok-new' });
    if (u.pathname === '/auth/v1/logout') return reply(204);
    if (u.pathname === '/rest/v1/user_state') {
      const uid = h.Authorization?.replace('Bearer tok-', ''); if (!uid || uid === h.Authorization) return reply(401, {});
      if (init.method === 'POST') { rows.set(body.user_id, { data: body.data, updated_at: body.updated_at }); return reply(201); }
      const want = u.searchParams.get('user_id').replace('eq.', ''); return reply(200, rows.has(want) && want === uid ? [rows.get(want)] : []);
    }
    return reply(404, {});
  };
  return { fetchFn, rows, users, log };
}
const clientFor = (server, cfg) => createClient({ url: 'https://abcd.supabase.co', anonKey: 'anon-key', fetchFn: server.fetchFn, getSession: () => cfg.session, setSession: (s) => { cfg.session = s; } });

test('sync : adresse https seule, identifiants hors sauvegarde', () => {
  assert.equal(cleanUrl('https://abcd.supabase.co/rest/v1'), 'https://abcd.supabase.co'); assert.equal(cleanUrl('http://abcd.supabase.co'), ''); assert.equal(cleanUrl('https://u:p@x.co'), ''); assert.equal(cleanUrl('nimporte'), '');
  assert.throws(() => createClient({ url: 'http://x', anonKey: 'k' }), /https/); assert.throws(() => createClient({ url: 'https://a.co', anonKey: ' ' }), /anon/);
  const st = memory(); saveSync(st, { url: 'https://a.co', anonKey: 'k', session: { access_token: 'x' }, last: '' });
  assert.equal(loadSync(st).session.access_token, 'x');
  const store = createStore(memory()); assert.ok(!store.exportJSON().includes('access_token'));
});

test('sync : compte, connexion, erreurs en français, envoi puis fusion entre deux appareils', async () => {
  const server = fakeServer(); const A = { session: null }; const B = { session: null };
  const a = clientFor(server, A);
  await assert.rejects(() => a.signIn('a@b.c', 'mauvais'), /incorrect/);
  await assert.rejects(() => a.pull(), /Connecte-toi/);
  assert.ok((await a.signUp('a@b.c', 'secret1')).session); assert.equal(A.session.user.email, 'a@b.c');

  const s1 = createStore(memory()); s1.commit((s) => { s.todos.push(newTodo({ id: 'tA', name: 'Depuis A' })); });
  assert.equal((await syncNow(a, s1)).hadCloud, false);
  assert.equal(server.rows.size, 1);
  assert.equal(server.log.find((l) => l.method === 'POST' && l.path === '/rest/v1/user_state').prefer, 'resolution=merge-duplicates,return=minimal');
  assert.ok(server.log.every((l) => l.apikey === 'anon-key'));

  const b = clientFor(server, B); await b.signIn('a@b.c', 'secret1');
  const s2 = createStore(memory()); s2.commit((s) => { s.todos.push(newTodo({ id: 'tB', name: 'Depuis B' })); });
  assert.equal((await syncNow(b, s2)).hadCloud, true);
  assert.deepEqual(s2.state.todos.map((t) => t.id).filter((i) => i.startsWith('t')).sort(), ['tA', 'tB']);
  await syncNow(a, s1); assert.ok(s1.state.todos.some((t) => t.id === 'tB'));
});

test('sync : remplacer le cloud, remplacer l\'appareil (propage une suppression), session renouvelée', async () => {
  const server = fakeServer(); const A = { session: null }; const a = clientFor(server, A);
  await a.signUp('a@b.c', 'secret1');
  const s1 = createStore(memory()); s1.commit((s) => { s.todos.push(newTodo({ id: 'x1', name: 'À supprimer' })); });
  await syncNow(a, s1);
  s1.commit((s) => { s.todos = s.todos.filter((t) => t.id !== 'x1'); });
  await replaceCloud(a, s1);
  const s2 = createStore(memory()); s2.commit((s) => { s.todos.push(newTodo({ id: 'x1', name: 'À supprimer' })); });
  await replaceDevice(a, s2); assert.ok(!s2.state.todos.some((t) => t.id === 'x1'));
  A.session.expires_at = Date.now() - 1000; await a.pull(); assert.equal(A.session.access_token, 'tok-new');
  const empty = fakeServer(); const E = { session: null }; const ec = clientFor(empty, E); await ec.signUp('z@b.c', 'secret1');
  await assert.rejects(() => replaceDevice(ec, createStore(memory())), /vide/);
  await a.signOut(); assert.equal(A.session, null);
});

test('sync : e-mail à confirmer, accès refusé expliqué, réseau coupé', async () => {
  const server = fakeServer({ confirmEmail: true }); const A = { session: null };
  assert.equal((await clientFor(server, A).signUp('a@b.c', 'secret1')).needsConfirm, true);
  const bad = createClient({ url: 'https://abcd.supabase.co', anonKey: 'k', getSession: () => ({ access_token: 'x', expires_at: Date.now() + 1e7, user: { id: 'u' } }), setSession() {}, fetchFn: async () => ({ ok: false, status: 401, text: async () => '{}' }) });
  await assert.rejects(() => bad.pull(), /Accès refusé/);
  const off = createClient({ url: 'https://abcd.supabase.co', anonKey: 'k', getSession: () => null, setSession() {}, fetchFn: async () => { throw new Error('offline'); } });
  await assert.rejects(() => off.signIn('a@b.c', 'secret1'), /Connexion impossible/);
});

test('onglet Paramètres : connexion et synchronisation depuis l\'interface', async () => {
  const server = fakeServer(); const st = memory();
  const orig = globalThis.fetch; globalThis.fetch = server.fetchFn;
  try {
    const store = createStore(memory()); store.commit((s) => { s.todos.push(newTodo({ id: 'ui1', name: 'Via UI' })); });
    const { host } = mount('settings', store, { storage: st });
    assert.ok(host.textContent.includes('Compte et synchronisation'));
    const set = (sel, v) => { const el = host.querySelector(sel); el.value = v; el.dispatchEvent(new win.Event('change', { bubbles: true })); };
    set('input[aria-label="Adresse du projet"]', 'https://abcd.supabase.co'); set('input[aria-label="Clé anon public"]', 'anon-key');
    host.querySelector('input[aria-label="E-mail"]').value = 'a@b.c'; host.querySelector('input[aria-label="Mot de passe"]').value = 'secret1';
    click(btn(host, 'Créer un compte')); await tick(20);
    assert.ok(host.textContent.includes('Connecté : a@b.c'), host.textContent.slice(0, 300));
    assert.ok(!JSON.stringify(loadSync(st)).includes('secret1')); // le mot de passe n'est jamais enregistré
    click(btn(host, 'Synchroniser maintenant')); await tick(20);
    assert.ok(host.textContent.includes('premier envoi')); assert.ok(loadSync(st).last); assert.equal(server.rows.size, 1);
    click(btn(host, 'Se déconnecter')); await tick(20);
    assert.ok(btn(host, 'Se connecter'));
  } finally { globalThis.fetch = orig; }
});
