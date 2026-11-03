import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setupDOM, memory } from './helpers/dom.js';
const win = setupDOM();
const { createStore, newTodo } = await import('../js/store.js');
const R = await import('../js/reports-logic.js');
const { barChart } = await import('../js/ui/charts.js');
const { TABS } = await import('../js/app.js');
const { widgetBody } = await import('../js/ui/widgets.js');
const { showCourse } = await import('../js/modules/workspace.js');
const { ymd } = await import('../js/calendar-logic.js');

const todo = (id, p = {}) => newTodo({ id, name: id, ...p });
const TODAY = '2026-11-04'; // un mercredi
const click = (el) => el.dispatchEvent(new win.Event('click', { bubbles: true }));

test('statusCounts : « en retard » est compté à part, les sous-tâches ne comptent pas', () => {
  const list = [
    todo('a', { status: 'Terminés' }), todo('b', { status: 'En cours' }), todo('c'), todo('d', { deadline: '2026-11-01' }),
    todo('e', { status: 'En cours', deadline: '2026-11-01' }), todo('f', { status: 'Terminés', deadline: '2026-10-01' }), todo('k', { parentId: 'c', deadline: '2026-10-01' }), todo('g', { status: 'Sans statut' }),
  ];
  assert.deepEqual(R.statusCounts(list, TODAY), { fait: 2, enCours: 1, aFaire: 2, enRetard: 2 });
  assert.deepEqual(R.statusCounts([], TODAY), { fait: 0, enCours: 0, aFaire: 0, enRetard: 0 });
});

test('byCourse : avancement par cours, « Sans cours », cours vides omis, tri par nombre de tâches', () => {
  const courses = [{ id: 'c1', name: 'Algèbre' }, { id: 'c2', name: 'Chimie' }, { id: 'c3', name: 'Vide' }];
  const list = [todo('a', { courseId: 'c1', status: 'Terminés' }), todo('b', { courseId: 'c1' }), todo('c', { courseId: 'c2' }), todo('d'), todo('s', { courseId: 'c1', parentId: 'a' })];
  const rows = R.byCourse(list, courses);
  assert.deepEqual(rows.map((r) => [r.name, r.done, r.total, r.ratio]), [['Algèbre', 1, 2, 0.5], ['Chimie', 0, 1, 0], ['Sans cours', 0, 1, 0]]);
});

test('doneByWeek : semaines du lundi au dimanche, sans date comptées à part', () => {
  const list = [
    todo('a', { status: 'Terminés', doneAt: '2026-11-02' }), todo('b', { status: 'Terminés', doneAt: '2026-11-08' }), // semaine du 2/11 (lundi et dimanche)
    todo('c', { status: 'Terminés', doneAt: '2026-10-27' }), // semaine du 26/10
    todo('d', { status: 'Terminés', doneAt: '2026-06-01' }), // hors fenêtre
    todo('e', { status: 'Terminés' }), todo('f', { doneAt: '2026-11-03' }), // sans date ; pas terminée
  ];
  const w = R.doneByWeek(list, TODAY, 3);
  assert.deepEqual(w.labels, ['19/10', '26/10', '02/11']);
  assert.deepEqual(w.values, [0, 1, 2]);
  assert.equal(w.unknown, 1);
});

test('overdue : en retard seulement, sous-tâches comprises, plus anciennes d\'abord', () => {
  const list = [todo('a', { deadline: '2026-11-03' }), todo('b', { deadline: '2026-10-20' }), todo('c', { deadline: '2026-11-04' }), todo('d', { deadline: '2026-10-01', status: 'Terminés' }), todo('e'), todo('k', { parentId: 'a', deadline: '2026-10-25' })];
  assert.deepEqual(R.overdue(list, TODAY).map((t) => t.id), ['b', 'k', 'a']);
});

test('load : plages non faites, sessions Focus non réalisées, effort sans plage posé sur la deadline', () => {
  const state = {
    todos: [
      todo('a', { slots: [{ id: 's1', date: '2026-11-04', start: '09:00', end: '11:00', done: false }, { id: 's2', date: '2026-11-04', start: '14:00', end: '15:00', done: true }] }),
      todo('b', { effort: 90, deadline: '2026-11-06' }),
      todo('c', { effort: 60, deadline: '2026-10-01' }), // dépassée : posée sur le premier jour
      todo('d', { effort: 30, deadline: '2026-11-06', status: 'Terminés' }),
      todo('p', { effort: 500, deadline: '2026-11-05' }), todo('k', { parentId: 'p', effort: 45, deadline: '2026-11-05' }), // le parent ne compte pas son effort
      todo('e', { effort: 20, deadline: '2026-12-31' }), // hors période
      todo('f', { effort: 30, deadline: '2026-11-06', slots: [{ id: 's3', date: '2026-11-05', start: '10:00', end: '10:30', done: false }] }), // a des plages : pas d'effort en plus
    ],
    focusPlans: [{ id: 'f1', date: '2026-11-04', start: '16:00', minutes: 50, todoId: '', eventId: '', title: '' }, { id: 'f2', date: '2026-11-05', start: '16:00', minutes: 25, todoId: '', eventId: '', title: '' }],
    sessions: [{ id: 'x', status: 'done', planId: 'f2' }],
  };
  const d = R.load(state, TODAY, 4, 180);
  assert.equal(d.length, 4);
  assert.deepEqual(d.map((x) => x.date), ['2026-11-04', '2026-11-05', '2026-11-06', '2026-11-07']);
  assert.deepEqual([d[0].planned, d[0].unplanned], [120 + 50, 60], 'plage faite ignorée ; Focus planifié compté ; effort en retard sur le 1er jour');
  assert.deepEqual([d[1].planned, d[1].unplanned], [30, 45], 'le Focus déjà réalisé est ignoré');
  assert.deepEqual([d[2].planned, d[2].unplanned], [0, 90]);
  assert.deepEqual(d.map((x) => x.over), [true, false, false, false], '230 min > 180 min de capacité');
});

