import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setupDOM, memory } from './helpers/dom.js';
const win = setupDOM();
const { createStore, newTodo, sanitizeState, seed } = await import('../js/store.js');
const T = await import('../js/tasks-logic.js');
const { changeStatus, deleteTodo, addSubtask } = await import('../js/ui/todo-actions.js');
const { TABS } = await import('../js/app.js');

const todo = (id, p = {}) => newTodo({ id, name: id, ...p });
const state = (todos, work = {}) => ({ todos, settings: { work: { autoCloseParent: true, ...work } } });
const ws = () => TABS.find(([k]) => k === 'workspace')[2];
const mount = (store) => { const host = document.createElement('div'); const ctx = { store, data: {}, rerender: () => host.replaceChildren(ws().render(ctx)) }; ctx.rerender(); store.subscribe(() => ctx.rerender()); return host; };

test('canNest : un seul niveau, pas soi-même, pas si on a déjà des enfants', () => {
  const list = [todo('p'), todo('c', { parentId: 'p' }), todo('x')];
  assert.equal(T.canNest(list, 'x', 'p'), true);
  assert.equal(T.canNest(list, 'x', 'x'), false);
  assert.equal(T.canNest(list, 'x', 'c'), false, 'une sous-tâche ne peut pas être parent');
  assert.equal(T.canNest(list, 'p', 'x'), false, 'un parent ne devient pas sous-tâche');
  assert.equal(T.canNest(list, 'x', 'absent'), false);
  assert.equal(T.canNest(list, 'c', ''), true, 'détacher est toujours permis');
});

test('parentChoices exclut la tâche, les sous-tâches et les tâches qui ont des enfants', () => {
  const list = [todo('p'), todo('c', { parentId: 'p' }), todo('x'), todo('y')];
  assert.deepEqual(T.parentChoices(list, 'x').map((t) => t.id), ['p', 'y']);
  assert.deepEqual(T.parentChoices(list, 'p').map((t) => t.id), [], 'p a des enfants : aucun parent possible');
});

test('subCounts, itemProgress : sous-tâches faites sur total, sinon 0 ou 1', () => {
  const list = [todo('p'), todo('a', { parentId: 'p', status: 'Terminés' }), todo('b', { parentId: 'p' }), todo('s', { status: 'Terminés' }), todo('t')];
  assert.deepEqual(T.subCounts(list[0], list), { done: 1, total: 2 });
  assert.equal(T.subCounts(list[3], list), null);
  assert.equal(T.itemProgress(list[0], list), 0.5);
  assert.equal(T.itemProgress(list[3], list), 1);
  assert.equal(T.itemProgress(list[4], list), 0);
});

test('rollup : moyenne des tâches de niveau 1, une sous-tâche ne compte pas deux fois', () => {
  const list = [todo('p'), todo('a', { parentId: 'p', status: 'Terminés' }), todo('b', { parentId: 'p', status: 'Terminés' }), todo('s')];
  assert.equal(T.rollup(list, list), 0.5); // p = 100 %, s = 0 %
  assert.equal(T.rollup([], list), 0);
  assert.equal(T.rollup([list[1]], list), 0, 'une liste sans tâche de niveau 1 donne 0');
});

test('setStatus : pose doneAt en terminant et le vide en rouvrant', () => {
  const st = state([todo('a')]);
  assert.deepEqual(T.setStatus(st, 'a', 'Terminés', { today: '2026-11-02' }), ['a']);
  assert.equal(st.todos[0].doneAt, '2026-11-02');
  T.setStatus(st, 'a', 'En cours', { today: '2026-11-03' });
  assert.equal(st.todos[0].doneAt, '');
  assert.deepEqual(T.setStatus(st, 'a', 'En cours'), [], 'même statut : rien ne change');
  assert.deepEqual(T.setStatus(st, 'a', 'Inconnu'), []);
  assert.deepEqual(T.setStatus(st, 'zzz', 'Terminés'), []);
});

test('setStatus : la dernière sous-tâche terminée termine le parent ; rouvrir une sous-tâche le remet En cours', () => {
  const st = state([todo('p'), todo('a', { parentId: 'p' }), todo('b', { parentId: 'p' })]);
  T.setStatus(st, 'a', 'Terminés', { today: '2026-11-02' });
  assert.equal(st.todos[0].status, 'A faire');
  T.setStatus(st, 'b', 'Terminés', { today: '2026-11-02' });
  assert.equal(st.todos[0].status, 'Terminés');
  assert.equal(st.todos[0].doneAt, '2026-11-02');
  T.setStatus(st, 'b', 'A faire');
  assert.equal(st.todos[0].status, 'En cours');
  assert.equal(st.todos[0].doneAt, '');
});

