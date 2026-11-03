// Agrégats pour les rapports : statuts, avancement par cours, tâches terminées par semaine, retards, charge de travail (logique pure).
import { isDone, children } from './tasks-logic.js';
import { addDays, parseYMD, ymd } from './calendar-logic.js';

const toMin = (t) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
const top = (todos) => todos.filter((t) => !t.parentId);
export const isLate = (t, today) => !isDone(t) && Boolean(t.deadline) && t.deadline < today;

// Répartition des tâches de niveau 1. « En retard » est compté à part : une tâche en retard n'est ni « à faire » ni « en cours ».
export function statusCounts(todos, today) {
  const c = { fait: 0, enCours: 0, aFaire: 0, enRetard: 0 };
  for (const t of top(todos)) {
    if (isDone(t)) c.fait += 1;
    else if (isLate(t, today)) c.enRetard += 1;
    else if (t.status === 'En cours') c.enCours += 1;
    else c.aFaire += 1;
  }
  return c;
}

// Avancement par cours (tâches de niveau 1) ; les cours sans tâche sont omis ; « Sans cours » regroupe le reste.
export function byCourse(todos, courses) {
  const groups = new Map();
  for (const t of top(todos)) {
    const g = groups.get(t.courseId) ?? { courseId: t.courseId, total: 0, done: 0 };
    g.total += 1; if (isDone(t)) g.done += 1; groups.set(t.courseId, g);
  }
  return [...groups.values()].map((g) => ({ ...g, name: courses.find((c) => c.id === g.courseId)?.name ?? 'Sans cours', ratio: g.done / g.total }))
    .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));
}

const monday = (iso) => { const d = parseYMD(iso); return addDays(iso, -((d.getDay() + 6) % 7)); };

// Tâches terminées par semaine (lundi → dimanche) sur les `weeks` dernières semaines. Celles terminées sans date (avant le suivi) sont comptées à part.
export function doneByWeek(todos, today, weeks = 8) {
  const start = addDays(monday(today), -7 * (weeks - 1));
  const values = Array(weeks).fill(0); const labels = [];
  for (let i = 0; i < weeks; i += 1) { const d = addDays(start, 7 * i); labels.push(`${d.slice(8)}/${d.slice(5, 7)}`); }
  let unknown = 0;
  for (const t of top(todos)) {
    if (!isDone(t)) continue;
    if (!t.doneAt) { unknown += 1; continue; }
    const i = Math.floor((parseYMD(monday(t.doneAt)) - parseYMD(start)) / (7 * 86400000));
    if (i >= 0 && i < weeks) values[i] += 1;
  }
  return { values, labels, unknown };
}

// Tâches en retard (toutes, sous-tâches comprises), les plus anciennes d'abord.
export const overdue = (todos, today) => todos.filter((t) => isLate(t, today)).sort((a, b) => a.deadline.localeCompare(b.deadline) || a.name.localeCompare(b.name));

// Charge jour par jour à partir de `from` :
//  - planifié : plages de travail non faites des tâches non terminées + sessions Focus planifiées pas encore réalisées ;
//  - non planifié : effort estimé des tâches sans plage, posé sur leur deadline (ou sur le premier jour si elle est dépassée).
// Un parent qui a des sous-tâches ouvertes ne compte pas son propre effort (ses sous-tâches le portent).
export function load(state, from, days = 14, capacity = 240) {
  const out = Array.from({ length: days }, (_, i) => ({ date: addDays(from, i), planned: 0, unplanned: 0 }));
  const at = new Map(out.map((d) => [d.date, d]));
  const last = out[out.length - 1].date;
  const open = state.todos.filter((t) => !isDone(t));
  for (const t of open) {
    for (const s of t.slots ?? []) { const d = at.get(s.date); if (d && !s.done) d.planned += toMin(s.end) - toMin(s.start); }
    const hasSlots = (t.slots ?? []).length > 0;
    const hasOpenKids = children(state.todos, t.id).some((k) => !isDone(k));
    if (!hasSlots && !hasOpenKids && t.effort > 0 && t.deadline && t.deadline <= last) at.get(t.deadline < from ? from : t.deadline).unplanned += t.effort;
  }
  const doneRuns = new Set((state.sessions ?? []).filter((x) => x.status === 'done' && x.planId).map((x) => x.planId));
  for (const p of state.focusPlans ?? []) { const d = at.get(p.date); if (d && !doneRuns.has(p.id)) d.planned += p.minutes; }
  return out.map((d) => ({ ...d, total: d.planned + d.unplanned, over: d.planned + d.unplanned > capacity }));
}
