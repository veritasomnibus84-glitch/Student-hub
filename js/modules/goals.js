import { h, field, select, empty, formatDate } from '../dom.js';
import { openSheet } from '../ui/dialog.js';
import { newGoal, dueDate, goalProgress, UNITS, MODES, MAX_LINKS } from '../goals-logic.js';
import { showProject, showCourse } from './workspace.js';
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

const STATUS_CLASS = { 'Atteint': 'chip--ok', 'Dans les temps': '', 'À risque': 'chip--soon', 'En retard': 'chip--late' };

// Nom et destination d'un lien ; `null` si l'élément n'existe plus.
function linkInfo(state, l) {
  if (l.kind === 'project') { const p = state.projects.find((x) => x.id === l.id); return p && { label: p.name, go: () => { showProject(p.id); location.hash = '#workspace'; } }; }
  if (l.kind === 'course') { const c = state.courses.find((x) => x.id === l.id); return c && { label: c.name, go: () => { showCourse(c.id); location.hash = '#workspace'; } }; }
  const t = state.todos.find((x) => x.id === l.id); return t && { label: t.name || 'Sans titre', go: () => { location.hash = '#workspace'; } };
}
const KIND_LABEL = { project: 'Projet', course: 'Cours', todo: 'To-do' };

function goalItem(ctx, g, today) {
  const state = ctx.store.state;
  const items = () => [
    { label: g.done ? 'Rouvrir' : 'Marquer terminé', onSelect: () => ctx.store.commit(() => { g.done = !g.done; }) },
    { label: 'Modifier', onSelect: () => goalSheet(ctx, g) },
    { label: 'Dupliquer', onSelect: () => ctx.store.commit((s) => { s.goals.push({ ...g, id: uid(), title: `${g.title} (copie)`, done: false, links: g.links.map((l) => ({ ...l })) }); }) },
    copyItem(g.title),
    deleteItem(`l'objectif « ${g.title} »`, () => ctx.store.commit((s) => { s.goals = s.goals.filter((x) => x.id !== g.id); })),
  ];
  const gp = goalProgress(g, state, today); const unit = UNITS.find(([k]) => k === g.unit)[1];
  const left = g.done ? 'Atteint' : gp.daysLeft < 0 ? `Échéance dépassée de ${-gp.daysLeft} j` : gp.daysLeft === 0 ? 'Échéance aujourd\'hui' : `${gp.daysLeft} j restants`;
  const tracked = gp.mode !== 'time';
  const pct = Math.round((g.done ? 1 : gp.work) * 100);
  return attachMenu(h('li', { class: 'card' },
    h('div', { class: 'card__main goal' },
      h('span', { class: 'card__name' }, g.title, ' ', gp.status && h('span', { class: `chip ${STATUS_CLASS[gp.status] ?? ''}`.trim() }, gp.status)),
      g.detail && h('span', { class: 'muted pre' }, g.detail),
      tracked && h('progress', { max: 1, value: g.done ? 1 : gp.work, 'aria-label': `Avancement de « ${g.title} »` }),
      tracked && h('span', { class: 'muted' }, `Avancement : ${pct} %`),
      h('progress', { max: 1, value: g.done ? 1 : gp.time, class: tracked ? 'progress--time' : null, 'aria-label': `Temps écoulé pour « ${g.title} »` }),
      h('span', { class: 'muted' }, `${g.amount} ${unit} · du ${formatDate(g.start)} au ${formatDate(g.due)} · ${left}`),
      gp.mode === 'auto' && h('div', { class: 'chips' },
        g.links.map((l) => { const info = linkInfo(state, l); return info
          ? h('button', { type: 'button', class: 'chip chipbtn', title: `Ouvrir ${KIND_LABEL[l.kind].toLowerCase()}`, onclick: info.go }, `${KIND_LABEL[l.kind]} · ${info.label}`)
          : h('span', { class: 'chip chip--late' }, 'Lien cassé'); }),
        !g.links.length && h('span', { class: 'muted' }, 'Aucun élément relié : modifie l\'objectif pour en ajouter.')),
      h('div', { class: 'row wrap' },
        h('button', { class: 'btn', onclick: () => ctx.store.commit(() => { g.done = !g.done; }) }, g.done ? 'Rouvrir' : 'Terminé'),
        h('button', { class: 'btn btn--ghost', onclick: () => goalSheet(ctx, g) }, 'Modifier'),
        h('button', { class: 'btn btn--danger', onclick: () => { if (confirm(`Supprimer « ${g.title} » ?`)) ctx.store.commit((s) => { s.goals = s.goals.filter((x) => x.id !== g.id); }); } }, 'Supprimer'),
        menuButton(items, 'Actions de l\'objectif')))), items);
}

