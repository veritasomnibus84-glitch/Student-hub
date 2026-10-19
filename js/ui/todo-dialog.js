import { h, field, select } from '../dom.js';
import { STATUSES, TYPES } from '../constants.js';
import { newTodo } from '../store.js';
import { safeUrl } from '../dom.js';
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
    field('Fichier (lien)', file), field('Statut', status), field('Type', type)), {
    extra: del,
    onSubmit: () => {
      if (!name.value.trim()) return 'Le nom est obligatoire.';
      if (file.value && !safeUrl(file.value)) return 'Le lien doit commencer par http:// ou https://';
      store.commit((s) => {
        const next = {
          ...t, name: name.value.trim(), courseId: course.value, deadline: deadline.value,
          file: file.value.trim(), status: status.value, type: type.value,
        };
        if (isNew) s.todos.push(next);
        else Object.assign(s.todos.find((x) => x.id === t.id) ?? {}, next);
      });
      return '';
    },
  });
}
