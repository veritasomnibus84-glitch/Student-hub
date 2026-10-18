import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createStore, sanitizeState, removeCourse, moveNote, newCourse, newTodo, newNote, seed } from '../js/store.js';
import { STORAGE_KEY } from '../js/constants.js';

const memory = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v), m }; };

test('seed contient les 8 cours MPC1', () => {
  assert.equal(seed().courses.length, 8);
});

test('sanitizeState corrige les valeurs invalides', () => {
  const s = sanitizeState({
    courses: [{ name: 5, semester: 'Semestre 9', exam: 'demain', syllabus: [{ name: 'a', url: 3 }] }, null, 'x'],
    todos: [{ name: 'T', status: 'Hack', type: '??', deadline: '2026-13' }],
    read: ['a', 2],
  });
  assert.equal(s.courses.length, 1);
  assert.equal(s.courses[0].name, 'Cours');
  assert.equal(s.courses[0].semester, 'Semestre 1');
  assert.equal(s.courses[0].exam, '');
  assert.equal(s.courses[0].syllabus[0].url, '');
  assert.equal(s.todos[0].status, 'Sans statut');
  assert.equal(s.todos[0].deadline, '');
  assert.deepEqual(s.read, ['a']);
});

test('sanitizeState tolère n\'importe quelle entrée', () => {
  for (const bad of [null, undefined, 42, 'x', [], {}]) assert.doesNotThrow(() => sanitizeState(bad));
});

test('persistance : un store rechargé retrouve les données', () => {
  const st = memory();
  const a = createStore(st);
  a.commit((s) => s.todos.push(newTodo({ name: 'Devoir 1', status: 'En cours' })));
  const b = createStore(st);
  assert.equal(b.state.todos[0].name, 'Devoir 1');
  assert.equal(b.state.todos[0].status, 'En cours');
});

test('JSON corrompu : retombe sur le seed sans planter', () => {
  const st = memory(); st.setItem(STORAGE_KEY, '{pas du json');
  assert.equal(createStore(st).state.courses.length, 8);
});

test('commit silent ne notifie pas, sinon oui', () => {
  const store = createStore(memory()); let n = 0;
  store.subscribe(() => { n += 1; });
  store.commit((s) => { s.read.push('x'); }, { silent: true });
  assert.equal(n, 0);
  store.commit((s) => { s.read.push('y'); });
  assert.equal(n, 1);
});

test('export puis import redonne le même état', () => {
  const a = createStore(memory());
  a.commit((s) => s.notes.push(newNote({ title: 'N', body: 'corps' })));
  const dump = a.exportJSON();
  const b = createStore(memory());
  b.importJSON(dump);
  assert.deepEqual(b.state, a.state);
});

test('import invalide lève une erreur et garde l\'état', () => {
  const a = createStore(memory());
  const before = a.exportJSON();
  assert.throws(() => a.importJSON('pas du json'));
  assert.equal(a.exportJSON(), before);
});

test('removeCourse détache les to-dos et notes', () => {
  const s = seed(); const c = s.courses[0];
  s.todos.push(newTodo({ name: 'x', courseId: c.id })); s.notes.push(newNote({ courseId: c.id }));
  removeCourse(s, c.id);
  assert.equal(s.courses.length, 7);
  assert.equal(s.todos[0].courseId, ''); assert.equal(s.notes[0].courseId, '');
});

test('moveNote échange avec la voisine visible', () => {
  const notes = [newNote({ id: 'a' }), newNote({ id: 'b' }), newNote({ id: 'c' })];
  assert.equal(moveNote(notes, 'c', -1), true);
  assert.deepEqual(notes.map((n) => n.id), ['a', 'c', 'b']);
  assert.equal(moveNote(notes, 'a', -1), false);
  assert.equal(moveNote(notes, 'a', 1, ['a', 'b']), true);
  assert.deepEqual(notes.map((n) => n.id), ['b', 'c', 'a']);
});

test('newCourse a les champs de la page Notion', () => {
  const c = newCourse('X');
  for (const k of ['code', 'semester', 'prof', 'exam', 'office', 'schedule', 'email', 'room', 'notes', 'readings', 'questions', 'syllabus']) assert.ok(k in c);
});
