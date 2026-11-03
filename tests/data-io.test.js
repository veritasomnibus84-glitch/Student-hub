import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SECTIONS, ALL_KEYS, mergeList, parseImport, parseSummaries, parseVideos } from '../js/data-io.js';
import { createStore, newNote, newTodo, newEvent, newLink, removeEvent, eventFromTodo, sanitizeState, seed } from '../js/store.js';

const memory = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v) }; };

test('chaque clé de données appartient à un onglet', () => {
  const state = seed();
  for (const k of ALL_KEYS) assert.ok(k in state, `clé absente du state : ${k}`);
  assert.ok(Object.keys(SECTIONS).length >= 8);
});

test('export d\'un onglet : seules ses données, et réimportable', () => {
  const a = createStore(memory());
  a.commit((s) => { s.notes.push(newNote({ title: 'N1' })); s.links.push(newLink({ title: 'L1', url: 'https://x.org' })); });
  const text = a.exportSection('notes');
  const parsed = JSON.parse(text);
  assert.equal(parsed.section, 'notes'); assert.deepEqual(Object.keys(parsed.data), ['notes']);
  const b = createStore(memory());
  const res = b.importFile(text, { only: 'notes' });
  assert.equal(res.counts.notes, 1); assert.equal(b.state.notes[0].title, 'N1'); assert.equal(b.state.links.length, 0);
});

test('un fichier d\'un autre onglet est refusé, sans rien modifier', () => {
  const a = createStore(memory()); a.commit((s) => s.notes.push(newNote({ title: 'N' })));
  const b = createStore(memory());
  assert.throws(() => b.importFile(a.exportSection('notes'), { only: 'links' }), /Notes/);
  assert.equal(b.state.notes.length, 0);
});

test('sauvegarde complète importée dans un onglet : seules les données de cet onglet', () => {
  const a = createStore(memory());
  a.commit((s) => { s.notes.push(newNote({ title: 'N' })); s.links.push(newLink({ title: 'L', url: 'https://x.org' })); });
  const b = createStore(memory());
  b.importFile(a.exportJSON(), { only: 'links' });
  assert.equal(b.state.links.length, 1); assert.equal(b.state.notes.length, 0);
});

test('fusion par id et remplacement', () => {
  const a = createStore(memory());
  a.commit((s) => { s.notes.push(newNote({ id: 'n1', title: 'ancien' }), newNote({ id: 'n2', title: 'garde' })); });
  const file = createStore(memory());
  file.commit((s) => { s.notes.push(newNote({ id: 'n1', title: 'nouveau' }), newNote({ id: 'n3', title: 'ajouté' })); });
  const text = file.exportSection('notes');
  a.importFile(text, { mode: 'merge', only: 'notes' });
  assert.deepEqual(a.state.notes.map((n) => `${n.id}:${n.title}`).sort(), ['n1:nouveau', 'n2:garde', 'n3:ajouté']);
  a.importFile(text, { mode: 'replace', only: 'notes' });
  assert.deepEqual(a.state.notes.map((n) => n.id).sort(), ['n1', 'n3']);
});

test('formats invalides et anciens exports', () => {
  assert.throws(() => parseImport('pas du json'), /illisible/);
  assert.throws(() => parseImport('[1,2]'), /non reconnu/);
  assert.throws(() => parseImport('{"foo":1}'), /non reconnu/);
  assert.equal(parseImport('{"notes":[]}').kind, 'all');
  assert.deepEqual(mergeList(['a', 'b'], ['b', 'c']), ['a', 'b', 'c']);
});

test('résumés et vidéos : formats des fichiers du dépôt acceptés', () => {
  assert.equal(parseSummaries('[{"id":"1","summary":"x"}]').length, 1);
  assert.equal(parseSummaries('{"summaries":[{"id":"1"}]}').length, 1);
  assert.equal(parseSummaries('{"app":"student-hub"}'), null);
  assert.equal(parseSummaries('nope'), null);
  assert.equal(parseVideos('{"videos":[{"id":"abcdefghijk"}]}').length, 1);
  const s = createStore(memory());
  assert.equal(s.importLocal('messages', [{ id: 'a', source: 'whatsapp', summary: 'S' }, { id: 'b', source: '??', summary: 'T' }]), 2);
  assert.equal(s.state.localSummaries[1].source, 'gmail');
  assert.equal(s.importLocal('messages', [{ id: 'a', summary: 'S2' }, { id: 'c', summary: 'U' }]), 3);
  assert.equal(s.importLocal('videos', [{ id: 'abcdefghijk', title: 'V' }, { id: 'court' }]), 1);
});

test('relations : un événement a plusieurs tâches et notes ; supprimer l\'événement délie', () => {
  const s = seed();
  const ev = newEvent({ id: 'e1', title: 'TP' }); s.events.push(ev);
  s.todos.push(newTodo({ name: 'A', eventId: 'e1' }), newTodo({ name: 'B', eventId: 'e1' }), newTodo({ name: 'C' }));
  s.notes.push(newNote({ title: 'N', eventId: 'e1' }));
  assert.equal(s.todos.filter((t) => t.eventId === 'e1').length, 2);
  removeEvent(s, 'e1');
  assert.equal(s.events.length, 0);
  assert.ok(s.todos.every((t) => t.eventId === '')); assert.equal(s.notes[0].eventId, '');
  assert.equal(sanitizeState({ todos: [{ name: 'x', eventId: 'e9' }] }).todos[0].eventId, 'e9');
});

test('une tâche devient un événement à sa date limite', () => {
  const e = eventFromTodo(newTodo({ name: 'Rapport', deadline: '2026-10-30' }), 'cal-personnel');
  assert.equal(e.title, 'Rapport'); assert.equal(e.date, '2026-10-30'); assert.equal(e.allDay, true); assert.equal(e.calendarId, 'cal-personnel');
});

test('focus : nettoyage des sessions, tags et session en cours', () => {
  const s = sanitizeState({
    sessions: [{ start: '2026-10-19T08:00:00Z', planned: 0, actual: 999, status: 'x' }, { start: 'nope' }],
    focusTags: [{ name: '', color: 'zzz' }], focusRun: { start: 5, planned: -2, hiddenAt: 'x' },
  });
  assert.equal(s.sessions.length, 1); assert.equal(s.sessions[0].planned, 1); assert.equal(s.sessions[0].actual, 600); assert.equal(s.sessions[0].status, 'done');
  assert.equal(s.focusTags[0].name, 'Tag'); assert.equal(s.focusTags[0].color, 'blue');
  assert.equal(s.focusRun.hiddenAt, null); assert.equal(s.focusRun.lastSeen, 5); assert.equal(s.focusRun.planned, 1);
  assert.equal(sanitizeState({}).focusRun, null);
  assert.ok(sanitizeState({ focusTags: [] }).focusTags.length >= 5);
});
