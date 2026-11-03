import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setupDOM, memory } from './helpers/dom.js';
const win = setupDOM();
const { createStore, newTodo, sanitizeState } = await import('../js/store.js');
const D = await import('../js/deps-logic.js');
const { removeTodo } = await import('../js/tasks-logic.js');
const { changeStatus } = await import('../js/ui/todo-actions.js');
const { TABS } = await import('../js/app.js');
const { mergeList } = await import('../js/data-io.js');

const todo = (id, p = {}) => newTodo({ id, name: id, ...p });
const idx = D.indexById;

test('isBlocked : bloquée tant qu\'un blocage n\'est pas terminé ; un blocage supprimé ne compte plus', () => {
  const list = [todo('a'), todo('b', { blockedBy: ['a'] })];
  assert.equal(D.isBlocked(list[1], idx(list)), true);
  list[0].status = 'Terminés';
  assert.equal(D.isBlocked(list[1], idx(list)), false);
  assert.equal(D.isBlocked(todo('c', { blockedBy: ['fantome'] }), idx(list)), false);
});

test('une sous-tâche hérite du blocage de son parent (tant que le parent n\'est pas terminé)', () => {
  const list = [todo('a'), todo('p', { blockedBy: ['a'] }), todo('k', { parentId: 'p' })];
  assert.deepEqual(D.blockers(list[2], idx(list)).map((t) => t.id), ['a']);
  list[1].status = 'Terminés';
  assert.equal(D.isBlocked(list[2], idx(list)), false);
});

test('wouldCycle : soi-même, boucle directe et boucle indirecte', () => {
  const list = [todo('a'), todo('b', { blockedBy: ['a'] }), todo('c', { blockedBy: ['b'] })];
  assert.equal(D.wouldCycle(list, 'a', 'a'), true);
  assert.equal(D.wouldCycle(list, 'a', 'b'), true, 'A attendrait B qui attend A');
  assert.equal(D.wouldCycle(list, 'a', 'c'), true, 'boucle indirecte A ← C ← B ← A');
  assert.equal(D.wouldCycle(list, 'c', 'a'), false, 'C attend A en plus de B : permis');
  assert.equal(D.wouldCycle(list, 'b', 'c'), true);
});

test('checkBlock : messages pour soi-même, parent/enfant, boucle et limite', () => {
  const list = [todo('p'), todo('k', { parentId: 'p' }), todo('a'), todo('b', { blockedBy: ['a'] })];
  assert.match(D.checkBlock(list, 'a', 'a'), /elle-même/);
  assert.match(D.checkBlock(list, 'k', 'p'), /sous-tâche/);
  assert.match(D.checkBlock(list, 'p', 'k'), /sous-tâche/);
  assert.match(D.checkBlock(list, 'a', 'b'), /boucle/);
  assert.equal(D.checkBlock(list, 'b', 'a'), '', 'déjà présent : accepté');
  const many = [todo('x', { blockedBy: Array.from({ length: 20 }, (_, i) => `y${i}`) }), ...Array.from({ length: 21 }, (_, i) => todo(`y${i}`))];
  assert.match(D.checkBlock(many, 'x', 'y20'), /20 blocages/);
});

test('breakCycles : coupe le lien qui ferme la boucle, retire doublons, fantômes, parent↔enfant, et reste stable', () => {
  const list = [
    todo('a', { blockedBy: ['c', 'zz', 'a'] }), todo('b', { blockedBy: ['a', 'a'] }), todo('c', { blockedBy: ['b'] }),
    todo('p', { blockedBy: ['k'] }), todo('k', { parentId: 'p', blockedBy: ['p'] }),
  ];
  const out = D.breakCycles(list);
  const by = Object.fromEntries(out.map((t) => [t.id, t.blockedBy]));
  assert.deepEqual(by, { a: ['c'], b: ['a'], c: [], p: [], k: [] });
  assert.deepEqual(D.breakCycles(out).map((t) => t.blockedBy), out.map((t) => t.blockedBy), 'idempotent');
  assert.deepEqual(D.breakCycles(list).map((t) => t.blockedBy), out.map((t) => t.blockedBy), 'même résultat à chaque lecture');
});

