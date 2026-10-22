// Widgets : les blocs de Home, réutilisables en bas de chaque onglet.
import { h, empty, formatDate, select, field } from '../dom.js';
import { ymd, parseYMD, addDays, MONTHS, DAY_LETTERS, monthGrid, shiftMonth, itemsOn, longDate } from '../calendar-logic.js';
import { recents } from '../library-logic.js';
import { slicesOf, slicesIn, total, formatMinutes } from '../focus-logic.js';
import * as MEM from '../revision-logic.js';
import { buildPlan, todayTasks, describeTask } from '../planning.js';
import { progress } from '../goals-logic.js';
import { WIDGETS, WIDGET_BY_ID, HIDE_ON, TARGETS, widgetsFor } from '../settings-logic.js';
import { openTodoDialog } from './todo-dialog.js';
import { openSheet } from './dialog.js';
import { openCalendarAt } from '../modules/calendar.js';

const mini = { date: ymd(new Date()) };
const when = (item) => (item.kind === 'event' && !item.allDay ? `${item.start}–${item.end}` : item.kind === 'todo' ? 'À rendre' : item.kind === 'exam' ? 'Examen' : 'Journée');
const go = (tab, text, cls = 'btn') => h('button', { class: cls, onclick: () => { location.hash = `#${tab}`; } }, text);

