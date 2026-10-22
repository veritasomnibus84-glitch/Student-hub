import { h, field, select, empty, formatDate } from '../dom.js';
import { openSheet } from '../ui/dialog.js';
import { newGoal, dueDate, progress, UNITS } from '../goals-logic.js';
import { ymd } from '../calendar-logic.js';
import { uid } from '../store.js';
import { attachMenu, menuButton, copyItem, deleteItem } from '../ui/context-menu.js';

export function render(ctx) {
  const { goals, tips } = ctx.store.state; const today = ymd(new Date());
  const open = goals.filter((g) => !g.done); const done = goals.filter((g) => g.done);
  return h('div', { class: 'page' },
    h('h1', { class: 'page-title' }, 'Objectifs'),
    h('section', { class: 'block stack' },
      h('div', { class: 'row between' }, h('h2', null, 'Mes objectifs'),
        h('button', { class: 'btn btn--primary', onclick: () => goalSheet(ctx) }, 'Établir un objectif')),
      goals.length ? h('ul', { class: 'cards' }, [...open, ...done].map((g) => goalItem(ctx, g, today)))
        : empty('Aucun objectif.', 'Fixe-toi un cap à quelques mois ou à quelques années : une note, un concours, une compétence.')),
    h('section', { class: 'block stack' },
      h('div', { class: 'row between' }, h('h2', null, `Conseils (${tips.length})`),
        h('button', { class: 'btn', onclick: () => tipSheet(ctx) }, 'Ajouter un conseil')),
      tips.length ? h('ul', { class: 'plain tips' }, tips.map((t) => tipItem(ctx, t)))
        : empty('Aucun conseil.', 'Ajoute le tien : une règle de travail, une méthode, un rappel.')));
}

function tipItem(ctx, t) {
  const items = () => [
    { label: 'Modifier', onSelect: () => tipSheet(ctx, t) },
    { label: 'Dupliquer', onSelect: () => ctx.store.commit((s) => { s.tips.unshift({ id: uid(), title: `${t.title} (copie)`, body: t.body }); }) },
    copyItem(`${t.title}\n\n${t.body}`),
    deleteItem(`le conseil « ${t.title} »`, () => ctx.store.commit((s) => { s.tips = s.tips.filter((x) => x.id !== t.id); })),
  ];
  return attachMenu(h('li', null, h('details', { class: 'tip' },
    h('summary', null, t.title), h('p', { class: 'pre' }, t.body),
    h('div', { class: 'row end' },
      h('button', { class: 'btn btn--ghost', onclick: () => tipSheet(ctx, t) }, 'Modifier'),
      h('button', { class: 'btn btn--danger', onclick: () => { if (confirm(`Supprimer « ${t.title} » ?`)) ctx.store.commit((s) => { s.tips = s.tips.filter((x) => x.id !== t.id); }); } }, 'Supprimer'),
      menuButton(items, 'Actions du conseil')))), items);
}

