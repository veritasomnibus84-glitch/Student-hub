import { h, field, select, safeUrl, formatDate, empty, debounce } from '../dom.js';
import { STATUSES, STATUS_KEY, NEXT_STATUS, TYPES, SEMESTERS, SORTS } from '../constants.js';
import { newCourse, removeCourse } from '../store.js';
import { groupByStatus, filterTodos, sortTodos, upcoming, daysUntil, todayISO } from '../kanban.js';
import { openTodoDialog } from '../ui/todo-dialog.js';
import { openSheet } from '../ui/dialog.js';

const view = { courseId: null, query: '', type: '', sort: 'deadline' };

export function render(ctx) {
  const course = ctx.store.state.courses.find((c) => c.id === view.courseId);
  if (!course) view.courseId = null;
  return course ? coursePage(ctx, course) : dashboard(ctx);
}

/* ---------- Tableau de bord ---------- */
function dashboard(ctx) {
  const { store } = ctx;
  const { courses, todos } = store.state;
  const soon = upcoming(todos);
  return h('div', { class: 'page' },
    h('h1', { class: 'page-title' }, 'Workspace'),
    h('section', { class: 'block' },
      h('h2', null, 'À venir'),
      soon.length
        ? h('ul', { class: 'plain' }, soon.map((t) => h('li', { class: 'row between' },
          h('button', { class: 'linkish', onclick: () => openTodoDialog(store, t) }, t.name || 'Sans titre'),
          deadlineBadge(t.deadline))))
        : empty('Rien d\'urgent.', 'Les to-dos avec une deadline apparaissent ici.')),
    h('section', { class: 'block' },
      h('div', { class: 'row between' }, h('h2', null, 'Mes cours'),
        h('button', { class: 'btn', onclick: () => addCourse(ctx) }, '+ Nouveau cours')),
      h('ul', { class: 'courses' }, courses.map((c) => h('li', null,
        h('button', { class: 'course', onclick: () => { view.courseId = c.id; ctx.rerender(); } },
          h('span', { class: 'course__name' }, c.name),
          h('span', { class: 'course__meta' }, [c.semester, c.prof].filter(Boolean).join(' · ')),
          c.exam && h('span', { class: 'chip' }, `Examen ${formatDate(c.exam)}`)))))),
    h('section', { class: 'block' }, h('h2', null, 'To-dos'), todoSection(ctx, { courseId: '' })));
}

function addCourse(ctx) {
  const name = h('input', { type: 'text', required: true, maxlength: 200, placeholder: 'Ex. Thermodynamique' });
  openSheet('Nouveau cours', field('Nom du cours', name), {
    onSubmit: () => {
      if (!name.value.trim()) return 'Le nom est obligatoire.';
      const c = newCourse(name.value.trim());
      ctx.store.commit((s) => s.courses.push(c), { silent: true });
      view.courseId = c.id; ctx.rerender();
      return '';
    },
  });
}

function deadlineBadge(deadline) {
  if (!deadline) return null;
  const d = daysUntil(deadline, todayISO());
  const text = d < 0 ? `En retard (${formatDate(deadline)})` : d === 0 ? 'Aujourd\'hui' : d === 1 ? 'Demain' : formatDate(deadline);
  return h('span', { class: `chip ${d < 0 ? 'chip--late' : d <= 2 ? 'chip--soon' : ''}`.trim() }, text);
}

/* ---------- Page d'un cours (structure du template Notion) ---------- */
function coursePage(ctx, c) {
  const { store } = ctx;
  const save = debounce(() => store.commit(() => {}, { silent: true }));
  const bindText = (key, props = {}) => h('input', {
    type: 'text', value: c[key], maxlength: 500, ...props,
    oninput: (e) => { c[key] = e.target.value; save(); },
  });
  const prop = (label, control) => h('div', { class: 'prop' }, h('span', { class: 'prop__label' }, label), control);
  const area = (label, key) => h('section', { class: `block block--${key}` }, h('h2', null, label),
    h('textarea', {
      rows: 5, maxlength: 50000, value: c[key], 'aria-label': label,
      oninput: (e) => { c[key] = e.target.value; save(); },
    }));
  const examInput = h('input', { type: 'date', value: c.exam, onchange: (e) => { c.exam = e.target.value; store.commit(() => {}); } });
  const travaux = store.state.todos.filter((t) => t.courseId === c.id);

  return h('div', { class: 'page' },
    h('button', { class: 'btn btn--ghost', onclick: () => { view.courseId = null; ctx.rerender(); } }, '← Workspace'),
    h('h1', null, h('input', {
      class: 'page-title page-title--input', type: 'text', value: c.name, maxlength: 200, 'aria-label': 'Nom du cours',
      oninput: (e) => { c.name = e.target.value.trim() || 'Cours'; save(); },
    })),
    h('section', { class: 'props' },
      prop('Code du cours', bindText('code', { placeholder: 'Vide' })),
      prop('Année', select(SEMESTERS, c.semester, { onchange: (e) => { c.semester = e.target.value; store.commit(() => {}); } })),
      prop('Prof', bindText('prof', { placeholder: 'Vide' })),
      prop('Travaux', travaux.length
        ? h('span', { class: 'chips' }, travaux.map((t) => h('span', { class: 'chip' }, t.name || 'Sans titre')))
        : h('span', { class: 'muted' }, 'Vide')),
      prop('Examen', h('span', { class: 'row' }, examInput, c.exam && deadlineBadge(c.exam)))),
    h('section', { class: 'props' },
      prop('Bureau', bindText('office')), prop('Horaire de cours', bindText('schedule')),
      prop('Email', bindText('email', { type: 'email' })), prop('Salle de cours', bindText('room'))),
    area('Notes', 'notes'), area('Lectures', 'readings'), area('Questions', 'questions'),
    syllabus(ctx, c),
    h('section', { class: 'block' }, h('h2', null, 'Mes to-dos'), todoSection(ctx, { courseId: c.id })),
    h('div', { class: 'row end' }, h('button', {
      class: 'btn btn--danger', onclick: () => {
        if (!confirm(`Supprimer le cours « ${c.name} » ? Ses to-dos et notes seront conservés sans cours.`)) return;
        store.commit((s) => removeCourse(s, c.id));
        view.courseId = null; ctx.rerender();
      },
    }, 'Supprimer le cours')));
}

