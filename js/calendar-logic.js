// Logique pure du calendrier : dates locales « AAAA-MM-JJ », heures « HH:mm ».
import { studyItemsOn } from './planning.js';
export const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
export const DAY_LETTERS = ['L', 'M', 'M', 'J', 'V', 'S', 'D']; // lundi d'abord (statistiques Focus)
export const DAY_SHORT = ['lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.', 'dim.'];
// Premier jour de la semaine de l'Agenda (réglage) : 1 = lundi, 0 = dimanche, 6 = samedi.
let firstDay = 1;
export const setFirstDay = (n) => { firstDay = [0, 1, 6].includes(n) ? n : 1; };
export const getFirstDay = () => firstDay;
const rot = (arr) => { const k = (firstDay + 6) % 7; return [...arr.slice(k), ...arr.slice(0, k)]; };
export const dayLetters = () => rot(DAY_LETTERS);
export const dayShort = () => rot(DAY_SHORT);

const pad = (n) => String(n).padStart(2, '0');
export const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const parseYMD = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
export const addDays = (s, n) => { const d = parseYMD(s); d.setDate(d.getDate() + n); return ymd(d); };
export const daysBetween = (a, b) => Math.round((parseYMD(b) - parseYMD(a)) / 86400000);
export const mondayOf = (s) => addDays(s, -((parseYMD(s).getDay() + 6) % 7));
export const weekStartOf = (s) => addDays(s, -((parseYMD(s).getDay() - firstDay + 7) % 7));
export const weekDays = (s) => Array.from({ length: 7 }, (_, i) => addDays(weekStartOf(s), i));
export const longDate = (s) => parseYMD(s).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
export const minutesOf = (t) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));

export function shiftMonth(s, n) {
  const d = parseYMD(s);
  const day = d.getDate();
  d.setDate(1); d.setMonth(d.getMonth() + n);
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, last));
  return ymd(d);
}

export function monthGrid(year, month) {
  const start = weekStartOf(ymd(new Date(year, month, 1)));
  const weeks = Array.from({ length: 6 }, (_, w) => Array.from({ length: 7 }, (_, i) => addDays(start, w * 7 + i)));
  while (weeks.length > 4 && weeks[weeks.length - 1].every((d) => parseYMD(d).getMonth() !== month)) weeks.pop();
  return weeks;
}

export function isoWeek(s) {
  const d = parseYMD(s);
  d.setHours(12);
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const w1 = new Date(d.getFullYear(), 0, 4);
  return 1 + Math.round(((d - w1) / 86400000 - 3 + ((w1.getDay() + 6) % 7)) / 7);
}

export function occursOn(e, date) {
  if (!e.date || date < e.date) return false;
  if (e.until && date > e.until) return false;
  switch (e.repeat) {
    case 'daily': return true;
    case 'weekly': return daysBetween(e.date, date) % 7 === 0;
    case 'monthly': return e.date.slice(8) === date.slice(8);
    case 'yearly': return e.date.slice(5) === date.slice(5);
    default: return date === e.date;
  }
}

// Longueur d'un événement en jours (0 = une seule journée).
export const spanOf = (e) => (e.endDate && e.endDate > e.date ? daysBetween(e.date, e.endDate) : 0);

// L'occurrence d'un événement qui COMMENCE ce jour-là (null s'il n'y en a pas). Tient compte des exceptions : supprimée, déplacée, modifiée.
export function occurrenceOn(e, d) {
  for (const [origin, ex] of Object.entries(e.exceptions ?? {})) {
    if (ex.date === d && origin !== d && !ex.deleted && occursOn(e, origin)) return { eff: { ...e, ...ex }, origin };
  }
  if (!occursOn(e, d)) return null;
  const ex = e.exceptions?.[d];
  if (ex?.deleted || (ex?.date && ex.date !== d)) return null;
  return { eff: ex ? { ...e, ...ex } : e, origin: d };
}

const byTime = (a, b) => (a.allDay === b.allDay ? (a.start.localeCompare(b.start) || a.title.localeCompare(b.title, 'fr')) : a.allDay ? -1 : 1);

