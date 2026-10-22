import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setupDOM, memory } from './helpers/dom.js';
setupDOM();
const { createStore } = await import('../js/store.js');
const { startFocusRuntime, endRun } = await import('../js/focus-runtime.js');

const withRun = (patch) => {
  const store = createStore(memory());
  const now = Date.now();
  store.commit((s) => { s.focusRun = { id: 'r1', start: now - 2000, planned: 10, tagId: 'tag-etude', title: 'Maths', todoId: '', eventId: '', lastSeen: now - 500, hiddenAt: null, ...patch(now) }; });
  return store;
};
const run = (store, opts = {}) => { const ended = []; const id = startFocusRuntime(store, { onEnd: (s) => ended.push(s), ...opts }); clearInterval(id); return ended; };

test('une session en cours continue', () => {
  const store = withRun(() => ({}));
  assert.equal(run(store).length, 0);
  assert.ok(store.state.focusRun);
});

test('temps écoulé et app visible : l\'arbre est planté', () => {
  const store = withRun((now) => ({ start: now - 10 * 60000 - 1000, lastSeen: now - 300 }));
  const ended = run(store);
  assert.equal(ended.length, 1); assert.equal(ended[0].status, 'done'); assert.equal(ended[0].actual, 10);
  assert.equal(store.state.focusRun, null); assert.equal(store.state.sessions.length, 1);
});

test('app quittée plus de 10 s : l\'arbre meurt et la session est enregistrée comme échec', () => {
  const store = withRun((now) => ({ hiddenAt: now - 11000, lastSeen: now - 11000 }));
  const ended = run(store, { isHidden: () => false });
  assert.equal(ended[0].status, 'failed');
  assert.equal(store.state.sessions[0].status, 'failed');
  assert.equal(store.state.sessions[0].title, 'Maths');
  assert.ok(store.state.sessions[0].actual < 1);
});

test('retour dans les 10 s : la session continue', () => {
  const store = withRun((now) => ({ hiddenAt: now - 4000, lastSeen: now - 4000 }));
  assert.equal(run(store, { isHidden: () => false }).length, 0);
  assert.ok(store.state.focusRun);
});

test('page rechargée trop tard : échec ; abandon manuel : échec', () => {
  const store = withRun((now) => ({ lastSeen: now - 30000 }));
  assert.equal(run(store, { isHidden: () => false })[0].status, 'failed');
  const s2 = withRun(() => ({}));
  assert.equal(endRun(s2, 'failed').status, 'failed');
  assert.equal(endRun(s2, 'failed'), null);
});

test('la session en cours survit à un rechargement (persistance)', () => {
  const st = memory();
  const a = createStore(st);
  a.commit((s) => { s.focusRun = { id: 'x', start: Date.now(), planned: 25, tagId: '', title: '', todoId: '', eventId: '', lastSeen: Date.now(), hiddenAt: null }; });
  assert.equal(createStore(st).state.focusRun.planned, 25);
});
