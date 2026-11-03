import { test } from 'node:test';
import assert from 'node:assert/strict';
import { groupByStatus, filterTodos, sortTodos, upcoming, daysUntil, todayISO } from '../js/kanban.js';
import { newTodo } from '../js/store.js';

const t = (p) => newTodo(p);

test('groupByStatus range par colonne, statut inconnu -> Sans statut', () => {
  const g = groupByStatus([t({ status: 'A faire' }), t({ status: 'Terminés' }), t({ status: '???' })]);
  assert.equal(g['A faire'].length, 1);
  assert.equal(g['Terminés'].length, 1);
  assert.equal(g['Sans statut'].length, 1);
  assert.deepEqual(Object.keys(g), ['A faire', 'En cours', 'Terminés', 'Sans statut']);
});

test('filterTodos par cours, type et recherche (insensible à la casse)', () => {
  const list = [t({ name: 'Devoir immuno', courseId: 'c1', type: 'Devoir' }), t({ name: 'Lire chap 2', courseId: 'c2', type: 'Lecture' })];
  assert.equal(filterTodos(list, { courseId: 'c1' }).length, 1);
  assert.equal(filterTodos(list, { type: 'Lecture' })[0].name, 'Lire chap 2');
  assert.equal(filterTodos(list, { query: 'IMMUNO' }).length, 1);
  assert.equal(filterTodos(list, {}).length, 2);
});

test('sortTodos : deadline croissante, vides à la fin', () => {
  const list = [t({ name: 'c' }), t({ name: 'b', deadline: '2026-11-02' }), t({ name: 'a', deadline: '2026-10-20' })];
  assert.deepEqual(sortTodos(list, 'deadline').map((x) => x.name), ['a', 'b', 'c']);
  assert.deepEqual(sortTodos(list, 'name').map((x) => x.name), ['a', 'b', 'c']);
});

test('sortTodos par cours utilise le nom du cours', () => {
  const courses = [{ id: '1', name: 'Zoo' }, { id: '2', name: 'Algèbre' }];
  const list = [t({ name: 'x', courseId: '1' }), t({ name: 'y', courseId: '2' })];
  assert.deepEqual(sortTodos(list, 'course', courses).map((x) => x.name), ['y', 'x']);
});

test('upcoming ignore les terminés et ceux sans date', () => {
  const list = [t({ name: 'a', deadline: '2026-10-20' }), t({ name: 'b', deadline: '2026-10-19', status: 'Terminés' }), t({ name: 'c' })];
  assert.deepEqual(upcoming(list).map((x) => x.name), ['a']);
});

test('daysUntil et todayISO', () => {
  assert.equal(daysUntil('2026-10-20', '2026-10-17'), 3);
  assert.equal(daysUntil('2026-10-15', '2026-10-17'), -2);
  assert.match(todayISO(new Date(2026, 9, 5)), /^2026-10-05$/);
});
