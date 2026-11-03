// Rapports de Workspace et widgets Home (en retard, charge, prêtes à démarrer) : même code, deux endroits.
import { h, empty, formatDate } from '../dom.js';
import { ymd } from '../calendar-logic.js';
import { statusCounts, byCourse, doneByWeek, overdue, load } from '../reports-logic.js';
import { ready } from '../deps-logic.js';
import { barChart, donut } from './charts.js';
import { openTodoDialog } from './todo-dialog.js';

const today = () => ymd(new Date());
const hours = (min) => `${(min / 60).toFixed(min % 60 === 0 ? 0 : 1)} h`;

function todoList(store, todos, { empty: none, when = true }) {
  return todos.length ? h('ul', { class: 'plain' }, todos.map((t) => h('li', { class: 'row between' },
    h('button', { class: 'linkish', onclick: () => openTodoDialog(store, t) }, t.name || 'Sans titre'),
    when && t.deadline && h('span', { class: 'muted' }, formatDate(t.deadline))))) : h('p', { class: 'muted' }, none);
}

export const readyList = ({ store }, max = 6) => todoList(store, ready(store.state.todos).slice(0, max), { empty: 'Rien à démarrer pour l\'instant.' });

export const lateList = ({ store }, max = 6) => {
  const late = overdue(store.state.todos, today());
  return h('div', { class: 'stack' }, todoList(store, late.slice(0, max), { empty: 'Aucune tâche en retard.' }),
    late.length > max && h('p', { class: 'muted' }, `+ ${late.length - max} autre${late.length - max > 1 ? 's' : ''}`));
};

export function statusReport({ store }) {
  const c = statusCounts(store.state.todos, today());
  const total = c.fait + c.enCours + c.aFaire + c.enRetard;
  const parts = [{ value: c.fait, color: 'green', label: 'Faites' }, { value: c.enCours, color: 'amber', label: 'En cours' }, { value: c.aFaire, color: 'blue', label: 'À faire' }, { value: c.enRetard, color: 'red', label: 'En retard' }];
  if (!total) return empty('Aucune tâche pour l\'instant.');
  return h('div', { class: 'stack' }, h('div', { class: 'donutwrap' }, donut(parts, `${c.fait}/${total}`)),
    h('ul', { class: 'legend' }, parts.map((p) => h('li', null, h('span', { class: `dot c--${p.color}` }), ` ${p.label} : ${p.value}`))));
}

export function courseReport({ store }) {
  const rows = byCourse(store.state.todos, store.state.courses);
  return rows.length ? h('ul', { class: 'bars' }, rows.map((r) => h('li', { class: 'stack' },
    h('span', { class: 'row between' }, h('strong', null, r.name), h('span', { class: 'muted' }, `${r.done}/${r.total}`)),
    h('progress', { max: 1, value: r.ratio, 'aria-label': `Avancement : ${r.name}` })))) : empty('Aucune tâche pour l\'instant.');
}

export function weeklyReport({ store }) {
  const w = doneByWeek(store.state.todos, today(), 8);
  return h('div', { class: 'stack' }, barChart(w.values, w.labels, { label: 'Tâches terminées par semaine' }),
    w.unknown > 0 && h('p', { class: 'muted' }, `${w.unknown} tâche${w.unknown > 1 ? 's' : ''} terminée${w.unknown > 1 ? 's' : ''} sans date (avant le suivi) n'apparaissent pas ici.`));
}

export function loadReport({ store }, days = 14) {
  const cap = store.state.settings.work.capacityMin;
  const d = load(store.state, today(), days, cap);
  const busy = d.filter((x) => x.over);
  return h('div', { class: 'stack' },
    barChart(d.map((x) => x.planned / 60), d.map((x) => x.date.slice(8)), { label: 'Charge de travail en heures par jour', every: days > 7 ? 2 : 1, stack: d.map((x) => x.unplanned / 60), limit: cap / 60, limitLabel: `capacité ${hours(cap)}` }),
    h('p', { class: 'muted' }, 'Vert : travail planifié. Orange : effort estimé des tâches sans plage, posé sur leur deadline.'),
    busy.length
      ? h('p', { role: 'status' }, `Surcharge : ${busy.map((x) => `${formatDate(x.date)} (${hours(x.total)})`).join(', ')}.`)
      : h('p', { class: 'muted' }, d.some((x) => x.total > 0) ? `Charge sous ta capacité de ${hours(cap)} par jour.` : 'Aucun travail planifié ni estimé sur la période.'));
}

// Vue « Rapports » de Workspace.
export function reportsView(ctx) {
  const block = (title, body) => h('section', { class: 'block stack' }, h('h2', null, title), body);
  return h('div', { class: 'stack' },
    block('Statut des tâches', statusReport(ctx)), block('En retard', lateList(ctx, 10)), block('Charge des 14 prochains jours', loadReport(ctx, 14)),
    block('Avancement par cours', courseReport(ctx)), block('Tâches terminées par semaine', weeklyReport(ctx)), block('Prêtes à démarrer', readyList(ctx, 10)));
}
