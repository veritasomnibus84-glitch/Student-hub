import { h, field, select, formatDate } from '../dom.js';
import { ymd } from '../calendar-logic.js';
import { uid } from '../store.js';
import { openSheet } from './dialog.js';
import { firstDay, lastDay, planSlots, mergeSlots, checkRanges, MAX_RANGES } from '../work-logic.js';

// Planifier le travail d'une tâche liée à un événement : jusqu'à un jour précis, ou jusqu'à la fin de l'événement ;
// une ou plusieurs plages horaires par jour d'activité de l'événement.
export function openSlotPlanner(store, todo) {
  const ev = store.state.events.find((e) => e.id === todo.eventId);
  if (!ev) {
    openSheet('Planifier mon travail', h('p', null, 'Cette tâche n\'est liée à aucun événement. Lie-la d\'abord à un événement dans sa fiche (champ « Événement lié »).'), { submitLabel: 'OK', onSubmit: () => '' });
    return;
  }
  const today = ymd(new Date());
  const last = lastDay(ev);
  const mode = select([['date', 'Un jour précis de l\'événement'], ['end', 'La fin de l\'événement']], last ? 'end' : 'date');
  const until = h('input', { type: 'date', value: last || ev.date, min: firstDay(ev), max: last || null });
  const from = h('input', { type: 'date', value: today > firstDay(ev) ? today : firstDay(ev), min: firstDay(ev) });
  let times = [{ start: '09:00', end: '10:00' }];
  const rows = h('div', { class: 'stack' }); const hint = h('p', { class: 'muted', role: 'status' }); const listBox = h('div', { class: 'stack' });
  const target = () => (mode.value === 'end' ? last : until.value);
  const preview = () => {
    try { const r = planSlots({ ev, from: from.value, to: target() || from.value, times, newId: () => 'x' }); hint.textContent = `${r.slots.length} plage${r.slots.length > 1 ? 's' : ''} sur ${r.days} jour${r.days > 1 ? 's' : ''}.`; } catch (e) { hint.textContent = e.message; }
  };
  const draw = () => {
    rows.replaceChildren(...times.map((t, i) => h('div', { class: 'row wrap' },
      h('input', { type: 'time', value: t.start, 'aria-label': `Début de la plage ${i + 1}`, onchange: (e) => { t.start = e.target.value; preview(); } }),
      h('input', { type: 'time', value: t.end, 'aria-label': `Fin de la plage ${i + 1}`, onchange: (e) => { t.end = e.target.value; preview(); } }),
      times.length > 1 && h('button', { type: 'button', class: 'btn btn--ghost', 'aria-label': `Retirer la plage ${i + 1}`, onclick: () => { times.splice(i, 1); draw(); preview(); } }, '✕'))));
    preview();
  };
  const drawList = () => {
    const mine = (store.state.todos.find((t) => t.id === todo.id)?.slots ?? []);
    listBox.replaceChildren(h('strong', null, `Plages déjà planifiées : ${mine.length}`),
      ...mine.slice(0, 40).map((s) => h('div', { class: 'row between' },
        h('label', { class: 'row' }, h('input', { type: 'checkbox', checked: s.done, onchange: (e) => store.commit(() => { s.done = e.target.checked; }) }), `${formatDate(s.date)} · ${s.start}–${s.end}`),
        h('button', { type: 'button', class: 'btn btn--ghost btn--danger', 'aria-label': `Supprimer la plage du ${formatDate(s.date)} ${s.start}`, onclick: () => { store.commit(() => { const t = store.state.todos.find((x) => x.id === todo.id); t.slots = t.slots.filter((x) => x.id !== s.id); }); drawList(); } }, '✕'))));
  };
  [mode, until, from].forEach((el) => el.addEventListener('change', preview));
  draw(); drawList();
  const eventName = `${ev.title} (${formatDate(ev.date)}${ev.endDate && ev.endDate > ev.date ? ` → ${formatDate(ev.endDate)}` : ''}${ev.repeat !== 'none' ? `, répété jusqu'au ${ev.until ? formatDate(ev.until) : 'sans fin'}` : ''})`;
  openSheet(`Planifier mon travail · ${todo.name || 'Sans titre'}`, h('div', { class: 'stack' },
    h('p', null, `Événement : ${eventName}`),
    field('Se termine', mode), field('Jour précis (si choisi)', until), field('À partir du', from),
    h('div', { class: 'stack' }, h('strong', null, 'Plages horaires, chaque jour de l\'événement'), rows,
      h('button', { type: 'button', class: 'btn', onclick: () => { if (times.length < MAX_RANGES) { times.push({ start: '14:00', end: '15:00' }); draw(); } } }, '+ Ajouter une plage')),
    hint, listBox), {
    submitLabel: 'Planifier',
    onSubmit: () => {
      const to = target();
      if (!from.value) return 'Choisis le jour de départ.';
      if (!to) return 'Cette série n\'a pas de date de fin : choisis un jour précis.';
      if (to < from.value) return 'Le dernier jour doit être après le premier.';
      let res;
      try { res = planSlots({ ev, from: from.value, to, times, newId: uid }); } catch (e) { return e.message; }
      store.commit(() => { const t = store.state.todos.find((x) => x.id === todo.id); t.slots = mergeSlots(t.slots ?? [], res.slots); });
      return '';
    },
  });
}
export { checkRanges };
