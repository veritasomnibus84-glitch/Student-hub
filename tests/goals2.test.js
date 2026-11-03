import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setupDOM, memory } from './helpers/dom.js';
const win = setupDOM();
const { createStore, newTodo, newProject, sanitizeState } = await import('../js/store.js');
const G = await import('../js/goals-logic.js');
const { TABS } = await import('../js/app.js');
const { widgetBody } = await import('../js/ui/widgets.js');
const { showProject } = await import('../js/modules/workspace.js');

const todo = (id, p = {}) => newTodo({ id, name: id, ...p });
const goal = (p = {}) => G.newGoal({ id: 'g', title: 'Valider S1', start: '2026-10-01', amount: 3, unit: 'months', ...p });
const click = (el) => el.dispatchEvent(new win.Event('click', { bubbles: true }));
const change = (el) => el.dispatchEvent(new win.Event('change', { bubbles: true }));
const state = () => ({
  projects: [newProject({ id: 'p' })], courses: [{ id: 'c', name: 'Algèbre' }],
  todos: [todo('a', { projectId: 'p', status: 'Terminés' }), todo('b', { projectId: 'p' }), todo('x', { courseId: 'c', status: 'Terminés' }), todo('y', { courseId: 'c', status: 'Terminés' }), todo('z', { courseId: 'c' })],
});

test('anciens objectifs : mode « temps », rien ne change', () => {
  const s = sanitizeState({ goals: [{ id: 'old', title: 'Vieux', start: '2026-10-01', amount: 6, unit: 'months' }] });
  assert.deepEqual([s.goals[0].mode, s.goals[0].manual, s.goals[0].links], ['time', 0, []]);
  const gp = G.goalProgress(s.goals[0], state(), '2026-11-15');
  assert.equal(gp.status, '');
  assert.equal(gp.work, gp.time);
  assert.equal(G.progress(s.goals[0], '2026-11-15').ratio, gp.time);
});

test('sanitizeGoals : mode inconnu, manuel borné, liens filtrés sans doublon et plafonnés à 100', () => {
  const links = [{ kind: 'x', id: 'a' }, { kind: 'todo', id: '' }, { kind: 'todo', id: 'a' }, { kind: 'todo', id: 'a' }, ...Array.from({ length: 150 }, (_, i) => ({ kind: 'course', id: `c${i}` }))];
  const g = G.sanitizeGoals({ goals: [{ start: '2026-10-01', mode: 'zzz', manual: 250, links }] }).goals[0];
  assert.deepEqual([g.mode, g.manual], ['time', 100]);
  assert.equal(g.links.length, 100);
  assert.deepEqual(g.links[0], { kind: 'todo', id: 'a' });
  assert.equal(G.sanitizeGoals({ goals: [{ start: '2026-10-01', mode: 'auto', manual: -4 }] }).goals[0].manual, 0);
});

test('linkRatio : projet, cours, tâche ; lien cassé = null', () => {
  const st = state();
  assert.equal(G.linkRatio({ kind: 'project', id: 'p' }, st), 0.5);
  assert.equal(Math.round(G.linkRatio({ kind: 'course', id: 'c' }, st) * 100), 67);
  assert.equal(G.linkRatio({ kind: 'todo', id: 'a' }, st), 1);
  assert.equal(G.linkRatio({ kind: 'todo', id: 'b' }, st), 0);
  assert.equal(G.linkRatio({ kind: 'project', id: 'fantome' }, st), null);
  assert.equal(G.linkRatio({ kind: 'course', id: 'fantome' }, st), null);
  assert.equal(G.linkRatio({ kind: 'todo', id: 'fantome' }, st), null);
});

test('goalProgress automatique : moyenne des liens, liens cassés ignorés et comptés', () => {
  const g = goal({ mode: 'auto', links: [{ kind: 'project', id: 'p' }, { kind: 'todo', id: 'a' }, { kind: 'todo', id: 'fantome' }] });
  const gp = G.goalProgress(g, state(), '2026-10-20');
  assert.equal(gp.work, 0.75); assert.deepEqual([gp.linked, gp.broken], [2, 1]);
  const none = G.goalProgress(goal({ mode: 'auto', links: [] }), state(), '2026-10-20');
  assert.equal(none.work, 0); assert.equal(none.linked, 0);
});

