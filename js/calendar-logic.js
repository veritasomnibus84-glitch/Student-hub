// Logique pure du calendrier : dates locales « AAAA-MM-JJ », heures « HH:mm ».
export const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
export const DAY_LETTERS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
export const DAY_SHORT = ['lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.', 'dim.'];

const pad = (n) => String(n).padStart(2, '0');
export const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const parseYMD = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
export const addDays = (s, n) => { const d = parseYMD(s); d.setDate(d.getDate() + n); return ymd(d); };
export const daysBetween = (a, b) => Math.round((parseYMD(b) - parseYMD(a)) / 86400000);
export const mondayOf = (s) => addDays(s, -((parseYMD(s).getDay() + 6) % 7));
export const weekDays = (s) => Array.from({ length: 7 }, (_, i) => addDays(mondayOf(s), i));
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
  const start = mondayOf(ymd(new Date(year, month, 1)));
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

const byTime = (a, b) => (a.allDay === b.allDay ? (a.start.localeCompare(b.start) || a.title.localeCompare(b.title, 'fr')) : a.allDay ? -1 : 1);

// Tout ce qui s'affiche un jour donné : événements (agendas visibles), deadlines de to-dos, examens.
export function itemsOn(state, date, prefs = state.calPrefs ?? {}) {
  const visible = new Map(state.calendars.filter((c) => c.visible).map((c) => [c.id, c]));
  const items = [];
  for (const e of state.events) {
    const cal = visible.get(e.calendarId);
    if (cal && occursOn(e, date)) {
      items.push({ kind: 'event', id: e.id, date, title: e.title, allDay: e.allDay, start: e.allDay ? '' : e.start, end: e.allDay ? '' : e.end, color: cal.color, ref: e });
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
    for (const e of state.events) {
      if (e.reminder == null || !visible.has(e.calendarId) || !occursOn(e, date)) continue;
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
