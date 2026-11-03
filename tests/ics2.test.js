import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setupDOM, memory } from './helpers/dom.js';
setupDOM();
const { toICS, parseICS } = await import('../js/ics.js');
const { newEvent, createStore } = await import('../js/store.js');
const { itemsOn } = await import('../js/calendar-logic.js');

const ev = (p) => newEvent({ id: 'e1', calendarId: 'c', title: 'Stage', date: '2026-11-09', start: '09:00', end: '12:00', ...p });
const unfold = (t) => t.replace(/\r\n /g, '').split('\r\n');

test('export : événement sur plusieurs jours (heures précises ou journées entières)', () => {
  const timed = unfold(toICS({ events: [ev({ endDate: '2026-11-11' })] }));
  assert.ok(timed.includes('DTSTART:20261109T090000') && timed.includes('DTEND:20261111T120000'));
  const allDay = unfold(toICS({ events: [ev({ allDay: true, endDate: '2026-11-11' })] }));
  assert.ok(allDay.includes('DTSTART;VALUE=DATE:20261109') && allDay.includes('DTEND;VALUE=DATE:20261112')); // DTEND exclusif
  assert.ok(unfold(toICS({ events: [ev({ allDay: true })] })).includes('DTEND;VALUE=DATE:20261110'));
});

test('export : occurrence supprimée = EXDATE ; modifiée ou déplacée = VEVENT avec RECURRENCE-ID', () => {
  const lines = unfold(toICS({ events: [ev({ repeat: 'weekly', until: '2026-12-31', exceptions: { '2026-11-16': { deleted: true }, '2026-11-23': { date: '2026-11-24', title: 'Déplacé', start: '14:00', end: '15:00' } } })] }));
  assert.ok(lines.includes('EXDATE:20261116T090000'));
  assert.ok(lines.includes('RECURRENCE-ID:20261123T090000'));
  assert.equal(lines.filter((l) => l === 'BEGIN:VEVENT').length, 2);
  const i = lines.indexOf('RECURRENCE-ID:20261123T090000'); const part = lines.slice(i, i + 6);
  assert.ok(part.includes('SUMMARY:Déplacé') && part.includes('DTSTART:20261124T140000') && part.includes('DTEND:20261124T150000'));
  assert.equal(lines.filter((l) => l.startsWith('UID:')).every((l) => l === 'UID:e1@studenthub'), true);
});

test('aller-retour : événements longs, séries et exceptions retrouvés à l\'identique', () => {
  const src = [ev({ id: 'a', endDate: '2026-11-11' }), ev({ id: 'b', title: 'Cours', repeat: 'weekly', until: '2026-12-31', exceptions: { '2026-11-16': { deleted: true }, '2026-11-23': { date: '2026-11-24', title: 'Déplacé', start: '14:00', end: '15:00' } } }), ev({ id: 'c', allDay: true, date: '2026-12-01', endDate: '2026-12-03', title: 'Voyage' })];
  const back = parseICS(toICS({ events: src }), 'cal').events;
  assert.equal(back.length, 3);
  const [a, b, c] = back;
  assert.deepEqual([a.date, a.endDate, a.start, a.end], ['2026-11-09', '2026-11-11', '09:00', '12:00']);
  assert.deepEqual([c.allDay, c.date, c.endDate], [true, '2026-12-01', '2026-12-03']);
  assert.deepEqual(b.exceptions['2026-11-16'], { deleted: true });
  assert.deepEqual(b.exceptions['2026-11-23'], { date: '2026-11-24', title: 'Déplacé', location: '', description: '', start: '14:00', end: '15:00' });
  // même rendu dans l'Agenda
  const st = { calendars: [{ id: 'cal', visible: true, color: 'blue' }], events: back, todos: [], courses: [], decks: [], cards: [], calPrefs: {} };
  const titles = (d) => itemsOn(st, d).filter((i) => i.kind === 'event' && i.title !== 'Stage' && i.title !== 'Voyage').map((i) => `${i.title}@${i.start}`);
  assert.deepEqual(titles('2026-11-16'), []); assert.deepEqual(titles('2026-11-23'), []); assert.deepEqual(titles('2026-11-24'), ['Déplacé@14:00']); assert.deepEqual(titles('2026-11-09'), ['Cours@09:00']);
  const store = createStore(memory()); store.importFile(JSON.stringify({ app: 'student-hub', kind: 'section', section: 'calendar', version: 1, data: { events: back.map((e) => ({ ...e, calendarId: store.state.calendars[0].id })) } }));
  assert.equal(store.state.events.find((e) => e.title === 'Cours').exceptions['2026-11-16'].deleted, true);
});

test('import d\'un fichier d\'ailleurs : plusieurs EXDATE, DTEND à minuit, override sans série', () => {
  const ics = ['BEGIN:VCALENDAR', 'VERSION:2.0',
    'BEGIN:VEVENT', 'UID:x1', 'SUMMARY:Séminaire', 'DTSTART:20261109T090000', 'DTEND:20261112T000000', 'END:VEVENT',
    'BEGIN:VEVENT', 'UID:x2', 'SUMMARY:TD', 'DTSTART:20261110T080000', 'DTEND:20261110T100000', 'RRULE:FREQ=WEEKLY;UNTIL=20261231', 'EXDATE:20261117T080000,20261124T080000', 'EXDATE:20261201T080000', 'END:VEVENT',
    'BEGIN:VEVENT', 'UID:x2', 'RECURRENCE-ID:20261208T080000', 'SUMMARY:TD (salle B)', 'LOCATION:B12', 'DTSTART:20261208T130000', 'DTEND:20261208T150000', 'END:VEVENT',
    'BEGIN:VEVENT', 'UID:orph', 'RECURRENCE-ID:20261208T080000', 'SUMMARY:Orphelin', 'DTSTART:20261208T130000', 'DTEND:20261208T150000', 'END:VEVENT',
    'END:VCALENDAR'].join('\r\n');
  const { events } = parseICS(ics, 'cal');
  const sem = events.find((e) => e.title === 'Séminaire'); assert.deepEqual([sem.date, sem.endDate, sem.end], ['2026-11-09', '2026-11-11', '23:59']); // minuit = fin de la veille
  const td = events.find((e) => e.title === 'TD');
  assert.deepEqual(Object.keys(td.exceptions).sort(), ['2026-11-17', '2026-11-24', '2026-12-01', '2026-12-08']);
  assert.equal(td.exceptions['2026-12-08'].location, 'B12'); assert.equal(td.exceptions['2026-12-08'].title, 'TD (salle B)');
  assert.ok(events.some((e) => e.title === 'Orphelin')); // un override sans série devient un événement
});

test('import : un événement simple d\'un jour reste d\'un jour (DTEND de journée entière exclusif)', () => {
  const { events } = parseICS(['BEGIN:VCALENDAR', 'BEGIN:VEVENT', 'SUMMARY:Férié', 'DTSTART;VALUE=DATE:20261111', 'DTEND;VALUE=DATE:20261112', 'END:VEVENT', 'END:VCALENDAR'].join('\r\n'), 'c');
  assert.equal(events[0].endDate, ''); assert.equal(events[0].allDay, true);
});
