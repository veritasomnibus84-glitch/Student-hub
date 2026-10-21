// Logique pure de l'onglet Focus : session, arbre, statistiques. Dates locales.
import { ymd, parseYMD, addDays, mondayOf, MONTHS, DAY_SHORT } from './calendar-logic.js';

export const GRACE_MS = 10000;
export const DURATIONS = [10, 25, 45, 60, 90];

export function stageOf(elapsedMs, plannedMin) {
  const f = Math.min(1, Math.max(0, elapsedMs / (plannedMin * 60000)));
  return f >= 1 ? 4 : f >= 0.66 ? 3 : f >= 0.33 ? 2 : f > 0 ? 1 : 0;
}

// Que faire de la session en cours ? 'fail' si l'utilisateur a quitté l'app plus de 10 s, 'complete' si le temps est écoulé.
export function reconcile(run, now, { hidden = false, grace = GRACE_MS } = {}) {
  if (!run) return 'none';
  if (run.hiddenAt != null && now - run.hiddenAt > grace) return 'fail';
  if (!hidden && run.hiddenAt == null && now - run.lastSeen > grace + 2000) return 'fail';
  return now >= run.start + run.planned * 60000 ? 'complete' : 'none';
}

export function buildSession(run, now, status) {
  const end = Math.min(now, run.start + run.planned * 60000);
  return {
    id: run.id, start: new Date(run.start).toISOString(), planned: run.planned,
    actual: status === 'done' ? run.planned : Math.round((Math.max(0, end - run.start) / 60000) * 10) / 10,
    status, tagId: run.tagId, title: run.title, todoId: run.todoId, eventId: run.eventId,
  };
}

export const formatClock = (ms) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
};
export const formatMinutes = (m) => {
  const r = Math.round(m);
  return r >= 60 ? `${Math.floor(r / 60)} h ${String(r % 60).padStart(2, '0')}` : `${r} min`;
};

// Une session réussie est découpée par heure locale pour les graphiques.
export function hourSlices(startISO, minutes) {
  const out = []; let t = new Date(startISO).getTime(); let left = minutes;
  while (left > 1e-6) {
    const d = new Date(t);
    const next = new Date(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours() + 1).getTime();
    const m = Math.min(left, (next - t) / 60000);
    out.push({ date: ymd(d), hour: d.getHours(), minutes: m });
    left -= m; t = next;
  }
  return out;
}

export const slicesOf = (sessions) => sessions.filter((x) => x.status === 'done')
  .flatMap((x) => hourSlices(x.start, x.actual).map((sl) => ({ ...sl, tagId: x.tagId, todoId: x.todoId, eventId: x.eventId })));

export function periodRange(view, date) {
  const d = parseYMD(date);
  if (view === 'week') return [mondayOf(date), addDays(mondayOf(date), 6)];
  if (view === 'month') return [ymd(new Date(d.getFullYear(), d.getMonth(), 1)), ymd(new Date(d.getFullYear(), d.getMonth() + 1, 0))];
  if (view === 'year') return [`${d.getFullYear()}-01-01`, `${d.getFullYear()}-12-31`];
  return [date, date];
}

export function shiftPeriod(view, date, n) {
  const d = parseYMD(date);
  if (view === 'week') return addDays(date, 7 * n);
  if (view === 'month') return ymd(new Date(d.getFullYear(), d.getMonth() + n, 1));
  if (view === 'year') return ymd(new Date(d.getFullYear() + n, 0, 1));
  return addDays(date, n);
}

export function periodLabel(view, date) {
  const d = parseYMD(date);
  if (view === 'year') return String(d.getFullYear());
  if (view === 'month') return `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
  if (view === 'week') { const [a, b] = periodRange('week', date); return `${Number(a.slice(8))} ${MONTHS[parseYMD(a).getMonth()]} – ${Number(b.slice(8))} ${MONTHS[parseYMD(b).getMonth()]}`; }
  return parseYMD(date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}

export const slicesIn = (slices, [a, b]) => slices.filter((s) => s.date >= a && s.date <= b);
export const total = (slices) => slices.reduce((n, s) => n + s.minutes, 0);

// Valeurs du graphique principal selon la période : heures, jours de la semaine, jours du mois, mois.
export function buckets(view, slices, date) {
  const inRange = slicesIn(slices, periodRange(view, date));
  if (view === 'day') {
    const values = Array(24).fill(0); inRange.forEach((s) => { values[s.hour] += s.minutes; });
    return { labels: values.map((_, h) => String(h).padStart(2, '0')), values };
  }
  if (view === 'week') {
    const values = Array(7).fill(0); inRange.forEach((s) => { values[(parseYMD(s.date).getDay() + 6) % 7] += s.minutes; });
    return { labels: DAY_SHORT.map((x) => x.replace('.', '')), values };
  }
  if (view === 'month') {
    const n = Number(periodRange('month', date)[1].slice(8));
    const values = Array(n).fill(0); inRange.forEach((s) => { values[Number(s.date.slice(8)) - 1] += s.minutes; });
    return { labels: values.map((_, i) => String(i + 1)), values };
  }
  const values = Array(12).fill(0); inRange.forEach((s) => { values[Number(s.date.slice(5, 7)) - 1] += s.minutes; });
  return { labels: MONTHS.map((m) => m.slice(0, 3)), values };
}

export function tagBreakdown(slices) {
  const by = new Map();
  slices.forEach((s) => by.set(s.tagId, (by.get(s.tagId) ?? 0) + s.minutes));
  const all = total(slices);
  return [...by].map(([tagId, minutes]) => ({ tagId, minutes, pct: all ? Math.round((minutes / all) * 100) : 0 })).sort((a, b) => b.minutes - a.minutes);
}

export const hourProfile = (slices) => { const v = Array(24).fill(0); slices.forEach((s) => { v[s.hour] += s.minutes; }); return v; };
export const weekdayProfile = (slices) => { const v = Array(7).fill(0); slices.forEach((s) => { v[(parseYMD(s.date).getDay() + 6) % 7] += s.minutes; }); return v; };
export const peakIndex = (values) => { const max = Math.max(...values); return max > 0 ? values.indexOf(max) : -1; };

export function trend(sessions, view, date) {
  const slices = slicesOf(sessions);
  const cur = total(slicesIn(slices, periodRange(view, date)));
  const prev = total(slicesIn(slices, periodRange(view, shiftPeriod(view, date, -1))));
  return { cur, prev, delta: cur - prev };
}

export function counts(sessions, [a, b]) {
  const inR = sessions.filter((x) => { const d = ymd(new Date(x.start)); return d >= a && d <= b; });
  return { done: inR.filter((x) => x.status === 'done').length, failed: inR.filter((x) => x.status === 'failed').length };
}

export function minutesBy(sessions, key, range) {
  const by = new Map();
  slicesIn(slicesOf(sessions), range).filter((s) => s[key]).forEach((s) => by.set(s[key], (by.get(s[key]) ?? 0) + s.minutes));
  return [...by].map(([id, minutes]) => ({ id, minutes })).sort((a, b) => b.minutes - a.minutes);
}
