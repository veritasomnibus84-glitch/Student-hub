import { h, field, select, empty, debounce, formatDate } from '../dom.js';
import { newNote, moveNote } from '../store.js';

const view = { place: 'all' };

export function render(ctx) {
  const { store } = ctx;
  const { notes, courses } = store.state;
  const visible = notes.filter((n) => view.place === 'all' || (view.place === '' ? n.courseId === '' : n.courseId === view.place));
  const ordered = [...visible.filter((n) => n.pinned), ...visible.filter((n) => !n.pinned)];
  const ids = ordered.map((n) => n.id);
  const places = [['', 'Général'], ...courses.map((c) => [c.id, c.name])];

  return h('div', { class: 'page' },
    h('h1', { class: 'page-title' }, 'Notes'),
    h('div', { class: 'toolbar' },
      select([['all', 'Toutes les notes'], ...places], view.place, {
        'aria-label': 'Afficher les notes de', onchange: (e) => { view.place = e.target.value; ctx.rerender(); },
      }),
      h('button', {
        class: 'btn btn--primary',
        onclick: () => store.commit((s) => s.notes.unshift(newNote({ courseId: view.place === 'all' ? '' : view.place }))),
      }, '+ Note')),
    ordered.length
      ? h('ul', { class: 'notes' }, ordered.map((n) => noteItem(ctx, n, places, ids)))
      : empty('Aucune note ici.', 'Crée un morceau de note et range-le dans un cours ou dans Général.'));
}

function noteItem(ctx, n, places, ids) {
  const { store } = ctx;
  const save = debounce(() => store.commit(() => { n.updated = new Date().toISOString(); }, { silent: true }));
  return h('li', { class: `note ${n.pinned ? 'note--pinned' : ''}`.trim() },
    h('input', {
      class: 'note__title', type: 'text', value: n.title, placeholder: 'Titre', maxlength: 300, 'aria-label': 'Titre de la note',
      oninput: (e) => { n.title = e.target.value; save(); },
    }),
    h('textarea', {
      class: 'note__body', rows: 4, value: n.body, placeholder: 'Écris ici…', maxlength: 50000, 'aria-label': 'Contenu de la note',
      oninput: (e) => { n.body = e.target.value; save(); },
    }),
    h('div', { class: 'row wrap' },
      field('Placée dans', select(places, n.courseId, { onchange: (e) => store.commit(() => { n.courseId = e.target.value; }) }), 'field--inline'),
      field('Événement', select([['', '— Aucun —'], ...store.state.events.map((ev) => [ev.id, `${ev.title} · ${formatDate(ev.date)}`])], n.eventId, { onchange: (e) => store.commit(() => { n.eventId = e.target.value; }) }), 'field--inline'),
      h('span', { class: 'spacer' }),
      h('button', { class: 'btn btn--ghost', 'aria-pressed': String(n.pinned), onclick: () => store.commit(() => { n.pinned = !n.pinned; }) }, n.pinned ? 'Désépingler' : 'Épingler'),
      h('button', { class: 'btn btn--ghost', 'aria-label': 'Monter la note', onclick: () => store.commit((s) => moveNote(s.notes, n.id, -1, ids)) }, '↑'),
      h('button', { class: 'btn btn--ghost', 'aria-label': 'Descendre la note', onclick: () => store.commit((s) => moveNote(s.notes, n.id, 1, ids)) }, '↓'),
      h('button', {
        class: 'btn btn--danger', onclick: () => {
          if (confirm('Supprimer cette note ?')) store.commit((s) => { s.notes = s.notes.filter((x) => x.id !== n.id); });
        },
      }, 'Supprimer')));
}