// Tout ce qui s'affiche un jour donné : événements (agendas visibles), deadlines de to-dos, examens.
export function itemsOn(state, date, prefs = state.calPrefs ?? {}) {
  const visible = new Map(state.calendars.filter((c) => c.visible).map((c) => [c.id, c]));
  const items = [];
  for (const e of state.events) {
    const cal = visible.get(e.calendarId);
    if (!cal) continue;
    const L = spanOf(e);
    for (let k = 0; k <= L; k += 1) {
      const occ = occurrenceOn(e, addDays(date, -k));
      if (!occ) continue;
      const f = occ.eff; const last = k === L && L > 0; const first = k === 0;
      // Jour du milieu d'un événement long : « journée » ; premier jour : jusqu'à minuit ; dernier jour : depuis minuit.
      const allDay = f.allDay || (L > 0 && !first && !last);
      items.push({
        kind: 'event', id: e.id, date, title: f.title, allDay, color: cal.color, ref: e, origin: occ.origin, k, span: L,
        start: allDay ? '' : first ? f.start : '00:00', end: allDay ? '' : last ? f.end : first && L > 0 ? '23:59' : f.end,
      });
    }
  }
  if (prefs.todos !== false) {
    for (const t of state.todos) {
      if (t.deadline === date && t.status !== 'Terminés') items.push({ kind: 'todo', id: t.id, date, title: t.name || 'Sans titre', allDay: true, start: '', end: '', color: 'todo', ref: t });
    }
  }
  if (prefs.exams !== false) {
    for (const c of state.courses) {
      if (c.exam === date) items.push({ kind: 'exam', id: c.id, date, title: `Examen · ${c.name}`, allDay: true, start: '', end: '', color: 'exam', ref: c });
    }
  }
  if (prefs.todos !== false) {
    for (const t of state.todos) {
      if (!t.slots?.length) continue;
      const ev = t.eventId ? state.events.find((e) => e.id === t.eventId) : null;
      const color = state.calendars.find((c) => c.id === ev?.calendarId)?.color ?? 'blue';
      for (const sl of t.slots) if (sl.date === date) items.push({ kind: 'slot', id: `${t.id}:${sl.id}`, date, title: t.name || 'Sans titre', allDay: false, start: sl.start, end: sl.end, color, ref: t, slot: sl, eventId: t.eventId || '', done: sl.done });
    }
  }
  if (prefs.focus !== false) {
    for (const p of state.focusPlans ?? []) {
      if (p.date !== date) continue;
      const name = p.title || state.todos.find((t) => t.id === p.todoId)?.name || state.events.find((e) => e.id === p.eventId)?.title || 'Session';
      const m = Number(p.start.slice(0, 2)) * 60 + Number(p.start.slice(3)) + p.minutes; const e = Math.min(m, 24 * 60 - 1);
      items.push({ kind: 'focus', id: `focus-${p.id}`, date, title: `Focus : ${name}`, allDay: false, start: p.start, end: `${String(Math.floor(e / 60)).padStart(2, '0')}:${String(e % 60).padStart(2, '0')}`, color: 'focus', ref: p, done: p.done });
    }
  }
  if (prefs.study !== false) items.push(...studyItemsOn(state, date));
  return items.sort(byTime);
}

// Place les événements d'une journée côte à côte quand ils se chevauchent.
export function layoutDay(timed) {
  const list = timed.map((item) => ({ item, s: minutesOf(item.start), e: Math.max(minutesOf(item.end), minutesOf(item.start) + 20) }))
    .sort((a, b) => a.s - b.s || b.e - a.e);
  const out = []; let cluster = []; let clusterEnd = -1;
  const flush = () => { const cols = Math.max(1, ...cluster.map((c) => c.col + 1)); cluster.forEach((c) => out.push({ ...c, cols })); cluster = []; };
  for (const it of list) {
    if (cluster.length && it.s >= clusterEnd) { flush(); clusterEnd = -1; }
    const used = cluster.filter((c) => c.e > it.s).map((c) => c.col);
    let col = 0;
    while (used.includes(col)) col += 1;
    it.col = col; cluster.push(it); clusterEnd = Math.max(clusterEnd, it.e);
  }
  if (cluster.length) flush();
  return out;
}

// Rappels à afficher maintenant (aujourd'hui et demain pour les rappels « 1 jour avant »).
export function dueReminders(state, now, done = new Set()) {
  const visible = new Set(state.calendars.filter((c) => c.visible).map((c) => c.id));
  const out = [];
  for (const date of [ymd(now), addDays(ymd(now), 1)]) {
    for (const ev of state.events) {
      const occ = ev.reminder == null || !visible.has(ev.calendarId) ? null : occurrenceOn(ev, date);
      if (!occ) continue;
      const e = { ...occ.eff, id: ev.id };
      const start = new Date(`${date}T${e.allDay ? '08:00' : e.start}`);
      const trigger = new Date(start.getTime() - e.reminder * 60000);
      const key = `${e.id}|${date}`;
      if (now >= trigger && now < start && !done.has(key)) out.push({ key, title: e.title, date, start: e.allDay ? '' : e.start, minutes: Math.max(0, Math.round((start - now) / 60000)) });
    }
  }
  return out;
}

export function searchEvents(state, query) {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const hit = (...xs) => xs.some((x) => String(x ?? '').toLowerCase().includes(q));
  const found = [
    ...state.events.filter((e) => hit(e.title, e.location, e.description)).map((e) => ({ kind: 'event', title: e.title, date: e.date, ref: e, repeat: e.repeat })),
    ...state.todos.filter((t) => t.deadline && hit(t.name)).map((t) => ({ kind: 'todo', title: t.name, date: t.deadline, ref: t })),
  ];
  return found.sort((a, b) => a.date.localeCompare(b.date));
}

// Étiquette courte d'un élément du jour : l'heure quand il en a une, sinon sa nature (« Examen » seulement pour un examen).
export function itemLabel(item) {
  const span = item.start && item.end ? `${item.start}–${item.end}` : '';
  if (item.kind === 'todo') return 'À rendre';
  if (item.kind === 'exam') return 'Examen';
  if (item.kind === 'study') return 'Révision';
  if (item.kind === 'event') return item.allDay || !span ? 'Journée' : span;
  return span || 'Journée'; // plage de travail, session Focus planifiée
}