test('un objectif relié à un projet à 50 % affiche 50 %', () => {
  const gp = G.goalProgress(goal({ mode: 'auto', links: [{ kind: 'project', id: 'p' }] }), state(), '2026-10-20');
  assert.equal(gp.work, 0.5);
});

test('statut : seuils Dans les temps / À risque / En retard / Atteint', () => {
  const at = (work, today) => G.goalProgress(goal({ mode: 'manual', manual: work, start: '2026-10-01', amount: 10, unit: 'months' }), state(), today);
  const t = at(0, '2026-10-01').time; assert.equal(t, 0);
  // 3 mois de 10 : choisissons une date où le temps écoulé vaut environ 50 %
  const mid = '2027-03-01'; const time = at(0, mid).time;
  assert.ok(time > 0.45 && time < 0.55);
  assert.equal(at(50, mid).status, 'Dans les temps');
  assert.equal(at(45, mid).status, 'Dans les temps', 'écart de -5 points');
  assert.equal(at(35, mid).status, 'À risque', 'écart d\'environ -15 points');
  assert.equal(at(20, mid).status, 'En retard');
  assert.equal(at(100, mid).status, 'Atteint');
  assert.equal(G.goalProgress(goal({ mode: 'time', done: true }), state(), mid).status, 'Atteint');
  assert.equal(G.goalProgress(goal({ mode: 'time' }), state(), mid).status, '', 'pas de statut en mode temps');
});

test('goalsLinkedTo : seulement les objectifs automatiques reliés', () => {
  const goals = [goal({ id: '1', mode: 'auto', links: [{ kind: 'project', id: 'p' }] }), goal({ id: '2', mode: 'manual', links: [{ kind: 'project', id: 'p' }] }), goal({ id: '3', mode: 'auto', links: [{ kind: 'course', id: 'p' }] })];
  assert.deepEqual(G.goalsLinkedTo(goals, 'project', 'p').map((g) => g.id), ['1']);
});

const mount = (store) => {
  const mod = TABS.find(([k]) => k === 'goals')[2];
  const host = document.createElement('div'); const ctx = { store, data: {}, rerender: () => host.replaceChildren(mod.render(ctx)) }; ctx.rerender();
  store.subscribe(() => ctx.rerender());
  return host;
};

test('Objectifs : établir un objectif automatique relié à un projet, voir % et statut', async () => {
  const store = createStore(memory());
  store.commit((s) => { s.projects.push(newProject({ id: 'p', name: 'Dossier' })); s.todos.push(todo('a', { projectId: 'p', status: 'Terminés' }), todo('b', { projectId: 'p' })); });
  const host = mount(store);
  click([...host.querySelectorAll('button')].find((b) => b.textContent === 'Établir un objectif'));
  const dlg = [...document.querySelectorAll('dialog')].pop();
  dlg.querySelector('input[type=text]').value = 'Finir le dossier';
  const mode = dlg.querySelector('select[aria-label="Progression"]'); mode.value = 'auto'; change(mode);
  const form = dlg.querySelector('form');
  form.dispatchEvent(new win.Event('submit', { bubbles: true, cancelable: true }));
  await new Promise((r) => setTimeout(r, 0));
  assert.ok(dlg.querySelector('.error').textContent.includes('Relie au moins'), 'un objectif automatique sans lien est refusé');
  const adder = dlg.querySelector('select[aria-label="Relier un projet, un cours ou un to-do"]');
  adder.value = 'project:p'; change(adder);
  assert.ok(dlg.textContent.includes('Projet · Dossier'));
  assert.equal([...adder.querySelectorAll('option')].some((o) => o.value === 'project:p'), false, 'un lien déjà posé n\'est plus proposé');
  form.dispatchEvent(new win.Event('submit', { bubbles: true, cancelable: true }));
  await new Promise((r) => setTimeout(r, 0));
  const g = store.state.goals.at(-1);
  assert.deepEqual([g.mode, g.links], ['auto', [{ kind: 'project', id: 'p' }]]);
  assert.ok(host.textContent.includes('Avancement : 50 %'));
  assert.ok(host.querySelector('progress[aria-label^="Avancement de"]'));
  assert.ok(/Dans les temps|À risque|En retard|Atteint/.test(host.textContent));
});

