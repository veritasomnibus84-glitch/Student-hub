import { h, field, select, formatDate, safeUrl } from '../dom.js';
import { STATUSES, TYPES } from '../constants.js';
import { newTodo, eventFromTodo } from '../store.js';
import { openSheet } from './dialog.js';
import { openSlotPlanner } from './slot-planner.js';
import { parentChoices, canNest, children, isDone, DONE, MAX_EFFORT } from '../tasks-logic.js';
import { checkBlock } from '../deps-logic.js';
import { todayISO } from '../kanban.js';
import { changeStatus, deleteTodo } from './todo-actions.js';

export function openTodoDialog(store, todo, defaults = {}) {
  const isNew = !todo;
  const t = todo ?? newTodo(defaults);
  const courses = [['', '— Aucun —'], ...store.state.courses.map((c) => [c.id, c.name])];
  const name = h('input', { type: 'text', value: t.name, required: true, maxlength: 300 });
  const course = select(courses, t.courseId);
  const projectSel = select([['', '— Aucun —'], ...store.state.projects.filter((p) => !p.archived || p.id === t.projectId).map((p) => [p.id, p.name])], t.projectId ?? '');
  const deadline = h('input', { type: 'date', value: t.deadline });
  const file = h('input', { type: 'url', value: t.file, placeholder: 'https://…' });
  const status = select(STATUSES, t.status);
  const type = select(TYPES, t.type);
  // Sous-tâche de : un seul niveau ; une tâche qui a déjà des sous-tâches ne peut pas devenir une sous-tâche.
  const hasKids = !isNew && children(store.state.todos, t.id).length > 0;
  const parentSel = select([['', '— Aucune (tâche à part entière) —'], ...parentChoices(store.state.todos, t.id).map((p) => [p.id, p.name || 'Sans titre'])], t.parentId ?? '', { disabled: hasKids ? true : null });
  parentSel.addEventListener('change', () => {
    const p = store.state.todos.find((x) => x.id === parentSel.value);
    if (p && !course.value) course.value = p.courseId;
    if (p && !projectSel.value && p.projectId) projectSel.value = p.projectId;
  });
  const effort = h('input', { type: 'number', min: 0, max: MAX_EFFORT, step: 5, value: String(t.effort ?? 0), inputmode: 'numeric' });
  // Bloquée par : cases à cocher ; un choix qui créerait une boucle est grisé avec la raison.
  const picked = new Set(t.blockedBy ?? []);
  const candidates = store.state.todos.filter((x) => x.id !== t.id && (!isDone(x) || picked.has(x.id)));
  const depLabel = () => (picked.size ? `Bloquée par (${picked.size})` : 'Bloquée par (aucune)');
  const depSummary = h('summary', null, depLabel());
  const depBox = h('details', { class: 'deps', open: picked.size > 0 ? true : null }, depSummary,
    candidates.length ? h('ul', { class: 'plain deps__list' }, candidates.map((x) => {
      const why = isNew ? '' : checkBlock(store.state.todos, t.id, x.id);
      const box = h('input', {
        type: 'checkbox', checked: picked.has(x.id), disabled: why && !picked.has(x.id) ? true : null, title: why || null,
        onchange: (e) => { if (e.target.checked) picked.add(x.id); else picked.delete(x.id); depSummary.textContent = depLabel(); },
      });
      return h('li', null, h('label', { class: 'check' }, box, x.name || 'Sans titre', x.deadline && ` · ${formatDate(x.deadline)}`, why && !picked.has(x.id) && ` (${why})`));
    })) : h('p', { class: 'muted' }, 'Aucune autre tâche à attendre.'));
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
  // Plages de travail : seulement pour une tâche déjà enregistrée et liée à un événement.
  const work = h('button', {
    type: 'button', class: 'btn', disabled: isNew || !t.eventId ? true : null, title: 'Disponible quand la tâche est enregistrée et liée à un événement',
    onclick: () => { document.querySelector('dialog.sheet')?.close(); openSlotPlanner(store, t); },
  }, 'Planifier mon travail…');

  const del = isNew ? null : h('button', {
    type: 'button', class: 'btn btn--danger',
    onclick: () => {
      if (!deleteTodo(store, t, { confirmed: false })) return;
      document.querySelector('dialog.sheet')?.close();
    },
  }, 'Supprimer');

  openSheet(isNew ? 'Nouveau to-do' : 'Modifier le to-do', h('div', { class: 'stack' },
    field('Nom', name), field('Cours', course), field('Projet', projectSel), field('Deadline', deadline),
    field('Fichier (lien)', file), field('Statut', status), field('Type', type),
    field('Sous-tâche de', parentSel), hasKids && h('p', { class: 'muted' }, 'Cette tâche a des sous-tâches : elle ne peut pas devenir une sous-tâche.'),
    field('Effort estimé (minutes)', effort), depBox,
    field('Événement lié', eventSel), plan, work, note), {
    extra: del,
    onSubmit: () => {
      if (!name.value.trim()) return 'Le nom est obligatoire.';
      if (file.value && !safeUrl(file.value)) return 'Le lien doit commencer par http:// ou https://';
      const minutes = Math.max(0, Math.min(MAX_EFFORT, Math.round(Number(effort.value) || 0)));
      const parentId = parentSel.disabled ? (t.parentId ?? '') : parentSel.value;
      if (!canNest(store.state.todos, t.id, parentId)) return 'Une sous-tâche ne peut pas avoir de sous-tâches.';
      if (parentId && picked.has(parentId)) return 'Une tâche et sa sous-tâche ne se bloquent pas entre elles.';
      const blockedBy = [...picked];
      const wanted = status.value; const before = t.status;
      store.commit((s) => {
        if (pending && eventSel.value === pending.id) s.events.push(pending);
        const next = {
          ...t, name: name.value.trim(), courseId: course.value, deadline: deadline.value,
          file: file.value.trim(), type: type.value, eventId: eventSel.value, parentId, blockedBy, effort: minutes, projectId: projectSel.value,
        };
        if (isNew) { next.status = wanted; next.doneAt = wanted === DONE ? todayISO() : ''; s.todos.push(next); }
        else Object.assign(s.todos.find((x) => x.id === t.id) ?? {}, next);
      });
      // Le statut passe par la règle commune (date de fin, sous-tâches, parent).
      if (!isNew && wanted !== before) changeStatus(store, t, wanted);
      return '';
    },
  });
}
