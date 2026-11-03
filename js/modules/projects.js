// Vue « Projets » de Workspace : liste, création, page d'un projet (progression, ordre conseillé, to-dos filtrés).
import { h, field, select, empty, formatDate, debounce } from '../dom.js';
import { CAL_COLORS } from '../constants.js';
import { newProject, removeProject } from '../store.js';
import { projectTodos, rollup, isDone } from '../tasks-logic.js';
import { topoOrder, blockers, indexById } from '../deps-logic.js';
import { attachMenu, menuButton, copyItem, deleteItem } from '../ui/context-menu.js';
import { openSheet } from '../ui/dialog.js';
import { goalsLinkedTo, goalProgress } from '../goals-logic.js';
import { ymd } from '../calendar-logic.js';

// Avancement d'un projet : moyenne des tâches de niveau 1, et compte « terminées / total » (niveau 1).
export function projectStats(project, todos) {
  const mine = projectTodos(todos, project.id);
  const top = mine.filter((t) => !t.parentId);
  return { ratio: rollup(mine, todos), done: top.filter(isDone).length, total: top.length };
}

function newProjectSheet(ctx, ui) {
  const { store } = ctx;
  const name = h('input', { type: 'text', required: true, maxlength: 300, placeholder: 'Ex. Dossier d\'informatique' });
  const course = select([['', '— Aucun cours —'], ...store.state.courses.map((c) => [c.id, c.name])], '');
  const deadline = h('input', { type: 'date' });
  const color = select(CAL_COLORS, 'blue');
  openSheet('Nouveau projet', h('div', { class: 'stack' }, field('Nom', name), field('Cours', course), field('Échéance', deadline), field('Couleur', color)), {
    onSubmit: () => {
      if (!name.value.trim()) return 'Le nom est obligatoire.';
      const p = newProject({ name: name.value.trim(), courseId: course.value, deadline: deadline.value, color: color.value });
      store.commit((s) => s.projects.push(p), { silent: true });
      ui.projectId = p.id; ctx.rerender();
      return '';
    },
  });
}

function projectRow(ctx, ui, p, helpers) {
  const { store } = ctx; const st = projectStats(p, store.state.todos);
  const course = store.state.courses.find((c) => c.id === p.courseId);
  const open = () => { ui.projectId = p.id; ctx.rerender(); };
  const items = () => [
    { label: 'Ouvrir', onSelect: open },
    { label: p.archived ? 'Désarchiver' : 'Archiver', onSelect: () => store.commit(() => { p.archived = !p.archived; }) },
    copyItem(p.name),
    deleteItem(`le projet « ${p.name} » (ses to-dos sont conservés)`, () => store.commit((s) => removeProject(s, p.id))),
  ];
  return attachMenu(h('li', { class: 'row' },
    h('button', { class: 'course', onclick: open },
      h('span', { class: 'course__name' }, h('span', { class: `dot c--${p.color}` }), ' ', p.name),
      h('span', { class: 'course__meta' }, course?.name ?? '', p.deadline && helpers.deadlineBadge(p.deadline)),
      h('progress', { max: 1, value: st.ratio, 'aria-label': `Avancement de « ${p.name} »` }),
      h('span', { class: 'muted' }, st.total ? `${st.done}/${st.total} tâches terminées` : 'Aucune tâche')),
    menuButton(items, `Actions pour ${p.name}`)), items);
}

function projectList(ctx, ui, helpers) {
  const { projects } = ctx.store.state;
  const active = projects.filter((p) => !p.archived); const archived = projects.filter((p) => p.archived);
  return h('div', { class: 'stack' },
    h('div', { class: 'row between' }, h('h2', null, 'Mes projets'), h('button', { class: 'btn btn--primary', onclick: () => newProjectSheet(ctx, ui) }, '+ Nouveau projet')),
    active.length ? h('ul', { class: 'courses' }, active.map((p) => projectRow(ctx, ui, p, helpers)))
      : empty('Aucun projet.', 'Un projet regroupe des to-dos pour un travail précis (un dossier, la révision d\'un partiel).'),
    archived.length > 0 && h('details', { class: 'block' }, h('summary', null, `Archivés (${archived.length})`),
      h('ul', { class: 'courses' }, archived.map((p) => projectRow(ctx, ui, p, helpers)))));
}

