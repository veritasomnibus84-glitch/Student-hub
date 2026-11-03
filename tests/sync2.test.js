import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setupDOM, memory } from './helpers/dom.js';
setupDOM();
const TB = await import('../js/tombstones.js');
const { createStore, newTodo, newNote } = await import('../js/store.js');
const { createClient, syncNow, replaceDevice, saveSync, loadSync } = await import('../js/sync.js');
const { autoSyncOnce, resetAutoSync, MIN_GAP } = await import('../js/autosync.js');
const X = await import('../js/xp-logic.js');

function fakeServer() {
  const rows = new Map(); const users = new Map();
  const fetchFn = async (url, init = {}) => {
    const u = new URL(url); const body = init.body ? JSON.parse(init.body) : null; const h = init.headers ?? {};
    const reply = (status, data) => ({ ok: status < 400, status, text: async () => (data === undefined ? '' : JSON.stringify(data)) });
    const session = (id, email) => ({ access_token: `tok-${id}`, refresh_token: `ref-${id}`, expires_in: 3600, user: { id, email } });
    if (u.pathname === '/auth/v1/signup') { users.set(body.email, { id: `u-${users.size + 1}`, pass: body.password }); return reply(200, session(users.get(body.email).id, body.email)); }
    if (u.pathname === '/auth/v1/token') { const us = users.get(body.email); return us && us.pass === body.password ? reply(200, session(us.id, body.email)) : reply(400, { error_code: 'invalid_credentials' }); }
    if (u.pathname === '/rest/v1/user_state') {
      const uid = h.Authorization?.replace('Bearer tok-', '');
      if (init.method === 'POST') { rows.set(body.user_id, { data: body.data, updated_at: body.updated_at }); return reply(201); }
      const want = u.searchParams.get('user_id').replace('eq.', ''); return reply(200, rows.has(want) && want === uid ? [rows.get(want)] : []);
    }
    return reply(404, {});
  };
  return { fetchFn, rows, users };
}
const device = async (server, email = 'a@b.c') => {
  const cfg = { session: null }; const c = createClient({ url: 'https://abcd.supabase.co', anonKey: 'k', fetchFn: server.fetchFn, getSession: () => cfg.session, setSession: (s) => { cfg.session = s; } });
  if (server.users.has(email)) await c.signIn(email, 'secret1'); else await c.signUp(email, 'secret1');
  return { client: c, store: createStore(memory()) };
};

test('marqueurs : une suppression est datée, appliquée, fusionnée, nettoyée', () => {
  const state = { todos: [{ id: 'a' }, { id: 'b' }], notes: [{ id: 'n' }], tombstones: {} };
  const before = TB.idSets(state); state.todos = state.todos.filter((t) => t.id !== 'a'); TB.recordDeletions(state, before, '2026-10-24T10:00:00Z');
  assert.deepEqual(state.tombstones, { todos: { a: '2026-10-24T10:00:00Z' } });
  const other = { todos: [{ id: 'a' }, { id: 'c' }], notes: [{ id: 'n' }], tombstones: state.tombstones };
  assert.equal(TB.applyTombstones(other), 1); assert.deepEqual(other.todos.map((t) => t.id), ['c']);
  assert.deepEqual(TB.mergeTombstones({ todos: { a: '2026-01-01T00:00:00Z' } }, { todos: { a: '2026-02-01T00:00:00Z', z: '2026-01-01T00:00:00Z' }, notes: { n: '2026-01-01T00:00:00Z' } }), { todos: { a: '2026-02-01T00:00:00Z', z: '2026-01-01T00:00:00Z' }, notes: { n: '2026-01-01T00:00:00Z' } });
  const now = Date.parse('2026-10-24T00:00:00Z');
  const clean = TB.sanitizeTombstones({ tombstones: { todos: { old: '2020-01-01T00:00:00Z', ok: '2026-10-01T00:00:00Z', bad: 'x', ['i'.repeat(50)]: '2026-10-01T00:00:00Z' }, nimporte: { a: '2026-10-01T00:00:00Z' } } }, now).tombstones;
  assert.deepEqual(clean, { todos: { ok: '2026-10-01T00:00:00Z' } });
});

test('store : seule une suppression par modification crée un marqueur (pas un import, pas une simple édition)', () => {
  const store = createStore(memory());
  store.commit((s) => { s.todos.push(newTodo({ id: 't1', name: 'x' })); s.todos.push(newTodo({ id: 't2', name: 'y' })); });
  assert.deepEqual(store.state.tombstones, {});
  store.commit(() => { store.state.todos[0].name = 'édité'; }); assert.deepEqual(store.state.tombstones, {});
  store.commit((s) => { s.todos = s.todos.filter((t) => t.id !== 't1'); });
  assert.deepEqual(Object.keys(store.state.tombstones.todos), ['t1']);
  store.importFile(JSON.stringify({ app: 'student-hub', kind: 'all', version: 1, data: { todos: [] } }), { mode: 'replace' });
  assert.deepEqual(Object.keys(store.state.tombstones.todos), ['t1']); // remplacer n'ajoute pas de marqueur
  assert.ok(store.exportJSON().includes('"tombstones"'));
});

