import { STORAGE_KEY, SEMESTERS, STATUSES, TYPES, SEED_COURSES, CAL_COLORS, REPEATS } from './constants.js';

export const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);

const str = (v, max = 5000) => (typeof v === 'string' ? v.slice(0, max) : '');
const oneOf = (v, list, fallback) => (list.includes(v) ? v : fallback);
const isoDate = (v) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : '');
const num = (v, min, max) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : min);
const objs = (x) => (Array.isArray(x) ? x.filter((i) => i && typeof i === 'object') : []);

export const newCourse = (name = 'Nouveau cours') => ({
  id: uid(), name, code: '', semester: SEMESTERS[0], prof: '', exam: '', office: '', schedule: '',
  email: '', room: '', notes: '', readings: '', questions: '', syllabus: [],
});
export const newTodo = (p = {}) => ({
  id: uid(), name: '', courseId: '', deadline: '', file: '', status: 'A faire', type: 'Devoir', ...p,
});
export const newNote = (p = {}) => ({
  id: uid(), title: '', body: '', courseId: '', pinned: false, updated: new Date().toISOString(), ...p,
});
export const newLink = (p = {}) => ({ id: uid(), title: '', url: '', description: '', category: '', ...p });
export const newBook = (p = {}) => ({
  id: uid(), name: '', title: '', author: '', size: 0, pages: 0, added: new Date().toISOString(), opened: '',
  favorite: false, tags: [], folder: '', progress: 0, page: 1, bookmarks: [], fingerprint: '', ...p,
});

export const defaultCalendars = () => [
  { id: 'cal-personnel', name: 'Personnel', color: 'blue', visible: true },
  { id: 'cal-cours', name: 'Cours', color: 'red', visible: true },
];
export const newCalendar = (p = {}) => ({ id: uid(), name: 'Nouvel agenda', color: 'blue', visible: true, ...p });
export const newEvent = (p = {}) => ({
  id: uid(), calendarId: 'cal-personnel', title: '', location: '', description: '', date: '', start: '09:00', end: '10:00',
  allDay: false, repeat: 'none', until: '', reminder: null, ...p,
});

export function seed() {
  return {
    version: 1,
    courses: SEED_COURSES.map((n) => newCourse(n)),
    todos: [],
    notes: [],
    links: [],
    library: [],
    calendars: defaultCalendars(),
    events: [],
    calPrefs: { todos: true, exams: true },
    read: [],
  };
}

// Toute donnée venant du disque ou d'un import passe ici : types, longueurs, valeurs autorisées.
const hhmm = (v, fallback) => (typeof v === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(v) ? v : fallback);
const REMINDER_VALUES = [0, 5, 15, 30, 60, 1440];

function sanitizeCalendar(r) {
  const cals = objs(r.calendars).map((c) => ({
    id: str(c.id, 40) || uid(), name: str(c.name, 100) || 'Agenda', color: oneOf(c.color, CAL_COLORS.map(([k]) => k), 'blue'), visible: c.visible !== false,
  }));
  const calendars = cals.length ? cals : defaultCalendars();
  const ids = new Set(calendars.map((c) => c.id));
  const events = objs(r.events).filter((e) => isoDate(e.date)).map((e) => {
    const allDay = e.allDay === true;
    const start = hhmm(e.start, '09:00');
    const end = hhmm(e.end, '10:00');
    return {
      id: str(e.id, 40) || uid(), calendarId: ids.has(e.calendarId) ? e.calendarId : calendars[0].id, title: str(e.title, 300) || 'Sans titre',
      location: str(e.location, 300), description: str(e.description, 5000), date: isoDate(e.date), start, end: end > start ? end : start,
      allDay, repeat: oneOf(e.repeat, REPEATS.map(([k]) => k), 'none'), until: isoDate(e.until),
      reminder: REMINDER_VALUES.includes(e.reminder) ? e.reminder : null,
    };
  });
  const p = r.calPrefs && typeof r.calPrefs === 'object' ? r.calPrefs : {};
  return { calendars, events, calPrefs: { todos: p.todos !== false, exams: p.exams !== false } };
}

export function removeCalendar(state, id) {
  if (state.calendars.length <= 1) return false;
  state.calendars = state.calendars.filter((c) => c.id !== id);
  state.events = state.events.filter((e) => e.calendarId !== id);
  return true;
}