function projectPage(ctx, ui, p, helpers) {
  const { store } = ctx; const { todos, courses } = store.state;
  const save = debounce(() => store.commit(() => {}, { silent: true }));
  const prop = (label, control) => h('div', { class: 'prop' }, h('span', { class: 'prop__label' }, label), control);
  const st = projectStats(p, todos);
  const open = projectTodos(todos, p.id).filter((t) => !isDone(t));
  const byId = indexById(todos);
  const order = topoOrder(open);
  const linkedGoals = goalsLinkedTo(store.state.goals, 'project', p.id);
  return h('div', { class: 'page' },
    h('div', { class: 'row between' },
      h('button', { class: 'btn btn--ghost', onclick: () => { ui.projectId = null; ctx.rerender(); } }, '← Projets'),
      h('button', {
        class: 'btn btn--danger', onclick: () => {
          if (!confirm(`Supprimer le projet « ${p.name} » ? Ses to-dos seront conservés sans projet.`)) return;
          store.commit((s) => removeProject(s, p.id)); ui.projectId = null; ctx.rerender();
        },
      }, 'Supprimer le projet')),
    h('h1', null, h('input', {
      class: 'page-title page-title--input', type: 'text', value: p.name, maxlength: 300, 'aria-label': 'Nom du projet',
      oninput: (e) => { p.name = e.target.value.trim() || 'Projet'; save(); },
    })),
    h('section', { class: 'props' },
      prop('Cours', select([['', '— Aucun —'], ...courses.map((c) => [c.id, c.name])], p.courseId, { 'aria-label': 'Cours du projet', onchange: (e) => { p.courseId = e.target.value; store.commit(() => {}); } })),
      prop('Échéance', h('span', { class: 'row' }, h('input', { type: 'date', value: p.deadline, 'aria-label': 'Échéance du projet', onchange: (e) => { p.deadline = e.target.value; store.commit(() => {}); } }), p.deadline && helpers.deadlineBadge(p.deadline))),
      prop('Couleur', select(CAL_COLORS, p.color, { 'aria-label': 'Couleur du projet', onchange: (e) => { p.color = e.target.value; store.commit(() => {}); } })),
      prop('Archivé', h('input', { type: 'checkbox', checked: p.archived, 'aria-label': 'Projet archivé', onchange: (e) => { p.archived = e.target.checked; store.commit(() => {}); } }))),
    h('section', { class: 'block stack' }, h('h2', null, 'Avancement'),
      h('progress', { max: 1, value: st.ratio, 'aria-label': `Avancement de « ${p.name} »` }),
      h('p', { class: 'muted' }, st.total ? `${st.done} tâche${st.done > 1 ? 's' : ''} terminée${st.done > 1 ? 's' : ''} sur ${st.total} · ${Math.round(st.ratio * 100)} %` : 'Ajoute des to-dos pour suivre l\'avancement.')),
    linkedGoals.length > 0 && h('section', { class: 'block stack' }, h('h2', null, 'Objectifs liés'),
      h('ul', { class: 'plain' }, linkedGoals.map((g) => {
        const gp = goalProgress(g, store.state, ymd(new Date()));
        return h('li', { class: 'row between' }, h('button', { class: 'linkish', onclick: () => { location.hash = '#goals'; } }, g.title),
          h('span', { class: 'muted' }, `${Math.round((g.done ? 1 : gp.work) * 100)} %${gp.status ? ` · ${gp.status}` : ''}`));
      }))),
    open.length > 1 && order.some((t) => (t.blockedBy ?? []).length) && h('section', { class: 'block' }, h('h2', null, 'Ordre conseillé'),
      h('ol', { class: 'order' }, order.map((t) => {
        const waiting = blockers(t, byId).filter((b) => b.projectId === p.id);
        return h('li', null, t.name || 'Sans titre', t.deadline && h('span', { class: 'muted' }, ` · ${formatDate(t.deadline)}`), waiting.length > 0 && h('span', { class: 'muted' }, ` · après ${waiting.map((b) => b.name || 'Sans titre').join(', ')}`));
      }))),
    h('section', { class: 'block' }, h('h2', null, 'Mes to-dos'), helpers.todoSection(ctx, { courseId: '', projectId: p.id, defaults: { courseId: p.courseId } })));
}

// `helpers` vient de workspace.js (todoSection, deadlineBadge) : évite un import circulaire.
export function projectsView(ctx, ui, helpers) {
  const p = ctx.store.state.projects.find((x) => x.id === ui.projectId);
  if (!p) ui.projectId = null;
  return p ? projectPage(ctx, ui, p, helpers) : projectList(ctx, ui, helpers);
}