const RENDER = {
  today: ({ store }) => {
    const items = itemsOn(store.state, ymd(new Date()));
    return items.length ? h('ul', { class: 'plain' }, items.map((i) => h('li', { class: 'row between' }, h('span', null, i.title), h('span', { class: 'muted' }, when(i))))) : h('p', { class: 'muted' }, 'Rien de prévu.');
  },
  soon: ({ store }) => {
    const today = ymd(new Date()); const soon = [];
    for (let i = 1; i <= 7; i += 1) itemsOn(store.state, addDays(today, i)).forEach((it) => soon.push(it));
    return soon.length ? h('ul', { class: 'plain' }, soon.slice(0, 6).map((i) => h('li', { class: 'row between' }, h('span', null, i.title), h('span', { class: 'muted' }, formatDate(i.date))))) : h('p', { class: 'muted' }, 'Rien dans la semaine.');
  },
  minical: (ctx) => {
    const s = ctx.store.state; const today = ymd(new Date()); const md = parseYMD(mini.date);
    return h('div', { class: 'stack' },
      h('div', { class: 'row between' },
        h('button', { class: 'btn btn--ghost', 'aria-label': 'Mois précédent', onclick: () => { mini.date = shiftMonth(mini.date, -1); ctx.rerender(); } }, '‹'),
        h('strong', null, `${MONTHS[md.getMonth()]} ${md.getFullYear()}`),
        h('button', { class: 'btn btn--ghost', 'aria-label': 'Mois suivant', onclick: () => { mini.date = shiftMonth(mini.date, 1); ctx.rerender(); } }, '›')),
      h('div', { class: 'yr__grid yr__grid--lg' }, DAY_LETTERS.map((l) => h('span', { class: 'muted' }, l)),
        monthGrid(md.getFullYear(), md.getMonth()).flat().map((d) => {
          const inM = parseYMD(d).getMonth() === md.getMonth(); const has = inM && itemsOn(s, d).length > 0;
          return h('button', {
            class: `yr__d ${inM ? '' : 'is-out'} ${d === today ? 'is-today' : ''} ${has ? 'has' : ''}`.replace(/\s+/g, ' ').trim(),
            'aria-label': longDate(d), onclick: () => { openCalendarAt(d); location.hash = '#calendar'; },
          }, Number(d.slice(8)));
        })));
  },
  tasks: ({ store }) => {
    const tasks = store.state.todos.filter((t) => t.status !== 'Terminés').sort((a, b) => (a.deadline || '9999').localeCompare(b.deadline || '9999')).slice(0, 6);
    return tasks.length ? h('ul', { class: 'plain' }, tasks.map((t) => h('li', { class: 'row between' },
      h('span', { class: 'row' },
        h('button', { class: 'btn btn--ghost', 'aria-label': `Terminer « ${t.name} »`, onclick: () => store.commit(() => { t.status = 'Terminés'; }) }, '✓'),
        h('button', { class: 'linkish', onclick: () => openTodoDialog(store, t) }, t.name || 'Sans titre')),
      t.deadline && h('span', { class: 'muted' }, formatDate(t.deadline))))) : h('p', { class: 'muted' }, 'Aucune tâche en cours.');
  },
  recent: ({ store }) => {
    const s = store.state;
    const recent = [
      ...recents(s.library, 4).map((b) => ({ title: b.title, kind: 'Livre', time: b.opened, tab: 'library' })),
      ...[...s.notes].filter((n) => n.updated).sort((a, b) => b.updated.localeCompare(a.updated)).slice(0, 4).map((n) => ({ title: n.title || 'Sans titre', kind: 'Note', time: n.updated, tab: 'notes' })),
    ].sort((a, b) => b.time.localeCompare(a.time)).slice(0, 6);
    return recent.length ? h('ul', { class: 'plain' }, recent.map((r) => h('li', { class: 'row between' }, h('button', { class: 'linkish', onclick: () => { location.hash = `#${r.tab}`; } }, r.title), h('span', { class: 'chip' }, r.kind)))) : empty('Rien de récent.');
  },
  focus: ({ store }) => {
    const s = store.state; const today = ymd(new Date());
    const mins = total(slicesIn(slicesOf(s.sessions), [today, today]));
    const trees = s.sessions.filter((x) => x.status === 'done' && ymd(new Date(x.start)) === today).length;
    return h('div', { class: 'stack' }, h('p', null, `Aujourd'hui : ${formatMinutes(mins)} · ${trees} arbre${trees > 1 ? 's' : ''} planté${trees > 1 ? 's' : ''}`), go('focus', s.focusRun ? 'Session en cours' : 'Lancer une session'));
  },
  memory: ({ store }) => {
    const s = store.state; const today = ymd(new Date());
    const due = MEM.stats(s.cards).due; const run = MEM.streak(s.revDays, today);
    const lines = s.decks.filter((d) => d.exam).sort((a, b) => a.exam.localeCompare(b.exam)).map((d) => {
      const plan = buildPlan({ cards: s.cards.filter((c) => c.deckId === d.id), exam: d.exam, target: d.target, today, maxMin: d.maxMin });
      return plan && `${d.name} (J-${plan.D}) : ${todayTasks(plan, today).map(describeTask).join(', ') || 'rien de prévu'}`;
    }).filter(Boolean).slice(0, 3);
    return h('div', { class: 'stack' }, h('p', null, `${due} carte${due > 1 ? 's' : ''} à réviser · série : ${run} jour${run > 1 ? 's' : ''}`),
      lines.length > 0 && h('ul', { class: 'plain' }, lines.map((l) => h('li', { class: 'muted' }, l))), go('revision', due ? 'Réviser maintenant' : 'Ouvrir'));
  },
  messages: (ctx) => {
    const read = ctx.store.state.read;
    const unread = (Array.isArray(ctx.data?.summaries) ? ctx.data.summaries : []).filter((m) => !read.includes(String(m.id))).length;
    return h('button', { class: 'linkish', onclick: () => { location.hash = '#messages'; } }, unread ? `${unread} non lu${unread > 1 ? 's' : ''}` : 'Aucun message non lu');
  },
  goal: ({ store }) => {
    const today = ymd(new Date());
    const g = store.state.goals.filter((x) => !x.done).sort((a, b) => a.due.localeCompare(b.due))[0];
    if (!g) return h('div', { class: 'stack' }, h('p', { class: 'muted' }, 'Aucun objectif en cours.'), go('goals', 'Établir un objectif'));
    const p = progress(g, today);
    return h('div', { class: 'stack' }, h('strong', null, g.title), h('progress', { max: 1, value: p.ratio, 'aria-label': `Temps écoulé pour « ${g.title} »` }),
      h('span', { class: 'muted' }, p.daysLeft < 0 ? `Échéance dépassée de ${-p.daysLeft} j` : `${p.daysLeft} j restants · échéance ${formatDate(g.due)}`));
  },
  tip: ({ store }) => {
    const tips = store.state.tips;
    if (!tips.length) return h('p', { class: 'muted' }, 'Aucun conseil.');
    const t = tips[Math.floor(Date.now() / 86400000) % tips.length];
    return h('div', { class: 'stack' }, h('strong', null, t.title), h('p', { class: 'muted' }, (t.body.split('\n')[0] ?? '').slice(0, 160)), go('goals', 'Lire les conseils', 'btn btn--ghost'));
  },
};