test('fusion de deux appareils : un cycle créé par la réunion est coupé à la lecture', () => {
  const deviceA = [todo('x', { blockedBy: ['y'] }), todo('y')];
  const deviceB = [todo('x'), todo('y', { blockedBy: ['x'] })];
  // l'import remplace par identifiant : le fichier B l'emporte pour x et y, puis A est réimporté sur d'autres identifiants
  const merged = mergeList(deviceA, [{ ...deviceB[1] }, todo('x', { blockedBy: ['y'] })]);
  const s = sanitizeState({ todos: merged });
  const edges = s.todos.flatMap((t) => t.blockedBy.map((b) => `${t.id}<-${b}`));
  assert.equal(edges.length, 1, 'une seule des deux flèches survit');
});

test('sanitizeState : blockedBy borné à 20, filtré, sans cycle', () => {
  const s = sanitizeState({ todos: [{ id: 'a', blockedBy: Array.from({ length: 30 }, (_, i) => `b${i}`) }, ...Array.from({ length: 30 }, (_, i) => ({ id: `b${i}` }))] });
  assert.equal(s.todos[0].blockedBy.length, 20);
  assert.deepEqual(sanitizeState({ todos: [{ id: 'a', blockedBy: [1, null, '', 'b'] }, { id: 'b' }] }).todos[0].blockedBy, ['b']);
});

test('ready : non terminées, non bloquées, sans sous-tâche ouverte, urgentes d\'abord puis les plus « débloquantes »', () => {
  const list = [
    todo('a', { deadline: '2026-11-10' }), todo('b', { blockedBy: ['a'], deadline: '2026-11-05' }),
    todo('c', { deadline: '2026-11-10' }), todo('d', { blockedBy: ['c'] }), todo('e', { blockedBy: ['c'] }),
    todo('p'), todo('k', { parentId: 'p', deadline: '2026-11-01' }), todo('f', { status: 'Terminés' }), todo('g', { status: 'Sans statut' }),
  ];
  assert.deepEqual(D.ready(list).map((t) => t.id), ['k', 'c', 'a'].concat([]), 'k (1er nov.), puis c (débloque 2) avant a (débloque 1)');
});

test('earliestStart et conflicts', () => {
  const list = [todo('a', { deadline: '2026-11-10' }), todo('b', { deadline: '2026-11-12' }), todo('c', { blockedBy: ['a', 'b'], deadline: '2026-11-11' }), todo('d', { blockedBy: ['a'], deadline: '2026-11-20' })];
  assert.equal(D.earliestStart(list[2], idx(list)), '2026-11-12');
  assert.equal(D.earliestStart(list[0], idx(list)), '');
  const c = D.conflicts(list);
  assert.deepEqual(c.map((x) => [x.todo.id, x.blocker.id]), [['c', 'b']]);
});

test('topoOrder : les blocages avant ce qui en dépend, puis par date', () => {
  const list = [todo('c', { blockedBy: ['b'] }), todo('b', { blockedBy: ['a'], deadline: '2026-11-02' }), todo('a', { deadline: '2026-11-09' }), todo('z', { deadline: '2026-11-01' })];
  assert.deepEqual(D.topoOrder(list).map((t) => t.id), ['z', 'a', 'b', 'c']);
  const loop = [todo('x', { blockedBy: ['y'] }), todo('y', { blockedBy: ['x'] })];
  assert.equal(D.topoOrder(loop).length, 2, 'aucune tâche perdue même avec une boucle résiduelle');
});

test('removeTodo retire l\'identifiant de tous les blockedBy', () => {
  const st = { todos: [todo('a'), todo('b', { blockedBy: ['a', 'c'] }), todo('c')] };
  removeTodo(st, 'a');
  assert.deepEqual(st.todos[0].blockedBy, ['c']);
});

test('changeStatus : prévient avant de démarrer une tâche bloquée ; Annuler ne change rien', () => {
  const store = createStore(memory());
  store.commit((s) => { s.todos.push(todo('a'), todo('b', { blockedBy: ['a'] })); });
  const asked = []; globalThis.confirm = (m) => { asked.push(m); return false; };
  assert.equal(changeStatus(store, store.state.todos[1], 'En cours'), false);
  assert.match(asked[0], /attend « a »/);
  assert.equal(store.state.todos[1].status, 'A faire');
  globalThis.confirm = () => true;
  assert.equal(changeStatus(store, store.state.todos[1], 'En cours'), true, 'souple : on peut continuer en confirmant');
  assert.equal(store.state.todos[1].status, 'En cours');
  assert.equal(changeStatus(store, store.state.todos[1], 'A faire'), true, 'revenir en arrière ne demande rien');
});