test('Objectifs : le mode manuel affiche le curseur, le mode temps ne change pas l\'affichage', () => {
  const store = createStore(memory());
  store.commit((s) => { s.goals.push(goal({ id: 'm', title: 'Manuel', mode: 'manual', manual: 40 }), goal({ id: 't', title: 'Temps' })); });
  const host = mount(store);
  const cards = [...host.querySelectorAll('.card')];
  assert.ok(cards.find((c) => c.textContent.includes('Manuel')).textContent.includes('Avancement : 40 %'));
  assert.equal(cards.find((c) => c.textContent.includes('Temps')).textContent.includes('Avancement :'), false);
  click(cards.find((c) => c.textContent.includes('Manuel')).querySelector('.btn--ghost'));
  const dlg = [...document.querySelectorAll('dialog')].pop();
  assert.equal(dlg.querySelector('input[type=range]').parentElement.parentElement.hidden, false);
  assert.equal(dlg.querySelector('select[aria-label="Relier un projet, un cours ou un to-do"]').closest('.stack').hidden, true);
  dlg.close();
});

test('Objectifs : un lien cassé est signalé, et le bouton du lien ouvre le projet', () => {
  const store = createStore(memory());
  store.commit((s) => { s.projects.push(newProject({ id: 'p', name: 'Dossier' })); s.goals.push(goal({ mode: 'auto', links: [{ kind: 'project', id: 'p' }, { kind: 'course', id: 'disparu' }] })); });
  const host = mount(store);
  assert.ok(host.textContent.includes('Lien cassé'));
  click([...host.querySelectorAll('.chipbtn')].find((b) => b.textContent.includes('Dossier')));
  assert.equal(location.hash, '#workspace');
});

test('Home : le widget objectif montre l\'avancement et le statut d\'un objectif relié', () => {
  const store = createStore(memory());
  store.commit((s) => { s.projects.push(newProject({ id: 'p' })); s.todos.push(todo('a', { projectId: 'p', status: 'Terminés' })); s.goals.push(goal({ title: 'Cap', mode: 'auto', links: [{ kind: 'project', id: 'p' }], start: '2026-10-01', amount: 12, unit: 'months' })); });
  const w = widgetBody({ store, data: {}, rerender() {} }, 'goal');
  assert.ok(w.textContent.includes('100 %') && w.textContent.includes('Atteint'));
  assert.ok(w.querySelector('progress[aria-label^="Avancement pour"]'));
});

test('page d\'un projet : « Objectifs liés » apparaît quand un objectif automatique y est relié', () => {
  const store = createStore(memory());
  store.commit((s) => { s.projects.push(newProject({ id: 'p', name: 'Dossier' })); s.goals.push(goal({ title: 'Valider S1', mode: 'auto', links: [{ kind: 'project', id: 'p' }] })); });
  showProject(null); // la vue de Workspace garde son état d'un test à l'autre : on repart de la liste des projets
  const mod = TABS.find(([k]) => k === 'workspace')[2];
  const host = document.createElement('div'); const ctx = { store, data: {}, rerender: () => host.replaceChildren(mod.render(ctx)) }; ctx.rerender();
  click(host.querySelector('.course'));
  assert.ok(host.textContent.includes('Objectifs liés') && host.textContent.includes('Valider S1'));
});

test('guide : ceux qui ont la version 5 reçoivent seulement les trois nouveaux conseils, sans toucher aux leurs', () => {
  const r = G.sanitizeGoals({ tipsSeeded: true, guideVersion: 5, tips: [{ id: 'mine', title: 'Le mien', body: 'x' }] });
  assert.deepEqual(r.tips.map((t) => t.id), ['guide-34', 'guide-35', 'guide-36', 'mine']);
  assert.equal(r.guideVersion, 6);
  assert.deepEqual(G.sanitizeGoals({ tipsSeeded: true, guideVersion: 6, tips: [] }).tips, [], 'supprimés : ils ne reviennent pas');
  const text = G.guideTips().map((t) => t.body).join(' ');
  for (const word of ['sous-tâche', 'Bloquée par', 'Prêtes à démarrer', 'Ordre conseillé', 'Lien cassé', 'Dans les temps']) assert.ok(text.includes(word), word);
});