function syllabus(ctx, c) {
  const name = h('input', { type: 'text', placeholder: 'Nom du fichier', maxlength: 200, 'aria-label': 'Nom du fichier' });
  const url = h('input', { type: 'url', placeholder: 'https://… (lien Drive, PDF…)', 'aria-label': 'Lien du fichier' });
  const err = h('p', { class: 'error', role: 'alert' });
  return h('section', { class: 'block' }, h('h2', null, 'Syllabus'),
    c.syllabus.length ? h('ul', { class: 'plain' }, c.syllabus.map((f, i) => h('li', { class: 'row between' },
      safeUrl(f.url) ? h('a', { href: safeUrl(f.url), target: '_blank', rel: 'noopener noreferrer' }, f.name || f.url) : h('span', null, f.name),
      h('button', { class: 'btn btn--ghost', 'aria-label': `Retirer ${f.name}`, onclick: () => ctx.store.commit(() => c.syllabus.splice(i, 1)) }, 'Retirer'))))
      : h('p', { class: 'muted' }, 'Aucun fichier.'),
    h('div', { class: 'row wrap' }, name, url, h('button', {
      class: 'btn', onclick: () => {
        if (!name.value.trim() || !safeUrl(url.value)) { err.textContent = 'Nom et lien http(s) requis.'; return; }
        ctx.store.commit(() => c.syllabus.push({ name: name.value.trim(), url: safeUrl(url.value) }));
      },
    }, 'Ajouter')), err);
}

/* ---------- Kanban des to-dos ---------- */
function todoSection(ctx, { courseId }) {
  const { store } = ctx;
  const host = h('div', { class: 'board-host' });
  const draw = () => host.replaceChildren(board(ctx, courseId));
  const search = h('input', {
    type: 'search', placeholder: 'Rechercher…', value: view.query, 'aria-label': 'Rechercher un to-do',
    oninput: (e) => { view.query = e.target.value; draw(); },
  });
  const type = select([['', 'Tous les types'], ...TYPES], view.type, { 'aria-label': 'Filtrer par type', onchange: (e) => { view.type = e.target.value; draw(); } });
  const sort = select(SORTS, view.sort, { 'aria-label': 'Trier par', onchange: (e) => { view.sort = e.target.value; draw(); } });
  draw();
  return h('div', null,
    h('div', { class: 'toolbar' }, search, type, sort,
      h('button', { class: 'btn btn--primary', onclick: () => openTodoDialog(store, null, { courseId }) }, '+ To-do')),
    host);
}

function board(ctx, courseId) {
  const { store } = ctx;
  const { todos, courses } = store.state;
  const shown = sortTodos(filterTodos(todos, { courseId, type: view.type, query: view.query }), view.sort, courses);
  const groups = groupByStatus(shown);
  return h('div', { class: 'board' }, STATUSES.map((status) => h('section', { class: `col col--${STATUS_KEY[status]}`, 'aria-label': status },
    h('header', { class: 'col__head' }, h('span', { class: `tag tag--${STATUS_KEY[status]}` }, status), h('span', { class: 'muted' }, groups[status].length)),
    h('ul', { class: 'cards' }, groups[status].map((t) => card(ctx, t, courses))),
    h('button', { class: 'btn btn--ghost', onclick: () => openTodoDialog(store, null, { courseId, status }) }, '+ Nouveau'))));
}

function card(ctx, t, courses) {
  const course = courses.find((c) => c.id === t.courseId);
  const next = NEXT_STATUS[t.status];
  return h('li', { class: 'card' },
    h('button', { class: 'card__main', onclick: () => openTodoDialog(ctx.store, t) },
      h('span', { class: 'card__name' }, t.name || 'Sans titre'),
      h('span', { class: 'card__meta' }, course && h('span', { class: 'chip' }, course.name), h('span', { class: 'chip' }, t.type), deadlineBadge(t.deadline))),
    next && h('button', {
      class: 'btn btn--ghost card__next', title: `Passer à « ${next} »`, 'aria-label': `Passer « ${t.name} » à ${next}`,
      onclick: () => ctx.store.commit(() => { t.status = next; }),
    }, '→'));
}
