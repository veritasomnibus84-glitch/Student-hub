import { STATUSES } from './constants.js';

export function groupByStatus(todos) {
  const g = Object.fromEntries(STATUSES.map((s) => [s, []]));
  for (const t of todos) (g[STATUSES.includes(t.status) ? t.status : 'Sans statut']).push(t);
  return g;
}

export function filterTodos(todos, { courseId = '', type = '', query = '' } = {}) {
  const q = query.trim().toLowerCase();
  return todos.filter((t) => (!courseId || t.courseId === courseId)
    && (!type || t.type === type) && (!q || t.name.toLowerCase().includes(q)));
}

export function sortTodos(todos, by = 'deadline', courses = []) {
  const cname = (id) => (courses.find((c) => c.id === id)?.name ?? '').toLowerCase();
  const keys = {
    name: (t) => t.name.toLowerCase(), course: (t) => cname(t.courseId), deadline: (t) => t.deadline,
    status: (t) => STATUSES.indexOf(t.status), type: (t) => t.type,
  };
  const key = keys[by] ?? keys.deadline;
  return [...todos].sort((a, b) => {
    const ka = key(a); const kb = key(b);
    if (ka === '' && kb === '') return 0;
    if (ka === '') return 1;
    if (kb === '') return -1;
    return ka < kb ? -1 : ka > kb ? 1 : 0;
  });
}

export function upcoming(todos, limit = 5) {
  return todos.filter((t) => t.status !== 'Terminés' && t.deadline)
    .sort((a, b) => a.deadline.localeCompare(b.deadline)).slice(0, limit);
}

export function todayISO(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function daysUntil(dateISO, today = todayISO()) {
  return Math.round((Date.parse(`${dateISO}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86400000);
}
