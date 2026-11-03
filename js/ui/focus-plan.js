import { h, field, select, formatDate } from '../dom.js';
import { ymd } from '../calendar-logic.js';
import { uid } from '../store.js';
import { openSheet } from './dialog.js';
import { exclusiveLink } from '../work-logic.js';

// Planifier une session Focus : liée à UNE tâche ou UN événement (ou à aucun).
export function openFocusPlanSheet(store, init = {}) {
  const s = store.state;
  const date = h('input', { type: 'date', value: init.date ?? ymd(new Date()), required: true });
  const start = h('input', { type: 'time', value: init.start ?? '09:00', required: true });
  const minutes = h('input', { type: 'number', min: 1, max: 180, value: String(init.minutes ?? 25) });
  const title = h('input', { type: 'text', maxlength: 200, value: init.title ?? '', placeholder: 'Titre (facultatif)' });
  const kind = select([['', 'Aucun lien'], ['todo', 'Une tâche'], ['event', 'Un événement']], init.todoId ? 'todo' : init.eventId ? 'event' : '');
  const todoSel = select(s.todos.filter((t) => t.status !== 'Terminés').map((t) => [t.id, t.name || 'Sans titre']), init.todoId ?? '');
  const eventSel = select([...s.events].sort((a, b) => a.date.localeCompare(b.date)).slice(-80).map((e) => [e.id, `${e.title} · ${formatDate(e.date)}`]), init.eventId ?? '');
  const tagSel = select(s.focusTags.map((t) => [t.id, t.name]), init.tagId ?? s.focusTags[0].id);
  const todoField = field('Tâche', todoSel); const eventField = field('Événement', eventSel);
  const sync = () => { todoField.hidden = kind.value !== 'todo'; eventField.hidden = kind.value !== 'event'; };
  kind.addEventListener('change', sync); sync();
  openSheet('Planifier une session Focus', h('div', { class: 'stack' },
    field('Jour', date), h('div', { class: 'row' }, field('Début', start), field('Durée (min)', minutes)),
    field('Lier à', kind), todoField, eventField, field('Titre', title), field('Tag', tagSel)), {
    submitLabel: 'Planifier',
    onSubmit: () => {
      const m = Math.round(Number(minutes.value));
      if (!date.value || !start.value) return 'Choisis le jour et l\'heure.';
      if (!(m >= 1 && m <= 180)) return 'La durée va de 1 à 180 minutes.';
      const link = exclusiveLink(kind.value === 'todo' ? todoSel.value : '', kind.value === 'event' ? eventSel.value : '');
      if (kind.value && !link.todoId && !link.eventId) return 'Choisis l\'élément à lier, ou « Aucun lien ».';
      store.commit((st) => { st.focusPlans.push({ id: uid(), date: date.value, start: start.value, minutes: m, ...link, title: title.value.trim(), tagId: tagSel.value, done: false }); });
      return '';
    },
  });
}
