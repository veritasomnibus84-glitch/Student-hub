// Plages de travail d'une tâche liée à un événement + sessions Focus planifiées (logique pure).
import { addDays, daysBetween, spanOf, occurrenceOn } from './calendar-logic.js';

export const MAX_SLOTS = 200;
export const MAX_RANGES = 8;
const hhmm = (v) => /^([01]\d|2[0-3]):[0-5]\d$/.test(v ?? '');
const toMin = (t) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3));

// Premier et dernier jour d'un événement (le dernier est '' pour une série sans date de fin).
export const firstDay = (ev) => ev.date;
export function lastDay(ev) {
  if (ev.repeat === 'none') return addDays(ev.date, spanOf(ev));
  return ev.until ? addDays(ev.until, spanOf(ev)) : '';
}

// Jours où l'événement a lieu entre deux dates : une série compte chaque occurrence, un événement long chacun de ses jours.
export function activeDays(ev, from, to) {
  const out = [];
  if (to < from) return out;
  const L = spanOf(ev);
  for (let d = from; d <= to && out.length < 4000; d = addDays(d, 1)) {
    for (let k = 0; k <= L; k += 1) { if (occurrenceOn(ev, addDays(d, -k))) { out.push(d); break; } }
  }
  return out;
}

export function checkRanges(times) {
  if (!times.length) return 'Ajoute au moins une plage horaire.';
  if (times.length > MAX_RANGES) return `${MAX_RANGES} plages par jour au maximum.`;
  if (times.some((t) => !hhmm(t.start) || !hhmm(t.end) || toMin(t.end) <= toMin(t.start))) return 'Chaque plage doit finir après son début.';
  const sorted = [...times].sort((a, b) => toMin(a.start) - toMin(b.start));
  for (let i = 1; i < sorted.length; i += 1) if (toMin(sorted[i].start) < toMin(sorted[i - 1].end)) return 'Les plages d\'une même journée ne doivent pas se chevaucher.';
  return '';
}

// Génère les plages : chaque jour d'activité de l'événement entre `from` et `to`, à chaque plage horaire.
export function planSlots({ ev, from, to, times, newId }) {
  const bad = checkRanges(times); if (bad) throw new Error(bad);
  const lo = from < firstDay(ev) ? firstDay(ev) : from;
  const hi = lastDay(ev) && to > lastDay(ev) ? lastDay(ev) : to;
  const days = activeDays(ev, lo, hi);
  if (!days.length) throw new Error('L\'événement n\'a aucun jour entre ces dates.');
  const slots = days.flatMap((date) => times.map((t) => ({ id: newId(), date, start: t.start, end: t.end, done: false })));
  if (slots.length > MAX_SLOTS) throw new Error(`Ça ferait ${slots.length} plages (maximum ${MAX_SLOTS}) : réduis la période ou le nombre de plages.`);
  return { slots, days: days.length };
}

// Remplace les plages pas encore faites (les plages faites restent).
export const mergeSlots = (existing, fresh) => [...existing.filter((s) => s.done), ...fresh].sort((a, b) => a.date.localeCompare(b.date) || a.start.localeCompare(b.start)).slice(0, MAX_SLOTS);

export const slotEndsOutside = (slot, from, to) => slot.date < from || slot.date > to;

// Sessions Focus planifiées : liée à UNE tâche OU UN événement (jamais les deux).
export const exclusiveLink = (todoId, eventId) => (todoId ? { todoId, eventId: '' } : { todoId: '', eventId: eventId || '' });
export function planEnd(plan) {
  const m = toMin(plan.start) + plan.minutes; const e = Math.min(m, 24 * 60 - 1);
  return `${String(Math.floor(e / 60)).padStart(2, '0')}:${String(e % 60).padStart(2, '0')}`;
}
export { daysBetween };