export function sanitizeState(raw) {
  const r = raw && typeof raw === 'object' ? raw : {};
  return {
    version: 1,
    courses: objs(r.courses).map((c) => ({
      id: str(c.id, 40) || uid(), name: str(c.name, 200) || 'Cours', code: str(c.code, 60),
      semester: oneOf(c.semester, SEMESTERS, SEMESTERS[0]), prof: str(c.prof, 200), exam: isoDate(c.exam),
      office: str(c.office, 200), schedule: str(c.schedule, 500), email: str(c.email, 200), room: str(c.room, 200),
      notes: str(c.notes, 50000), readings: str(c.readings, 50000), questions: str(c.questions, 50000),
      syllabus: objs(c.syllabus).map((s) => ({ name: str(s.name, 200), url: str(s.url, 2000) })),
    })),
    todos: objs(r.todos).map((t) => ({
      id: str(t.id, 40) || uid(), name: str(t.name, 300), courseId: str(t.courseId, 40), deadline: isoDate(t.deadline),
      file: str(t.file, 2000), status: oneOf(t.status, STATUSES, 'Sans statut'), type: oneOf(t.type, TYPES, 'Devoir'),
    })),
    notes: objs(r.notes).map((n) => ({
      id: str(n.id, 40) || uid(), title: str(n.title, 300), body: str(n.body, 50000), courseId: str(n.courseId, 40),
      pinned: n.pinned === true, updated: str(n.updated, 40),
    })),
    links: objs(r.links).map((l) => ({
      id: str(l.id, 40) || uid(), title: str(l.title, 300), url: str(l.url, 2000),
      description: str(l.description, 1000), category: str(l.category, 100),
    })),
    library: objs(r.library).map((b) => ({
      id: str(b.id, 40) || uid(), name: str(b.name, 300), title: str(b.title, 300) || str(b.name, 300) || 'Sans titre',
      author: str(b.author, 200), size: num(b.size, 0, 1e12), pages: Math.round(num(b.pages, 0, 100000)),
      added: str(b.added, 40), opened: str(b.opened, 40), favorite: b.favorite === true,
      tags: (Array.isArray(b.tags) ? b.tags : []).filter((t) => typeof t === 'string' && t.trim()).map((t) => t.trim().slice(0, 40)).slice(0, 30),
      folder: str(b.folder, 100), progress: Math.round(num(b.progress, 0, 100)), page: Math.max(1, Math.round(num(b.page, 1, 100000))),
      bookmarks: objs(b.bookmarks).slice(0, 500).map((m) => ({
        id: str(m.id, 40) || uid(), page: Math.max(1, Math.round(num(m.page, 1, 100000))), label: str(m.label, 200), date: str(m.date, 40),
      })),
      fingerprint: str(b.fingerprint, 400),
    })),
    ...sanitizeCalendar(r),
    read: Array.isArray(r.read) ? r.read.filter((x) => typeof x === 'string').slice(0, 5000) : [],
  };
}

export function removeCourse(state, id) {
  state.courses = state.courses.filter((c) => c.id !== id);
  state.todos.forEach((t) => { if (t.courseId === id) t.courseId = ''; });
  state.notes.forEach((n) => { if (n.courseId === id) n.courseId = ''; });
}

export function removeBook(state, id) {
  state.library = state.library.filter((b) => b.id !== id);
}

// Échange la note avec sa voisine visible (dir = -1 monte, +1 descend).
export function moveNote(notes, id, dir, visibleIds = notes.map((n) => n.id)) {
  const vi = visibleIds.indexOf(id);
  const target = visibleIds[vi + dir];
  if (vi < 0 || target === undefined) return false;
  const a = notes.findIndex((n) => n.id === id);
  const b = notes.findIndex((n) => n.id === target);
  [notes[a], notes[b]] = [notes[b], notes[a]];
  return true;
}

export function createStore(storage) {
  let state;
  const listeners = new Set();
  try {
    const raw = storage.getItem(STORAGE_KEY);
    state = raw ? sanitizeState(JSON.parse(raw)) : seed();
  } catch { state = seed(); }
  const save = () => { try { storage.setItem(STORAGE_KEY, JSON.stringify(state)); return true; } catch { return false; } };
  const notify = () => listeners.forEach((f) => f(state));
  return {
    get state() { return state; },
    commit(mutate, { silent = false } = {}) {
      mutate(state);
      const ok = save();
      if (!silent) notify();
      return ok;
    },
    subscribe(f) { listeners.add(f); return () => listeners.delete(f); },
    exportJSON() { return JSON.stringify(state, null, 2); },
    importJSON(text) { state = sanitizeState(JSON.parse(text)); save(); notify(); },
    reset() { state = seed(); save(); notify(); },
  };
}
