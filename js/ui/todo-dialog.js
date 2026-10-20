import { h, field, select, formatDate, safeUrl } from '../dom.js';
import { STATUSES, TYPES } from '../constants.js';
import { newTodo, eventFromTodo } from '../store.js';
import { openSheet } from './dialog.js';

export function openTodoDialog(store, todo, defaults = {}) {
  const isNew = !todo;
  const t = todo ?? newTodo(defaults);
  const courses = [['', '— Aucun —'], ...store.state.courses.map((c) => [c.id, c.name])];
  const name = h('input', { type: 'text', value: t.name, required: true, maxlength: 300 });
  const course = select(courses, t.courseId);
  const deadline = h('input', { type: 'date', value: t.deadline });
  const file = h('input', { type: 'url', value: t.file, placeholder: 'https://…' });
  const status = select(STATUSES, t.status);
  const type = select(TYPES, t.type);
  const label = (e) => `${e.title} · ${formatDate(e.date)}`;
  const eventSel = select([['', '— Aucun —'], ...store.state.events.map((e) => [e.id, label(e)])], t.eventId ?? '');
  let pending = null;
  const note = h('p', { class: 'muted', role: 'status' });
  const plan = h('button', {
    type: 'button', class: 'btn', disabled: Boolean(t.eventId),
    onclick: () => {
      if (!deadline.value) { note.textContent = 'Choisis d\'abord une deadline : l\'événement aura lieu ce jour-là.'; return; }
      pending = eventFromTodo({ name: name.value.trim() || t.name, deadline: deadline.value }, store.state.calendars[0].id);
      eventSel.append(h('option', { value: pending.id }, label(pending)));
      eventSel.value = pending.id; plan.disabled = true;
      note.textContent = 'Un événement sera créé dans l\'agenda à l\'enregistrement.';
    },
  }, 'Planifier dans l\'agenda');
  eventSel.addEventListener('change', () => { plan.disabled = eventSel.value !== ''; });

  const del = isNew ? null : h('button', {
    type: 'button', class: 'btn btn--danger',
    onclick: () => {
      if (!confirm('Supprimer ce to-do ?')) return;
      store.commit((s) => { s.todos = s.todos.filter((x) => x.id !== t.id); });
      document.querySelector('dialog.sheet')?.close();
    },
  }, 'Supprimer');

  openSheet(isNew ? 'Nouveau to-do' : 'Modifier le to-do', h('div', { class: 'stack' },
    field('Nom', name), field('Cours', course), field('Deadline', deadline),
    field('Fichier (lien)', file), field('Statut', status), field('Type', type),
    field('Événement lié', eventSel), plan, note), {
    extra: del,
    onSubmit: () => {
      if (!name.value.trim()) return 'Le nom est obligatoire.';
      if (file.value && !safeUrl(file.value)) return 'Le lien doit commencer par http:// ou https://';
      store.commit((s) => {
        if (pending && eventSel.value === pending.id) s.events.push(pending);
        const next = {
          ...t, name: name.value.trim(), courseId: course.value, deadline: deadline.value,
          file: file.value.trim(), status: status.value, type: type.value, eventId: eventSel.value,
        };
        if (isNew) s.todos.push(next);
        else Object.assign(s.todos.find((x) => x.id === t.id) ?? {}, next);
      });
      return '';
    },
  });
}
