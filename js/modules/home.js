import { h, safeUrl } from '../dom.js';
import { newNote } from '../store.js';
import { ymd, longDate } from '../calendar-logic.js';
import { searchAll } from '../search.js';
import { homeGrid, customizeSheet } from '../ui/widgets.js';
import { openTodoDialog } from '../ui/todo-dialog.js';
import { openEventDialog, openCalendarAt } from './calendar.js';
import { showCourse } from './workspace.js';

const nowText = () => new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
const greeting = (hr) => (hr >= 5 && hr < 12 ? 'Bonjour' : hr >= 12 && hr < 18 ? 'Bon après-midi' : 'Bonsoir');

function openResult(ctx, r) {
  if (r.kind === 'To-do') { openTodoDialog(ctx.store, r.ref); return; }
  if (r.kind === 'Lien') { const u = safeUrl(r.ref.url); if (u) window.open(u, '_blank', 'noopener'); return; }
  if (r.kind === 'Cours') showCourse(r.ref.id);
  if (r.kind === 'Événement') openCalendarAt(r.date);
  location.hash = `#${r.tab}`;
}

function dailyNote(ctx) {
  const title = `Note du ${longDate(ymd(new Date()))}`;
  if (!ctx.store.state.notes.some((n) => n.title === title)) ctx.store.commit((s) => { s.notes.unshift(newNote({ title })); }, { silent: true });
  location.hash = '#notes';
}


export function render(ctx) {
  const { store } = ctx; const today = ymd(new Date());

  const clock = h('time', { class: 'home__clock' }, nowText());
  const iv = setInterval(() => { if (!clock.isConnected) clearInterval(iv); else clock.textContent = nowText(); }, 1000);
  if (typeof iv === 'object') iv.unref?.();

  const results = h('ul', { class: 'plain', 'aria-live': 'polite' });
  const search = h('input', {
    type: 'search', placeholder: 'Rechercher dans tout Student Hub…', 'aria-label': 'Recherche globale',
    oninput: (e) => {
      const found = searchAll(store.state, e.target.value);
      results.replaceChildren(...found.map((r) => h('li', null, h('button', { class: 'result', onclick: () => openResult(ctx, r) },
        h('span', { class: 'chip' }, r.kind), h('span', { class: 'result__t' }, r.title), r.sub && h('span', { class: 'muted' }, r.sub)))));
      if (!found.length && e.target.value.trim().length >= 2) results.append(h('li', { class: 'muted' }, 'Aucun résultat.'));
    },
  });

  return h('div', { class: 'page' },
    h('header', { class: 'home__head' },
      h('div', null, h('p', { class: 'home__hello' }, greeting(new Date().getHours())), h('p', { class: 'muted' }, longDate(today))), clock),
    h('div', { class: 'stack' }, search, results),
    h('div', { class: 'row wrap' },
      h('button', { class: 'btn btn--primary', onclick: () => openTodoDialog(store, null, {}) }, '+ To-do'),
      h('button', { class: 'btn', onclick: () => openEventDialog(ctx, { date: today }) }, '+ Événement'),
      h('button', { class: 'btn', onclick: () => { store.commit((st) => { st.notes.unshift(newNote()); }, { silent: true }); location.hash = '#notes'; } }, '+ Note'),
      h('button', { class: 'btn', onclick: () => dailyNote(ctx) }, 'Note du jour')),
    h('h1', { class: 'visually-hidden' }, 'Accueil'),
    h('div', { class: 'row end' }, h('button', { class: 'btn btn--ghost', onclick: () => customizeSheet(ctx, 'home') }, 'Personnaliser les widgets')),
    homeGrid(ctx));
}