test('synchronisation : une suppression faite sur un appareil se propage à l\'autre (sans ressusciter)', async () => {
  const server = fakeServer(); const A = await device(server); const B = await device(server);
  A.store.commit((s) => { s.todos.push(newTodo({ id: 't1', name: 'À supprimer' }), newTodo({ id: 't2', name: 'À garder' })); s.notes.push(newNote({ id: 'n1', title: 'Note' })); });
  await syncNow(A.client, A.store); await syncNow(B.client, B.store);
  assert.deepEqual(B.store.state.todos.map((t) => t.id).filter((i) => i.startsWith('t')).sort(), ['t1', 't2']);
  A.store.commit((s) => { s.todos = s.todos.filter((t) => t.id !== 't1'); s.notes = []; });
  await syncNow(A.client, A.store);
  await syncNow(B.client, B.store); // B fusionne : t1 et n1 doivent disparaître
  assert.ok(!B.store.state.todos.some((t) => t.id === 't1')); assert.ok(B.store.state.todos.some((t) => t.id === 't2')); assert.equal(B.store.state.notes.length, 0);
  await syncNow(A.client, A.store); // et ne reviennent pas par A
  assert.ok(!A.store.state.todos.some((t) => t.id === 't1'));
  // un élément ajouté pendant ce temps sur B n'est pas perdu
  B.store.commit((s) => s.todos.push(newTodo({ id: 't3', name: 'Nouveau de B' }))); await syncNow(B.client, B.store); await syncNow(A.client, A.store);
  assert.ok(A.store.state.todos.some((t) => t.id === 't3'));
});

test('fusion : XP = le plus élevé, réglages de l\'appareil conservés ; « remplacer cet appareil » reprend aussi les réglages', async () => {
  const server = fakeServer(); const A = await device(server); const B = await device(server);
  A.store.commit((s) => { s.xp = { total: 500, days: { '2026-10-20': 200, '2026-10-21': 100 } }; s.settings.appearance.theme = 'dark'; });
  B.store.commit((s) => { s.xp = { total: 120, days: { '2026-10-20': 120 } }; s.settings.appearance.theme = 'light'; });
  await syncNow(B.client, B.store); await syncNow(A.client, A.store); // le cloud finit avec l'état de A
  assert.equal(A.store.state.xp.total, 500); assert.equal(A.store.state.settings.appearance.theme, 'dark');
  await syncNow(B.client, B.store);
  assert.equal(B.store.state.xp.total, 500); assert.deepEqual(B.store.state.xp.days, { '2026-10-20': 200, '2026-10-21': 100 });
  assert.equal(B.store.state.settings.appearance.theme, 'light'); // les réglages restent propres à chaque appareil
  const C = await device(server); await replaceDevice(C.client, C.store);
  assert.equal(C.store.state.settings.appearance.theme, 'light'); // le cloud porte les réglages du dernier appareil synchronisé : B
  assert.equal(X.levelOf(C.store.state.xp.total), 4);
});

test('synchronisation automatique : désactivée, sans compte, trop récente, fenêtre ouverte, puis réussie', async () => {
  resetAutoSync();
  const server = fakeServer(); const A = await device(server); const storage = memory();
  const ctx = { store: A.store, storage };
  assert.equal(await autoSyncOnce(ctx), 'off');
  A.store.commit((s) => { s.settings.sync.auto = true; });
  assert.equal(await autoSyncOnce(ctx), 'no-account');
  const cfg = { url: 'https://abcd.supabase.co', anonKey: 'k', session: null };
  const c = createClient({ url: cfg.url, anonKey: cfg.anonKey, fetchFn: server.fetchFn, getSession: () => cfg.session, setSession: (s) => { cfg.session = s; } });
  await c.signIn('a@b.c', 'secret1'); saveSync(storage, { ...cfg, last: '' });
  const dlg = document.createElement('dialog'); dlg.setAttribute('open', ''); document.body.append(dlg);
  assert.equal(await autoSyncOnce(ctx, { fetchFn: server.fetchFn }), 'busy-ui'); dlg.remove();
  A.store.commit((s) => s.todos.push(newTodo({ id: 'auto1', name: 'Auto' })));
  const t0 = Date.parse('2026-10-24T10:00:00Z');
  assert.equal(await autoSyncOnce(ctx, { fetchFn: server.fetchFn, now: () => t0 }), 'ok');
  assert.equal(server.rows.size, 1); assert.equal(loadSync(storage).last, new Date(t0).toISOString());
  assert.equal(await autoSyncOnce(ctx, { fetchFn: server.fetchFn, now: () => t0 + 60000 }), 'recent');
  assert.equal(await autoSyncOnce(ctx, { fetchFn: server.fetchFn, now: () => t0 + MIN_GAP + 1 }), 'ok');
  assert.equal(await autoSyncOnce(ctx, { fetchFn: server.fetchFn, now: () => t0 + 60000, force: true }), 'ok');
});

test('synchronisation automatique : une erreur réseau ne casse rien et ne prévient qu\'une fois par 10 minutes', async () => {
  resetAutoSync();
  const store = createStore(memory()); store.commit((s) => { s.settings.sync.auto = true; });
  const storage = memory(); saveSync(storage, { url: 'https://abcd.supabase.co', anonKey: 'k', session: { access_token: 'x', refresh_token: 'y', expires_at: Date.now() + 1e7, user: { id: 'u' } }, last: '' });
  const msgs = []; const down = async () => { throw new Error('offline'); };
  const ctx = { store, storage }; const t = 1_000_000_000_000;
  assert.equal(await autoSyncOnce(ctx, { fetchFn: down, now: () => t, notify: (m) => msgs.push(m) }), 'error');
  assert.equal(await autoSyncOnce(ctx, { fetchFn: down, now: () => t + 1000, notify: (m) => msgs.push(m) }), 'error');
  assert.equal(msgs.length, 1); assert.match(msgs[0], /Synchronisation impossible/);
  assert.equal(await autoSyncOnce(ctx, { fetchFn: down, now: () => t + 11 * 60000, notify: (m) => msgs.push(m) }), 'error'); assert.equal(msgs.length, 2);
});