test('setStatus : le réglage autoCloseParent désactive la fermeture automatique', () => {
  const st = state([todo('p'), todo('a', { parentId: 'p' })], { autoCloseParent: false });
  T.setStatus(st, 'a', 'Terminés');
  assert.equal(st.todos[0].status, 'A faire');
});

test('setStatus avec cascade : terminer le parent termine ses sous-tâches', () => {
  const st = state([todo('p'), todo('a', { parentId: 'p' }), todo('b', { parentId: 'p', status: 'Terminés', doneAt: '2026-10-01' })]);
  const changed = T.setStatus(st, 'p', 'Terminés', { today: '2026-11-02', cascade: true });
  assert.deepEqual(changed.sort(), ['a', 'p']);
  assert.equal(st.todos[2].doneAt, '2026-10-01', 'une sous-tâche déjà faite garde sa date');
  const st2 = state([todo('p'), todo('a', { parentId: 'p' })]);
  T.setStatus(st2, 'p', 'Terminés');
  assert.equal(st2.todos[1].status, 'A faire', 'sans cascade les sous-tâches restent');
});

test('removeTodo : détache les sous-tâches ou les supprime ; nettoie blockedBy', () => {
  const mk = () => state([todo('p'), todo('a', { parentId: 'p' }), todo('z', { blockedBy: ['p'] })]);
  const s1 = mk(); T.removeTodo(s1, 'p');
  assert.deepEqual(s1.todos.map((t) => t.id), ['a', 'z']);
  assert.equal(s1.todos[0].parentId, '');
  assert.deepEqual(s1.todos[1].blockedBy, []);
  const s2 = mk(); assert.equal(T.removeTodo(s2, 'p', { cascade: true }), 2);
  assert.deepEqual(s2.todos.map((t) => t.id), ['z']);
});

test('fixParents : orphelin, soi-même, deux niveaux et boucle ramenés à un seul niveau', () => {
  const out = T.fixParents([
    todo('a', { parentId: 'absent' }), todo('b', { parentId: 'b' }),
    todo('p'), todo('c', { parentId: 'p' }), todo('d', { parentId: 'c' }),
    todo('x', { parentId: 'y' }), todo('y', { parentId: 'x' }),
  ]);
  const parent = Object.fromEntries(out.map((t) => [t.id, t.parentId]));
  assert.deepEqual(parent, { a: '', b: '', p: '', c: 'p', d: '', x: '', y: '' });
});

test('inheritFromParent : cours et projet du parent', () => {
  assert.deepEqual(T.inheritFromParent(todo('p', { courseId: 'c1' })), { parentId: 'p', courseId: 'c1', projectId: '' });
});

test('sanitizeState : parentId, effort et doneAt validés ; export puis import sans perte', () => {
  const raw = { todos: [
    { id: 'p', name: 'Parent', status: 'Terminés', doneAt: '2026-11-02', effort: 90 },
    { id: 'c', name: 'Enfant', parentId: 'p', effort: 99999 },
    { id: 'n', name: 'Négatif', effort: -5, doneAt: '2026-11-02', status: 'A faire' },
    { id: 'v', name: 'Date folle', status: 'Terminés', doneAt: 'hier' },
  ] };
  const s = sanitizeState(raw);
  const by = Object.fromEntries(s.todos.map((t) => [t.id, t]));
  assert.equal(by.p.doneAt, '2026-11-02'); assert.equal(by.p.effort, 90);
  assert.equal(by.c.parentId, 'p'); assert.equal(by.c.effort, 6000);
  assert.equal(by.n.effort, 0); assert.equal(by.n.doneAt, '', 'doneAt vidé si la tâche n\'est pas terminée');
  assert.equal(by.v.doneAt, '');
  const store = createStore(memory());
  store.importJSON(JSON.stringify({ app: 'student-hub', kind: 'all', version: 1, data: s }));
  assert.deepEqual(store.state.todos.map((t) => [t.id, t.parentId, t.effort, t.doneAt]), s.todos.map((t) => [t.id, t.parentId, t.effort, t.doneAt]));
});

