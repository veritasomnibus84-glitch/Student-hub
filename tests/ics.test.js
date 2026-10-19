import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toICS, parseICS } from '../js/ics.js';
import { seed, newEvent } from '../js/store.js';

test('export puis import : mêmes champs', () => {
  const s = seed();
  s.events.push(
    newEvent({ title: 'Cours; de, physique', location: 'Amphi A', description: 'ligne1\nligne2', date: '2026-10-19', start: '08:00', end: '10:00', repeat: 'weekly', until: '2026-12-18', reminder: 15 }),
    newEvent({ title: 'Anniversaire', date: '2026-10-25', allDay: true }));
  const text = toICS(s);
  assert.match(text, /BEGIN:VCALENDAR/);
  assert.match(text, /RRULE:FREQ=WEEKLY;UNTIL=20261218/);
  assert.match(text, /DTSTART;VALUE=DATE:20261025/);
  assert.match(text, /TRIGGER:-PT15M/);
  const { events, skipped } = parseICS(text, 'cal-cours');
  assert.equal(skipped, 0);
  assert.equal(events.length, 2);
  const [a, b] = events;
  assert.equal(a.title, 'Cours; de, physique'); assert.equal(a.description, 'ligne1\nligne2'); assert.equal(a.location, 'Amphi A');
  assert.equal(a.date, '2026-10-19'); assert.equal(a.start, '08:00'); assert.equal(a.end, '10:00');
  assert.equal(a.repeat, 'weekly'); assert.equal(a.until, '2026-12-18'); assert.equal(a.reminder, 15); assert.equal(a.calendarId, 'cal-cours');
  assert.equal(b.allDay, true); assert.equal(b.date, '2026-10-25');
});

test('import d\'un fichier de type Google Agenda (UTC, lignes pliées, répétition non gérée)', () => {
  const ics = [
    'BEGIN:VCALENDAR', 'BEGIN:VEVENT', 'SUMMARY:Réunion très longue qui se ', ' continue ici', 'DTSTART:20261020T120000Z', 'DTEND:20261020T130000Z',
    'RRULE:FREQ=WEEKLY;INTERVAL=2', 'END:VEVENT',
    'BEGIN:VEVENT', 'SUMMARY:Sans date', 'END:VEVENT', 'END:VCALENDAR',
  ].join('\r\n');
  const { events, skipped } = parseICS(ics, 'cal-personnel');
  assert.equal(events.length, 1);
  assert.equal(events[0].title, 'Réunion très longue qui se continue ici');
  assert.equal(skipped, 2);
  assert.match(events[0].start, /^\d\d:\d\d$/);
});

test('import : fichier vide ou invalide ne plante pas', () => {
  for (const bad of ['', 'n\'importe quoi', 'BEGIN:VEVENT']) assert.doesNotThrow(() => parseICS(bad, 'c'));
  assert.equal(parseICS('', 'c').events.length, 0);
});