test('barChart : pile et trait de capacité ; barres au-dessus de la capacité marquées', () => {
  const svg = barChart([1, 2, 5], ['a', 'b', 'c'], { label: 'Charge', stack: [0, 1, 0], limit: 4, limitLabel: 'capacité 4 h' });
  assert.ok(svg.querySelector('.chart__limit'));
  assert.equal(svg.querySelectorAll('.chart__bar2').length, 1);
  assert.equal(svg.querySelectorAll('.chart__bar--over').length, 1, 'seule la 3e barre (5 > 4) dépasse');
  assert.ok(svg.textContent.includes('capacité 4 h'));
  const plain = barChart([1, 2], ['a', 'b']);
  assert.equal(plain.querySelector('.chart__limit'), null);
});

const mountWs = (store) => {
  const mod = TABS.find(([k]) => k === 'workspace')[2];
  const host = document.createElement('div'); const ctx = { store, data: {}, rerender: () => host.replaceChildren(mod.render(ctx)) }; ctx.rerender();
  return { host, ctx };
};

test('Workspace > Rapports : à vide, sans erreur, avec les six sections', () => {
  showCourse(null);
  const { host } = mountWs(createStore(memory()));
  click([...host.querySelectorAll('.seg__btn')].find((b) => b.textContent === 'Rapports'));
  const titles = [...host.querySelectorAll('section h2')].map((x) => x.textContent);
  assert.deepEqual(titles, ['Statut des tâches', 'En retard', 'Charge des 14 prochains jours', 'Avancement par cours', 'Tâches terminées par semaine', 'Prêtes à démarrer']);
  assert.ok(host.textContent.includes('Aucune tâche en retard.'));
  assert.ok(host.textContent.includes('Aucun travail planifié ni estimé'));
});

test('Workspace > Rapports : donut, retards cliquables, surcharge signalée', () => {
  const store = createStore(memory());
  const today = ymd(new Date());
  store.commit((s) => {
    s.todos.push(todo('r', { name: 'Devoir en retard', deadline: '2020-01-01' }), todo('f', { name: 'Fait', status: 'Terminés', doneAt: today, courseId: s.courses[0].id }), todo('g', { name: 'Gros travail', effort: 600, deadline: today }));
  });
  showCourse(null);
  const { host } = mountWs(store);
  click([...host.querySelectorAll('.seg__btn')].find((b) => b.textContent === 'Rapports'));
  assert.ok(host.querySelector('svg.donut'));
  assert.ok(host.textContent.includes('En retard : 1'));
  assert.ok(host.textContent.includes('Surcharge :'), '10 h le même jour pour 4 h de capacité');
  assert.ok(host.querySelector('.chart__bar--over'));
  assert.ok(host.querySelector('.bars progress'));
  click([...host.querySelectorAll('.linkish')].find((b) => b.textContent === 'Devoir en retard'));
  assert.ok([...document.querySelectorAll('dialog')].pop().textContent.includes('Modifier le to-do'), 'cliquer un retard ouvre la tâche');
  document.querySelectorAll('dialog').forEach((d) => d.close());
});

test('la capacité des réglages change le seuil de surcharge', () => {
  const store = createStore(memory());
  const today = ymd(new Date());
  store.commit((s) => { s.todos.push(todo('g', { effort: 300, deadline: today })); });
  const w = () => widgetBody({ store, data: {}, rerender() {} }, 'load');
  assert.ok(w().textContent.includes('Surcharge'), '5 h > 4 h par défaut');
  store.commit((s) => { s.settings.work.capacityMin = 480; });
  assert.ok(!w().textContent.includes('Surcharge'));
  assert.ok(w().textContent.includes('sous ta capacité de 8 h'));
});

test('widgets Home : « En retard » et « Charge de la semaine »', () => {
  const store = createStore(memory());
  store.commit((s) => { s.todos.push(todo('r', { name: 'Rapport de TP', deadline: '2020-01-01' })); });
  const late = widgetBody({ store, data: {}, rerender() {} }, 'late');
  assert.ok(late.textContent.includes('Rapport de TP'));
  const ld = widgetBody({ store, data: {}, rerender() {} }, 'load');
  assert.equal(ld.querySelectorAll('svg.chart').length, 1);
  assert.equal(widgetBody({ store: createStore(memory()), data: {}, rerender() {} }, 'late').textContent, 'Aucune tâche en retard.');
});