test('changeStatus : le mode strict refuse sans demander', () => {
  const store = createStore(memory());
  store.commit((s) => { s.settings.work.strictDeps = true; s.todos.push(todo('a'), todo('b', { blockedBy: ['a'] })); });
  let asked = 0; globalThis.confirm = () => { asked += 1; return true; };
  assert.equal(changeStatus(store, store.state.todos[1], 'Terminés'), false);
  assert.equal(asked, 0);
  assert.ok([...document.querySelectorAll('.toast')].some((t) => t.textContent.includes('Bloquée par « a »')));
  assert.equal(changeStatus(store, store.state.todos[0], 'Terminés'), true);
  assert.equal(changeStatus(store, store.state.todos[1], 'Terminés'), true, 'une fois le blocage terminé, c\'est permis');
});

test('terminer un blocage débloque et le dit', () => {
  const store = createStore(memory());
  document.querySelectorAll('.toast').forEach((t) => t.remove());
  store.commit((s) => { s.todos.push(todo('a'), todo('b', { blockedBy: ['a'] }), todo('c', { blockedBy: ['a', 'zz'] })); });
  globalThis.confirm = () => true;
  changeStatus(store, store.state.todos[0], 'Terminés');
  const toast = document.querySelector('.toast');
  assert.ok(toast && toast.textContent.includes('Débloque : « b »'));
  assert.ok(toast.textContent.includes('« c »'));
});

test('kanban : une tâche bloquée est signalée ; le widget « Prêtes à démarrer » liste les autres', async () => {
  const store = createStore(memory());
  store.commit((s) => { s.todos.push(todo('a', { name: 'Lire le cours' }), todo('b', { name: 'Faire les exos', blockedBy: ['a'] })); });
  const ws = TABS.find(([k]) => k === 'workspace')[2];
  const host = document.createElement('div'); const ctx = { store, data: {}, rerender: () => host.replaceChildren(ws.render(ctx)) }; ctx.rerender();
  const cards = [...host.querySelectorAll('.card')];
  const blocked = cards.find((c) => c.textContent.includes('Faire les exos'));
  assert.ok(blocked.classList.contains('card--blocked'));
  assert.ok(blocked.querySelector('.chip--blocked').textContent.includes('Lire le cours'));
  assert.equal(cards.find((c) => c.textContent.includes('Lire le cours')).classList.contains('card--blocked'), false);
  const { widgetBody } = await import('../js/ui/widgets.js');
  const w = widgetBody({ store, data: {}, rerender() {} }, 'ready');
  assert.ok(w.textContent.includes('Lire le cours') && !w.textContent.includes('Faire les exos'));
});

test('boîte de dialogue : « Bloquée par » grise un choix qui ferait une boucle', async () => {
  const { openTodoDialog } = await import('../js/ui/todo-dialog.js');
  const store = createStore(memory());
  store.commit((s) => { s.todos.push(todo('a', { name: 'Alpha' }), todo('b', { name: 'Beta', blockedBy: ['a'] })); });
  openTodoDialog(store, store.state.todos[0]); // Alpha : choisir Beta créerait une boucle
  const dlg = [...document.querySelectorAll('dialog')].pop();
  const boxes = [...dlg.querySelectorAll('.deps input[type=checkbox]')];
  assert.equal(boxes.length, 1);
  assert.equal(boxes[0].disabled, true);
  assert.match(boxes[0].title, /boucle/);
  dlg.close();
  openTodoDialog(store, store.state.todos[1]); // Beta : Alpha est déjà coché
  const dlg2 = [...document.querySelectorAll('dialog')].pop();
  const box = dlg2.querySelector('.deps input[type=checkbox]');
  assert.equal(box.checked, true);
  box.checked = false; box.dispatchEvent(new win.Event('change', { bubbles: true }));
  dlg2.querySelector('form').dispatchEvent(new win.Event('submit', { bubbles: true, cancelable: true }));
  await new Promise((r) => setTimeout(r, 0));
  assert.deepEqual(store.state.todos[1].blockedBy, []);
});