test('anciennes sauvegardes : les tâches sans nouveaux champs se chargent', () => {
  const s = sanitizeState({ todos: [{ id: 'old', name: 'Ancien', status: 'Terminés' }] });
  assert.deepEqual([s.todos[0].parentId, s.todos[0].effort, s.todos[0].doneAt], ['', 0, '']);
  assert.equal(seed().settings.work.autoCloseParent, true);
  assert.equal(sanitizeState({ settings: { work: { autoCloseParent: false, capacityMin: 99999 } } }).settings.work.capacityMin, 960);
});

test('changeStatus : demande de terminer aussi les sous-tâches ; Annuler ne change rien', () => {
  const store = createStore(memory());
  store.commit((s) => { s.todos.push(todo('p'), todo('a', { parentId: 'p' }), todo('b', { parentId: 'p' })); });
  const asked = []; globalThis.confirm = (m) => { asked.push(m); return false; };
  assert.equal(changeStatus(store, store.state.todos[0], 'Terminés'), false);
  assert.match(asked[0], /2 sous-tâches/);
  assert.equal(store.state.todos[0].status, 'A faire');
  globalThis.confirm = () => true;
  assert.equal(changeStatus(store, store.state.todos[0], 'Terminés'), true);
  assert.deepEqual(store.state.todos.map((t) => t.status), ['Terminés', 'Terminés', 'Terminés']);
  assert.match(store.state.todos[0].doneAt, /^\d{4}-\d{2}-\d{2}$/);
});

test('deleteTodo : Annuler au 2e choix conserve les sous-tâches comme tâches de niveau 1', () => {
  const store = createStore(memory());
  store.commit((s) => { s.todos.push(todo('p'), todo('a', { parentId: 'p' })); });
  let n = 0; globalThis.confirm = () => { n += 1; return n === 1; }; // supprimer : oui ; avec les sous-tâches : non
  assert.equal(deleteTodo(store, store.state.todos[0]), true);
  assert.deepEqual(store.state.todos.map((t) => [t.id, t.parentId]), [['a', '']]);
  assert.ok(store.state.tombstones.todos.p, 'un marqueur de suppression est enregistré');
  globalThis.confirm = () => true;
});

test('addSubtask : hérite du cours du parent, refuse un nom vide', () => {
  const store = createStore(memory());
  store.commit((s) => { s.todos.push(todo('p', { courseId: 'c9' })); });
  assert.equal(addSubtask(store, store.state.todos[0], '   '), false);
  assert.equal(addSubtask(store, store.state.todos[0], 'Lire le chapitre'), true);
  const kid = store.state.todos[1];
  assert.deepEqual([kid.name, kid.parentId, kid.courseId], ['Lire le chapitre', 'p', 'c9']);
});

test('kanban : la sous-tâche se range sous son parent, avec compteur et barre', () => {
  const store = createStore(memory());
  store.commit((s) => { s.todos.push(todo('p', { name: 'Dossier' }), todo('a', { name: 'Plan', parentId: 'p', status: 'Terminés' }), todo('b', { name: 'Rédaction', parentId: 'p' })); });
  const host = mount(store);
  assert.equal(host.querySelectorAll('.card--stack').length, 1, 'une seule carte : celle du parent');
  const card = host.querySelector('.card--stack');
  assert.ok(card.textContent.includes('1/2'));
  assert.ok(card.querySelector('progress'));
  assert.equal(card.querySelectorAll('.card__subs li').length, 2);
  const box = [...card.querySelectorAll('.card__subs input[type=checkbox]')][1];
  box.checked = true; box.dispatchEvent(new win.Event('change', { bubbles: true }));
  assert.deepEqual(store.state.todos.map((t) => t.status), ['Terminés', 'Terminés', 'Terminés'], 'la dernière sous-tâche termine le parent');
});

test('kanban : une sous-tâche dont le parent est filtré garde sa propre carte', () => {
  const store = createStore(memory());
  store.commit((s) => { s.todos.push(todo('p', { name: 'Dossier' }), todo('a', { name: 'Introduction', parentId: 'p' })); });
  const host = mount(store);
  const search = host.querySelector('input[type=search]');
  search.value = 'Introduction'; search.dispatchEvent(new win.Event('input', { bubbles: true }));
  const cards = host.querySelectorAll('.card');
  assert.equal(cards.length, 1);
  assert.ok(cards[0].textContent.includes('↳ Dossier'));
});