function goalSheet(ctx, goal = null) {
  const g = goal ?? newGoal();
  const state = ctx.store.state;
  const title = h('input', { type: 'text', maxlength: 300, required: true, value: g.title, placeholder: 'ex. Valider le semestre 1 avec 14 de moyenne' });
  const detail = h('textarea', { rows: 3, maxlength: 5000, value: g.detail, placeholder: 'Comment tu comptes y arriver (facultatif)' });
  const start = h('input', { type: 'date', required: true, value: g.start });
  const amount = h('input', { type: 'number', min: 1, max: 120, value: String(g.amount), required: true });
  const unit = select(UNITS, g.unit);
  const due = h('p', { class: 'muted', role: 'status' });
  const refresh = () => { due.textContent = start.value && Number(amount.value) >= 1 ? `Échéance : ${formatDate(dueDate(start.value, Math.round(Number(amount.value)), unit.value))}` : ''; };
  [start, amount].forEach((el) => el.addEventListener('input', refresh)); unit.addEventListener('change', refresh); refresh();

  // Progression : temps écoulé (comme avant), curseur manuel, ou moyenne du travail relié.
  const mode = select(MODES, g.mode ?? 'time', { 'aria-label': 'Progression' });
  const manualOut = h('output', null, `${g.manual ?? 0} %`);
  const manual = h('input', { type: 'range', min: 0, max: 100, step: 5, value: String(g.manual ?? 0), 'aria-label': 'Avancement manuel', oninput: () => { manualOut.textContent = `${manual.value} %`; } });
  const manualBox = h('div', { class: 'stack' }, h('label', { class: 'field' }, h('span', { class: 'field__label' }, 'Avancement'), manual), manualOut);
  let links = (g.links ?? []).map((l) => ({ ...l }));
  const chips = h('div', { class: 'chips' });
  const drawLinks = () => chips.replaceChildren(...links.map((l, i) => {
    const info = linkInfo(state, l);
    return h('span', { class: `chip ${info ? '' : 'chip--late'}`.trim() }, info ? `${KIND_LABEL[l.kind]} · ${info.label}` : 'Lien cassé', ' ',
      h('button', { type: 'button', class: 'linkish', 'aria-label': `Retirer le lien ${info?.label ?? ''}`.trim(), onclick: () => { links.splice(i, 1); drawLinks(); } }, '×'));
  }));
  const group = (label, opts) => (opts.length ? h('optgroup', { label }, opts.map(([v, t]) => h('option', { value: v }, t))) : null);
  const taken = () => new Set(links.map((l) => `${l.kind}:${l.id}`));
  const adder = h('select', { 'aria-label': 'Relier un projet, un cours ou un to-do', onchange: () => {
    const [kind, ...rest] = adder.value.split(':'); const id = rest.join(':');
    if (kind && id && links.length < MAX_LINKS && !taken().has(adder.value)) { links.push({ kind, id }); drawLinks(); }
    fillAdder();
  } });
  const fillAdder = () => {
    const used = taken();
    const fresh = (kind, list) => list.filter((x) => !used.has(`${kind}:${x.id}`)).map((x) => [`${kind}:${x.id}`, x.name || 'Sans titre']);
    adder.replaceChildren(h('option', { value: '' }, 'Relier un projet, un cours ou un to-do…'),
      group('Projets', fresh('project', state.projects.filter((p) => !p.archived))), group('Cours', fresh('course', state.courses)),
      group('To-dos', fresh('todo', state.todos.filter((t) => !t.parentId && t.status !== 'Terminés'))));
    adder.value = '';
  };
  drawLinks(); fillAdder();
  const linkBox = h('div', { class: 'stack' }, h('p', { class: 'muted' }, 'L\'avancement est la moyenne de celui des éléments reliés.'), chips, adder);
  const sync = () => { manualBox.hidden = mode.value !== 'manual'; linkBox.hidden = mode.value !== 'auto'; };
  mode.addEventListener('change', sync); sync();

  openSheet(goal ? 'Modifier l\'objectif' : 'Établir un objectif', h('div', { class: 'sheet__body' },
    field('Objectif', title), field('Détail', detail), field('Début', start),
    h('div', { class: 'row' }, field('Durée', amount), field('Unité', unit)), due,
    field('Progression', mode), manualBox, linkBox), {
    submitLabel: goal ? 'Enregistrer' : 'Établir',
    onSubmit: () => {
      const n = Math.round(Number(amount.value));
      if (!title.value.trim()) return 'Écris ton objectif.';
      if (!start.value) return 'Choisis une date de début.';
      if (!(n >= 1 && n <= 120)) return 'La durée doit être entre 1 et 120.';
      if (mode.value === 'auto' && !links.length) return 'Relie au moins un projet, un cours ou un to-do (ou choisis une autre progression).';
      ctx.store.commit((s) => {
        Object.assign(g, {
          title: title.value.trim(), detail: detail.value.trim(), start: start.value, amount: n, unit: unit.value, due: dueDate(start.value, n, unit.value),
          mode: mode.value, manual: Math.round(Number(manual.value)) || 0, links: mode.value === 'auto' ? links : (g.links ?? []),
        });
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
