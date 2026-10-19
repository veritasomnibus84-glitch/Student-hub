import { h, empty, formatDate, safeUrl } from '../dom.js';
import { newNote } from '../store.js';
import { ymd, parseYMD, addDays, MONTHS, DAY_LETTERS, monthGrid, shiftMonth, itemsOn, longDate } from '../calendar-logic.js';
import { searchAll } from '../search.js';
import { recents } from '../library-logic.js';
import { openTodoDialog } from '../ui/todo-dialog.js';
import { openEventDialog, openCalendarAt } from './calendar.js';
import { showCourse } from './workspace.js';

const mini = { date: ymd(new Date()) };
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

function when(item) { return item.kind === 'event' && !item.allDay ? `${item.start}–${item.end}` : item.kind === 'todo' ? 'À rendre' : item.kind === 'exam' ? 'Examen' : 'Journée'; }

export function render(ctx) {
  const { store } = ctx; const s = store.state; const today = ymd(new Date());
  const unread = (Array.isArray(ctx.data?.summaries) ? ctx.data.summaries : []).filter((m) => !s.read.includes(String(m.id))).length;

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

  const todayItems = itemsOn(s, today);
  const soon = [];
  for (let i = 1; i <= 7; i += 1) { const d = addDays(today, i); itemsOn(s, d).forEach((it) => soon.push(it)); }

  const md = parseYMD(mini.date);
  const miniCal = h('section', { class: 'block' },
    h('div', { class: 'row between' },
      h('button', { class: 'btn btn--ghost', 'aria-label': 'Mois précédent', onclick: () => { mini.date = shiftMonth(mini.date, -1); ctx.rerender(); } }, '‹'),
      h('h2', null, `${MONTHS[md.getMonth()]} ${md.getFullYear()}`),
      h('button', { class: 'btn btn--ghost', 'aria-label': 'Mois suivant', onclick: () => { mini.date = shiftMonth(mini.date, 1); ctx.rerender(); } }, '›')),
    h('div', { class: 'yr__grid yr__grid--lg' }, DAY_LETTERS.map((l) => h('span', { class: 'muted' }, l)),
      monthGrid(md.getFullYear(), md.getMonth()).flat().map((d) => {
        const inM = parseYMD(d).getMonth() === md.getMonth();
        const has = inM && itemsOn(s, d).length > 0;
        return h('button', {
          class: `yr__d ${inM ? '' : 'is-out'} ${d === today ? 'is-today' : ''} ${has ? 'has' : ''}`.replace(/\s+/g, ' ').trim(),
          'aria-label': longDate(d), onclick: () => { openCalendarAt(d); location.hash = '#calendar'; },
        }, Number(d.slice(8)));
      })));

  const tasks = s.todos.filter((t) => t.status !== 'Terminés').sort((a, b) => (a.deadline || '9999').localeCompare(b.deadline || '9999')).slice(0, 6);
  const recent = [
    ...recents(s.library, 4).map((b) => ({ title: b.title, kind: 'Livre', time: b.opened, tab: 'library' })),
    ...[...s.notes].filter((n) => n.updated).sort((a, b) => b.updated.localeCompare(a.updated)).slice(0, 4).map((n) => ({ title: n.title || 'Sans titre', kind: 'Note', time: n.updated, tab: 'notes' })),
  ].sort((a, b) => b.time.localeCompare(a.time)).slice(0, 6);

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
    h('div', { class: 'home__grid' },
      h('section', { class: 'block' }, h('h2', null, 'Aujourd\'hui'),
        todayItems.length ? h('ul', { class: 'plain' }, todayItems.map((i) => h('li', { class: 'row between' }, h('span', null, i.title), h('span', { class: 'muted' }, when(i))))) : h('p', { class: 'muted' }, 'Rien de prévu.')),
      h('section', { class: 'block' }, h('h2', null, 'À venir (7 jours)'),
        soon.length ? h('ul', { class: 'plain' }, soon.slice(0, 6).map((i) => h('li', { class: 'row between' }, h('span', null, i.title), h('span', { class: 'muted' }, formatDate(i.date))))) : h('p', { class: 'muted' }, 'Rien dans la semaine.')),
      miniCal,
      h('section', { class: 'block' }, h('h2', null, 'Tâches'),
        tasks.length ? h('ul', { class: 'plain' }, tasks.map((t) => h('li', { class: 'row between' },
          h('span', { class: 'row' },
            h('button', { class: 'btn btn--ghost', 'aria-label': `Terminer « ${t.name} »`, onclick: () => store.commit(() => { t.status = 'Terminés'; }) }, '✓'),
            h('button', { class: 'linkish', onclick: () => openTodoDialog(store, t) }, t.name || 'Sans titre')),
          t.deadline && h('span', { class: 'muted' }, formatDate(t.deadline))))) : h('p', { class: 'muted' }, 'Aucune tâche en cours.')),
      h('section', { class: 'block' }, h('h2', null, 'Récents'),
        recent.length ? h('ul', { class: 'plain' }, recent.map((r) => h('li', { class: 'row between' },
          h('button', { class: 'linkish', onclick: () => { location.hash = `#${r.tab}`; } }, r.title), h('span', { class: 'chip' }, r.kind)))) : empty('Rien de récent.')),
      h('section', { class: 'block' }, h('h2', null, 'Messages'),
        h('button', { class: 'linkish', onclick: () => { location.hash = '#messages'; } }, unread ? `${unread} non lu${unread > 1 ? 's' : ''}` : 'Aucun message non lu'))));
}
