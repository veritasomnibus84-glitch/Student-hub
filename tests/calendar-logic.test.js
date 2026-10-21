import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ymd, addDays, mondayOf, weekDays, monthGrid, isoWeek, shiftMonth, occursOn, itemsOn, layoutDay, dueReminders, searchEvents, daysBetween,
} from '../js/calendar-logic.js';
import { searchAll } from '../js/search.js';
import { seed, newEvent, newTodo, newNote, newBook, newLink, sanitizeState, removeCalendar, createStore } from '../js/store.js';

const ev = (p) => newEvent({ title: 'E', ...p });

test('dates : lundi, semaine ISO, mois', () => {
  assert.equal(mondayOf('2026-10-18'), '2026-10-12');
  assert.deepEqual(weekDays('2026-10-18').slice(0, 2), ['2026-10-12', '2026-10-13']);
  assert.equal(isoWeek('2026-10-18'), 42);
  assert.equal(isoWeek('2026-01-01'), 1);
  assert.equal(addDays('2026-10-31', 1), '2026-11-01');
  assert.equal(daysBetween('2026-10-01', '2026-10-18'), 17);
  assert.equal(shiftMonth('2026-01-31', 1), '2026-02-28');
  assert.equal(shiftMonth('2026-01-15', -1), '2025-12-15');
  const g = monthGrid(2026, 9);
  assert.equal(g[0][0], '2026-09-28');
  assert.equal(g.length, 5);
  assert.ok(g.every((w) => w.length === 7));
});

test('récurrence : jamais, jour, semaine, mois, an, jusqu\'au', () => {
  const base = '2026-10-12';
  assert.ok(occursOn(ev({ date: base }), base));
  assert.ok(!occursOn(ev({ date: base }), '2026-10-13'));
  assert.ok(!occursOn(ev({ date: base, repeat: 'daily' }), '2026-10-11'));
  assert.ok(occursOn(ev({ date: base, repeat: 'daily' }), '2026-12-25'));
  assert.ok(occursOn(ev({ date: base, repeat: 'weekly' }), '2026-10-26'));
  assert.ok(!occursOn(ev({ date: base, repeat: 'weekly' }), '2026-10-27'));
  assert.ok(occursOn(ev({ date: base, repeat: 'monthly' }), '2027-03-12'));
  assert.ok(occursOn(ev({ date: base, repeat: 'yearly' }), '2028-10-12'));
  assert.ok(!occursOn(ev({ date: base, repeat: 'weekly', until: '2026-10-20' }), '2026-10-26'));
  assert.ok(occursOn(ev({ date: base, repeat: 'weekly', until: '2026-10-26' }), '2026-10-26'));
});

test('itemsOn : événements, deadlines, examens, agendas masqués, tri', () => {
  const s = seed();
  s.events.push(ev({ title: 'Cours physique', date: '2026-10-19', start: '08:00', end: '10:00', calendarId: 'cal-cours', repeat: 'weekly' }),
    ev({ title: 'Anniv', date: '2026-10-19', allDay: true }));
  s.todos.push(newTodo({ name: 'Devoir', deadline: '2026-10-19' }), newTodo({ name: 'Fini', deadline: '2026-10-19', status: 'Terminés' }));
  s.courses[0].exam = '2026-10-19';
  let items = itemsOn(s, '2026-10-19');
  assert.deepEqual(items.map((i) => i.kind), ['event', 'todo', 'exam', 'event']);
  assert.equal(items[3].title, 'Cours physique');
  s.calendars.find((c) => c.id === 'cal-cours').visible = false;
  assert.equal(itemsOn(s, '2026-10-19').length, 3);
  assert.equal(itemsOn(s, '2026-10-19', { todos: false, exams: false }).length, 1);
  assert.equal(itemsOn(s, '2026-10-26').length, 0);
});

test('layoutDay : chevauchements côte à côte', () => {
  const t = (title, start, end) => ({ title, start, end });
  const out = layoutDay([t('a', '09:00', '11:00'), t('b', '10:00', '12:00'), t('c', '13:00', '14:00')]);
  const by = Object.fromEntries(out.map((o) => [o.item.title, o]));
  assert.equal(by.a.cols, 2); assert.equal(by.b.cols, 2);
  assert.notEqual(by.a.col, by.b.col);
  assert.equal(by.c.cols, 1); assert.equal(by.c.col, 0);
});

test('dueReminders : fenêtre de rappel, pas de doublon', () => {
  const s = seed();
  s.events.push(ev({ id: 'x1', title: 'Cours', date: '2026-10-19', start: '08:00', end: '09:00', reminder: 15 }));
  const done = new Set();
  assert.equal(dueReminders(s, new Date('2026-10-19T07:30:00'), done).length, 0);
  const r = dueReminders(s, new Date('2026-10-19T07:50:00'), done);
  assert.equal(r.length, 1); assert.equal(r[0].minutes, 10);
  done.add(r[0].key);
  assert.equal(dueReminders(s, new Date('2026-10-19T07:55:00'), done).length, 0);
  assert.equal(dueReminders(s, new Date('2026-10-19T08:05:00'), new Set()).length, 0);
});

test('recherche d\'événements et recherche globale', () => {
  const s = seed();
  s.events.push(ev({ title: 'Examen de chimie', date: '2026-11-02', location: 'Amphi B' }));
  s.todos.push(newTodo({ name: 'Rapport chimie', deadline: '2026-10-25' }));
  s.notes.push(newNote({ title: 'Idées', body: 'revoir la chimie organique' }));
  s.library.push(newBook({ title: 'Chimie générale', tags: ['L1'] }));
  s.links.push(newLink({ title: 'Portail', url: 'https://x.org', description: 'notes de chimie' }));
  assert.deepEqual(searchEvents(s, 'CHIMIE').map((r) => r.date), ['2026-10-25', '2026-11-02']);
  assert.equal(searchEvents(s, '').length, 0);
  const all = searchAll(s, 'chimie');
  assert.deepEqual([...new Set(all.map((r) => r.kind))].sort(), ['Cours', 'Événement', 'Lien', 'Livre', 'Note', 'To-do'].sort());
  assert.equal(searchAll(s, 'c').length, 0);
});

test('agendas : valeurs par défaut, nettoyage, suppression', () => {
  const s = sanitizeState({ events: [{ date: '2026-10-19', title: 5, start: '25:00', end: '08:00', repeat: 'x', reminder: 7, calendarId: 'nope' }, { date: 'bad' }] });
  assert.deepEqual(s.calendars.map((c) => c.id), ['cal-personnel', 'cal-cours']);
  assert.equal(s.events.length, 1);
  assert.equal(s.events[0].calendarId, 'cal-personnel');
  assert.equal(s.events[0].start, '09:00'); assert.equal(s.events[0].repeat, 'none'); assert.equal(s.events[0].reminder, null);
  assert.ok(s.events[0].end >= s.events[0].start);
  const st = seed();
  st.events.push(ev({ date: '2026-10-19', calendarId: 'cal-cours' }));
  assert.equal(removeCalendar(st, 'cal-cours'), true);
  assert.equal(st.events.length, 0);
  assert.equal(removeCalendar(st, 'cal-personnel'), false);
  const store = createStore({ getItem: () => null, setItem() {} });
  assert.equal(store.state.calPrefs.todos, true);
});