function goalItem(ctx, g, today) {
  const items = () => [
    { label: g.done ? 'Rouvrir' : 'Marquer terminé', onSelect: () => ctx.store.commit(() => { g.done = !g.done; }) },
    { label: 'Modifier', onSelect: () => goalSheet(ctx, g) },
    { label: 'Dupliquer', onSelect: () => ctx.store.commit((s) => { s.goals.push({ ...g, id: uid(), title: `${g.title} (copie)`, done: false }); }) },
    copyItem(g.title),
    deleteItem(`l'objectif « ${g.title} »`, () => ctx.store.commit((s) => { s.goals = s.goals.filter((x) => x.id !== g.id); })),
  ];
  const p = progress(g, today); const unit = UNITS.find(([k]) => k === g.unit)[1];
  const status = g.done ? 'Atteint' : p.daysLeft < 0 ? `Échéance dépassée de ${-p.daysLeft} j` : p.daysLeft === 0 ? 'Échéance aujourd\'hui' : `${p.daysLeft} j restants`;
  return attachMenu(h('li', { class: 'card' },
    h('div', { class: 'card__main goal' },
      h('span', { class: 'card__name' }, g.title),
      g.detail && h('span', { class: 'muted pre' }, g.detail),
      h('progress', { max: 1, value: g.done ? 1 : p.ratio, 'aria-label': `Temps écoulé pour « ${g.title} »` }),
      h('span', { class: 'muted' }, `${g.amount} ${unit} · du ${formatDate(g.start)} au ${formatDate(g.due)} · ${status}`),
      h('div', { class: 'row wrap' },
        h('button', { class: 'btn', onclick: () => ctx.store.commit(() => { g.done = !g.done; }) }, g.done ? 'Rouvrir' : 'Terminé'),
        h('button', { class: 'btn btn--ghost', onclick: () => goalSheet(ctx, g) }, 'Modifier'),
        h('button', { class: 'btn btn--danger', onclick: () => { if (confirm(`Supprimer « ${g.title} » ?`)) ctx.store.commit((s) => { s.goals = s.goals.filter((x) => x.id !== g.id); }); } }, 'Supprimer'),
        menuButton(items, 'Actions de l\'objectif')))), items);
}

function goalSheet(ctx, goal = null) {
  const g = goal ?? newGoal();
  const title = h('input', { type: 'text', maxlength: 300, required: true, value: g.title, placeholder: 'ex. Valider le semestre 1 avec 14 de moyenne' });
  const detail = h('textarea', { rows: 3, maxlength: 5000, value: g.detail, placeholder: 'Comment tu comptes y arriver (facultatif)' });
  const start = h('input', { type: 'date', required: true, value: g.start });
  const amount = h('input', { type: 'number', min: 1, max: 120, value: String(g.amount), required: true });
  const unit = select(UNITS, g.unit);
  const due = h('p', { class: 'muted', role: 'status' });
  const refresh = () => { due.textContent = start.value && Number(amount.value) >= 1 ? `Échéance : ${formatDate(dueDate(start.value, Math.round(Number(amount.value)), unit.value))}` : ''; };
  [start, amount].forEach((el) => el.addEventListener('input', refresh)); unit.addEventListener('change', refresh); refresh();
  openSheet(goal ? 'Modifier l\'objectif' : 'Établir un objectif', h('div', { class: 'sheet__body' },
    field('Objectif', title), field('Détail', detail), field('Début', start),
    h('div', { class: 'row' }, field('Durée', amount), field('Unité', unit)), due), {
    submitLabel: goal ? 'Enregistrer' : 'Établir',
    onSubmit: () => {
      const n = Math.round(Number(amount.value));
      if (!title.value.trim()) return 'Écris ton objectif.';
      if (!start.value) return 'Choisis une date de début.';
      if (!(n >= 1 && n <= 120)) return 'La durée doit être entre 1 et 120.';
      ctx.store.commit((s) => {
        Object.assign(g, { title: title.value.trim(), detail: detail.value.trim(), start: start.value, amount: n, unit: unit.value, due: dueDate(start.value, n, unit.value) });
        if (!goal) s.goals.push(g);
      });
    },
  });
}

function tipSheet(ctx, tip = null) {
  const title = h('input', { type: 'text', maxlength: 300, required: true, value: tip?.title ?? '' });
  const body = h('textarea', { rows: 8, maxlength: 20000, value: tip?.body ?? '' });
  openSheet(tip ? 'Modifier le conseil' : 'Ajouter un conseil', h('div', { class: 'sheet__body' }, field('Titre', title), field('Conseil', body)), {
    onSubmit: () => {
      if (!title.value.trim()) return 'Donne un titre au conseil.';
      ctx.store.commit((s) => {
        if (tip) Object.assign(tip, { title: title.value.trim(), body: body.value.trim() });
        else s.tips.unshift({ id: uid(), title: title.value.trim(), body: body.value.trim() });
      });
    },
  });
}
