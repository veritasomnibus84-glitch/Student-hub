import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  stageOf, reconcile, buildSession, formatClock, formatMinutes, hourSlices, slicesOf, periodRange, shiftPeriod, buckets, tagBreakdown,
  hourProfile, weekdayProfile, peakIndex, trend, counts, minutesBy, total, slicesIn,
} from '../js/focus-logic.js';

const run = (p = {}) => ({ id: 'r', start: 1_000_000, planned: 10, tagId: 't', title: '', todoId: '', eventId: '', lastSeen: 1_000_000, hiddenAt: null, ...p });
const sess = (start, actual, p = {}) => ({ id: start, start, planned: actual, actual, status: 'done', tagId: 'tag-etude', title: '', todoId: '', eventId: '', ...p });

test('arbre : 5 stades selon l\'avancement', () => {
  assert.equal(stageOf(0, 10), 0);
  assert.equal(stageOf(60000, 10), 1);
  assert.equal(stageOf(4 * 60000, 10), 2);
  assert.equal(stageOf(7 * 60000, 10), 3);
  assert.equal(stageOf(10 * 60000, 10), 4);
  assert.equal(stageOf(99 * 60000, 10), 4);
});

test('réconciliation : continue, réussit, échoue si on quitte l\'app plus de 10 s', () => {
  const r = run();
  assert.equal(reconcile(r, r.start + 5000, { hidden: false }), 'none');
  assert.equal(reconcile(null, 1), 'none');
  assert.equal(reconcile(r, r.start + 10 * 60000, { hidden: false }), 'fail', 'lastSeen trop ancien = app quittée ou rechargée tard');
  const alive = run({ lastSeen: r.start + 10 * 60000 - 500 });
  assert.equal(reconcile(alive, r.start + 10 * 60000, { hidden: false }), 'complete');
  const hid = run({ hiddenAt: r.start + 1000, lastSeen: r.start + 1000 });
  assert.equal(reconcile(hid, r.start + 1000 + 9000, { hidden: true }), 'none');
  assert.equal(reconcile(hid, r.start + 1000 + 10001, { hidden: true }), 'fail');
  assert.equal(reconcile(hid, r.start + 1000 + 10001, { hidden: false }), 'fail');
  assert.equal(reconcile(run({ lastSeen: r.start + 4000 }), r.start + 4000 + 13000, { hidden: false }), 'fail', 'page rechargée après 13 s');
});

test('buildSession : réussite = durée prévue ; échec = temps réel écoulé', () => {
  const r = run({ planned: 25, tagId: 'x', title: 'Maths' });
  const ok = buildSession(r, r.start + 25 * 60000, 'done');
  assert.equal(ok.actual, 25); assert.equal(ok.status, 'done'); assert.equal(ok.title, 'Maths');
  const ko = buildSession(r, r.start + 3 * 60000 + 30000, 'failed');
  assert.equal(ko.actual, 3.5); assert.equal(ko.status, 'failed');
  assert.equal(buildSession(r, r.start + 999 * 60000, 'failed').actual, 25);
});

test('formats', () => {
  assert.equal(formatClock(25 * 60000), '25:00'); assert.equal(formatClock(61_000), '01:01'); assert.equal(formatClock(-5), '00:00');
  assert.equal(formatMinutes(25), '25 min'); assert.equal(formatMinutes(65), '1 h 05');
});

test('découpe par heure locale', () => {
  const d = new Date(2026, 9, 19, 8, 50);
  const sl = hourSlices(d.toISOString(), 20);
  assert.deepEqual(sl.map((s) => [s.date, s.hour, Math.round(s.minutes)]), [['2026-10-19', 8, 10], ['2026-10-19', 9, 10]]);
  assert.equal(hourSlices(d.toISOString(), 0).length, 0);
});

test('périodes : bornes, décalage, étiquettes', () => {
  assert.deepEqual(periodRange('week', '2026-10-21'), ['2026-10-19', '2026-10-25']);
  assert.deepEqual(periodRange('month', '2026-02-10'), ['2026-02-01', '2026-02-28']);
  assert.deepEqual(periodRange('year', '2026-06-01'), ['2026-01-01', '2026-12-31']);
  assert.equal(shiftPeriod('month', '2026-01-15', -1), '2025-12-01');
  assert.equal(shiftPeriod('day', '2026-03-01', -1), '2026-02-28');
});

test('statistiques : seuls les arbres réussis comptent', () => {
  const s = [
    sess(new Date(2026, 9, 19, 9, 0).toISOString(), 30), sess(new Date(2026, 9, 20, 9, 0).toISOString(), 30, { tagId: 'tag-travail' }),
    sess(new Date(2026, 9, 19, 15, 0).toISOString(), 20, { status: 'failed' }),
  ];
  const sl = slicesOf(s);
  assert.equal(total(sl), 60);
  assert.equal(total(slicesIn(sl, ['2026-10-19', '2026-10-19'])), 30);
  const day = buckets('day', sl, '2026-10-19');
  assert.equal(day.values.length, 24); assert.equal(day.values[9], 30); assert.equal(day.values[15], 0);
  const week = buckets('week', sl, '2026-10-19');
  assert.deepEqual(week.values.slice(0, 3), [30, 30, 0]);
  assert.equal(buckets('month', sl, '2026-10-19').values.length, 31);
  assert.equal(buckets('year', sl, '2026-10-19').values[9], 60);
  const tags = tagBreakdown(sl);
  assert.deepEqual(tags.map((t) => t.pct), [50, 50]);
  assert.equal(peakIndex(hourProfile(sl)), 9);
  assert.equal(peakIndex(weekdayProfile(sl)), 0);
  assert.equal(peakIndex([0, 0]), -1);
  assert.deepEqual(counts(s, ['2026-10-19', '2026-10-19']), { done: 1, failed: 1 });
});

test('tendance et temps par tâche', () => {
  const s = [
    sess(new Date(2026, 9, 19, 9, 0).toISOString(), 40, { todoId: 'a' }), sess(new Date(2026, 9, 12, 9, 0).toISOString(), 25, { todoId: 'a' }),
    sess(new Date(2026, 9, 13, 9, 0).toISOString(), 10, { todoId: 'b' }),
  ];
  assert.deepEqual(trend(s, 'week', '2026-10-19'), { cur: 40, prev: 35, delta: 5 });
  assert.deepEqual(minutesBy(s, 'todoId', ['2026-10-01', '2026-10-31']), [{ id: 'a', minutes: 65 }, { id: 'b', minutes: 10 }]);
});