export const widgetBody = (ctx, id) => RENDER[id](ctx);

// Les blocs de Home.
export function homeGrid(ctx) {
  return h('div', { class: 'home__grid' }, widgetsFor(ctx.store.state.settings, 'home').map((id) => h('section', { class: 'block stack', 'data-widget': id }, h('h2', null, WIDGET_BY_ID[id].title), widgetBody(ctx, id))));
}

// Barre repliable en bas de chaque onglet (sauf Home).
export function widgetBar(ctx, tab) {
  const ids = widgetsFor(ctx.store.state.settings, tab);
  return h('section', { class: 'widgets stack', 'aria-label': 'Widgets' },
    h('div', { class: 'row between' }, h('h2', null, 'Widgets'), h('button', { class: 'btn btn--ghost', onclick: () => customizeSheet(ctx, tab) }, 'Personnaliser')),
    ids.map((id) => h('details', { class: 'widget', open: true, 'data-widget': id }, h('summary', null, WIDGET_BY_ID[id].title), widgetBody(ctx, id))));
}

// Choix des widgets et de leur ordre (cases à cocher et flèches : pas de glisser-déposer, trop fragile au doigt).
export function customizeSheet(ctx, target = 'home') {
  const settings = ctx.store.state.settings; let tgt = target; let order = []; let on = new Set();
  const load = () => { const cur = settings.widgets[tgt] ?? []; on = new Set(cur); order = [...cur, ...WIDGETS.map((w) => w.id).filter((id) => !cur.includes(id))]; };
  const list = h('ul', { class: 'plain' });
  const swap = (i, j) => { [order[i], order[j]] = [order[j], order[i]]; draw(); };
  function draw() {
    list.replaceChildren(...order.map((id, i) => {
      const own = HIDE_ON[id] === tgt;
      return h('li', { class: 'row between' },
        h('label', { class: 'row' }, h('input', { type: 'checkbox', checked: on.has(id) && !own, disabled: own ? true : null, onchange: (e) => { if (e.target.checked) on.add(id); else on.delete(id); } }), WIDGET_BY_ID[id].title, own && h('span', { class: 'muted' }, ' (déjà dans cet onglet)')),
        h('span', { class: 'row' },
          h('button', { type: 'button', class: 'btn btn--ghost', 'aria-label': `Monter ${WIDGET_BY_ID[id].title}`, disabled: i === 0 ? true : null, onclick: () => swap(i, i - 1) }, '↑'),
          h('button', { type: 'button', class: 'btn btn--ghost', 'aria-label': `Descendre ${WIDGET_BY_ID[id].title}`, disabled: i === order.length - 1 ? true : null, onclick: () => swap(i, i + 1) }, '↓')));
    }));
  }
  load(); draw();
  const sel = select(TARGETS, tgt, { onchange: (e) => { tgt = e.target.value; load(); draw(); } });
  openSheet('Personnaliser les widgets', h('div', { class: 'sheet__body stack' }, field('Afficher en bas de', sel), list), {
    onSubmit: () => { ctx.store.commit((st) => { st.settings.widgets[tgt] = order.filter((id) => on.has(id) && HIDE_ON[id] !== tgt); }); },
  });
}
