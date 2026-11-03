import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setupDOM, memory } from './helpers/dom.js';
const win = setupDOM();
const W = await import('../js/work-logic.js');
const { itemsOn } = await import('../js/calendar-logic.js');
const { createStore, newEvent, newTodo } = await import('../js/store.js');
const { TABS } = await import('../js/app.js');
const cal = await import('../js/modules/calendar.js');
const { openSlotPlanner } = await import('../js/ui/slot-planner.js');
const { openFocusPlanSheet } = await import('../js/ui/focus-plan.js');
const { endRun } = await import('../js/focus-runtime.js');
const focusMod = await import('../js/modules/focus.js');

const ev = (p) => ({ id: 'e', calendarId: 'c', title: 'Stage', date: '2026-11-09', start: '09:00', end: '12:00', allDay: false, repeat: 'none', until: '', endDate: '', exceptions: {}, ...p });
const ids = () => { let n = 0; return () => `s${(n += 1)}`; };
const T2 = [{ start: '09:00', end: '09:30' }, { start: '14:00', end: '15:00' }];

test('plages de travail : un événement sur plusieurs jours, jusqu\'à un jour précis ou jusqu\'à la fin', () => {
  const e = ev({ endDate: '2026-11-12' });
  assert.equal(W.lastDay(e), '2026-11-12');
  const a = W.planSlots({ ev: e, from: '2026-11-01', to: '2026-11-11', times: T2, newId: ids() });
  assert.equal(a.days, 3); assert.equal(a.slots.length, 6); assert.deepEqual([...new Set(a.slots.map((s) => s.date))], ['2026-11-09', '2026-11-10', '2026-11-11']);
  const b = W.planSlots({ ev: e, from: '2026-11-10', to: W.lastDay(e), times: [T2[0]], newId: ids() });
  assert.deepEqual(b.slots.map((s) => s.date), ['2026-11-10', '2026-11-11', '2026-11-12']);
  const c = W.planSlots({ ev: e, from: '2026-11-09', to: '2030-01-01', times: [T2[0]], newId: ids() });
  assert.equal(c.days, 4); // jamais au-delà de la fin de l'événement
});

test('plages de travail : une série répétée = chaque occurrence jusqu\'à sa fin ; une occurrence supprimée est sautée', () => {
  const e = ev({ repeat: 'weekly', until: '2026-11-30', exceptions: { '2026-11-16': { deleted: true } } });
  assert.equal(W.lastDay(e), '2026-11-30');
  const r = W.planSlots({ ev: e, from: '2026-11-01', to: W.lastDay(e), times: [T2[0]], newId: ids() });
  assert.deepEqual(r.slots.map((s) => s.date), ['2026-11-09', '2026-11-23', '2026-11-30']);
  assert.equal(W.lastDay(ev({ repeat: 'weekly' })), ''); // série sans fin : il faut un jour précis
});

test('plages de travail : plages horaires vérifiées, plafond, fusion qui garde les plages faites', () => {
  assert.match(W.checkRanges([]), /au moins une/); assert.match(W.checkRanges([{ start: '10:00', end: '09:00' }]), /après son début/);
  assert.match(W.checkRanges([{ start: '09:00', end: '10:00' }, { start: '09:30', end: '11:00' }]), /chevaucher/);
  assert.equal(W.checkRanges([{ start: '09:00', end: '10:00' }, { start: '10:00', end: '11:00' }]), '');
  assert.throws(() => W.planSlots({ ev: ev({ endDate: '2027-02-28' }), from: '2026-11-09', to: '2027-02-28', times: [T2[0], T2[1], { start: '16:00', end: '17:00' }], newId: ids() }), /maximum 200/);
  assert.throws(() => W.planSlots({ ev: ev(), from: '2027-01-01', to: '2027-01-05', times: [T2[0]], newId: ids() }), /aucun jour/);
  const merged = W.mergeSlots([{ id: 'a', date: '2026-11-09', start: '09:00', end: '10:00', done: true }, { id: 'b', date: '2026-11-10', start: '09:00', end: '10:00', done: false }], [{ id: 'c', date: '2026-11-11', start: '09:00', end: '10:00', done: false }]);
  assert.deepEqual(merged.map((s) => s.id), ['a', 'c']);
});

test('données : plages de tâche et sessions planifiées bornées, une session = UNE tâche OU UN événement', () => {
  const store = createStore(memory());
  store.importFile(JSON.stringify({ app: 'student-hub', kind: 'all', version: 1, data: {
    todos: [{ id: 't1', name: 'x', slots: [{ id: 's1', date: '2026-11-09', start: '09:00', end: '09:30' }, { date: 'nope', start: '09:00', end: '10:00' }, { date: '2026-11-09', start: '10:00', end: '09:00' }, 'x'] }],
    focusPlans: [{ id: 'p1', date: '2026-11-09', start: '09:00', minutes: 999, todoId: 't1', eventId: 'e1' }, { id: 'p2', date: 'x' }, { id: 'p3', date: '2026-11-10', start: 'zz', minutes: 25, eventId: 'e2', done: true }],
  } }));
  assert.equal(store.state.todos.find((t) => t.id === 't1').slots.length, 1);
  assert.deepEqual(store.state.focusPlans.map((p) => [p.id, p.todoId, p.eventId, p.minutes, p.start, p.done]), [['p1', 't1', '', 180, '09:00', false], ['p3', '', 'e2', 25, '09:00', true]]);
  assert.deepEqual(W.exclusiveLink('t', 'e'), { todoId: 't', eventId: '' }); assert.deepEqual(W.exclusiveLink('', 'e'), { todoId: '', eventId: 'e' });
});

const base = () => ({ calendars: [{ id: 'c', visible: true, color: 'blue' }], events: [], todos: [], courses: [], decks: [], cards: [], focusPlans: [], calPrefs: {} });
test('agenda : plages de travail et sessions Focus planifiées apparaissent, masquables', () => {
  const st = base(); st.events = [ev()];
  st.todos = [{ id: 't', name: 'Rapport', eventId: 'e', slots: [{ id: 's', date: '2026-11-09', start: '09:30', end: '10:00', done: false }] }];
  st.focusPlans = [{ id: 'p', date: '2026-11-09', start: '14:00', minutes: 50, todoId: 't', eventId: '', title: '', done: false }];
  const items = itemsOn(st, '2026-11-09');
  const slot = items.find((i) => i.kind === 'slot'); const focus = items.find((i) => i.kind === 'focus');
  assert.equal(slot.title, 'Rapport'); assert.equal(slot.eventId, 'e'); assert.equal(slot.start, '09:30');
  assert.equal(focus.title, 'Focus : Rapport'); assert.equal(focus.end, '14:50'); assert.equal(focus.color, 'focus');
  st.calPrefs = { todos: false, focus: false };
  assert.equal(itemsOn(st, '2026-11-09').filter((i) => ['slot', 'focus'].includes(i.kind)).length, 0);
});

// ---- Interface ----
const click = (el) => el.dispatchEvent(new win.Event('click', { bubbles: true }));
const tick = () => new Promise((r) => setTimeout(r, 0));
const lastDialog = () => [...document.querySelectorAll('dialog')].pop();
const submit = async (dlg) => { dlg.querySelector('form').dispatchEvent(new win.Event('submit', { cancelable: true })); await tick(); };
const change = (el, v) => { el.value = v; el.dispatchEvent(new win.Event('change', { bubbles: true })); };
function mount(key, store, view, date) {
  const mod = TABS.find(([k]) => k === key)[2]; mod.resetView?.();
  if (key === 'calendar') cal.openCalendarAt(date, view);
  const host = document.createElement('div'); document.body.append(host);
  const ctx = { store, data: {}, rerender: () => host.replaceChildren(mod.render(ctx)) };
  store.subscribe(() => ctx.rerender()); ctx.rerender(); return { host, ctx };
}

test('planificateur : plages choisies, jusqu\'à la fin de l\'événement, plages déjà faites conservées', async () => {
  const store = createStore(memory()); const calId = store.state.calendars[0].id;
  store.commit((s) => { s.events.push(newEvent({ id: 'e1', calendarId: calId, title: 'Stage', date: '2026-11-09', start: '09:00', end: '12:00', endDate: '2026-11-11' })); s.todos.push(newTodo({ id: 't1', name: 'Rapport', eventId: 'e1' })); });
  openSlotPlanner(store, store.state.todos[0]);
  const dlg = lastDialog();
  assert.ok(dlg.textContent.includes('Stage')); assert.equal(dlg.querySelector('select').value, 'end');
  const [until, from] = dlg.querySelectorAll('input[type="date"]'); change(from, '2026-11-09');
  click([...dlg.querySelectorAll('button')].find((b) => b.textContent.includes('Ajouter une plage')));
  assert.ok(dlg.textContent.includes('6 plages sur 3 jours'), dlg.textContent.slice(-200));
  await submit(dlg);
  const t = store.state.todos[0];
  assert.equal(t.slots.length, 6); assert.ok(t.slots.every((s) => ['2026-11-09', '2026-11-10', '2026-11-11'].includes(s.date)));
  t.slots[0].done = true;
  openSlotPlanner(store, t); const d2 = lastDialog(); change(d2.querySelectorAll('input[type="date"]')[1], '2026-11-10'); await submit(d2);
  assert.equal(store.state.todos[0].slots.filter((s) => s.done).length, 1); assert.equal(store.state.todos[0].slots.length, 3); // la plage faite reste (9 nov), le reste est replanifié (10 et 11 nov)
  // tâche sans événement
  store.commit((s) => s.todos.push(newTodo({ id: 't2', name: 'Seule' }))); openSlotPlanner(store, store.state.todos[1]);
  assert.ok(lastDialog().textContent.includes('n\'est liée à aucun événement'));
});

test('vue semaine : la plage de travail s\'affiche DANS l\'événement ; hors de ses heures elle a son propre bloc', () => {
  const store = createStore(memory()); const calId = store.state.calendars[0].id;
  store.commit((s) => {
    s.events.push(newEvent({ id: 'e1', calendarId: calId, title: 'Stage', date: '2026-11-09', start: '09:00', end: '12:00' }));
    s.todos.push(newTodo({ id: 't1', name: 'Rapport', eventId: 'e1', slots: [{ id: 'a', date: '2026-11-09', start: '09:30', end: '10:00', done: false }, { id: 'b', date: '2026-11-09', start: '14:00', end: '15:00', done: true }] }));
  });
  const { host } = mount('calendar', store, 'week', '2026-11-09');
  const stage = [...host.querySelectorAll('button.wk__ev')].find((b) => b.textContent.includes('Stage'));
  const inside = stage.querySelector('.wk__slot'); assert.ok(inside, 'plage dans le bloc de l\'événement');
  assert.ok(inside.textContent.includes('Rapport') && inside.textContent.startsWith('☐'));
  assert.equal(inside.style.top, '24px'); // 30 min après le début de l'événement (48 px par heure)
  const outside = [...host.querySelectorAll('button.wk__ev')].find((b) => b !== stage && b.textContent.includes('Rapport'));
  assert.ok(outside, 'plage hors des heures de l\'événement : bloc à part'); assert.ok(!stage.textContent.includes('☑'));
  click(inside); assert.ok(lastDialog().textContent.includes('Modifier le to-do'));
});

test('menu d\'une plage : marquer faite, supprimer', () => {
  const store = createStore(memory()); const calId = store.state.calendars[0].id;
  store.commit((s) => { s.events.push(newEvent({ id: 'e1', calendarId: calId, title: 'Stage', date: '2026-11-09', start: '09:00', end: '12:00' })); s.todos.push(newTodo({ id: 't1', name: 'Rapport', eventId: 'e1', slots: [{ id: 'a', date: '2026-11-09', start: '09:30', end: '10:00', done: false }] })); });
  const { host } = mount('calendar', store, 'week', '2026-11-09');
  const orig = globalThis.confirm; globalThis.confirm = () => true;
  try {
    host.querySelector('.wk__slot').dispatchEvent(new win.Event('contextmenu', { bubbles: true, cancelable: true }));
    const labels = [...document.querySelectorAll('.ctx [role="menuitem"]')].map((b) => b.textContent);
    for (const l of ['Marquer faite', 'Ouvrir la tâche', 'Planifier mon travail…', 'Démarrer un Focus', 'Supprimer cette plage']) assert.ok(labels.includes(l), l);
    click([...document.querySelectorAll('.ctx [role="menuitem"]')].find((b) => b.textContent === 'Marquer faite'));
    assert.equal(store.state.todos[0].slots[0].done, true); assert.ok(host.querySelector('.wk__slot').textContent.startsWith('☑'));
    host.querySelector('.wk__slot').dispatchEvent(new win.Event('contextmenu', { bubbles: true, cancelable: true }));
    click([...document.querySelectorAll('.ctx [role="menuitem"]')].find((b) => b.textContent === 'Supprimer cette plage'));
    assert.equal(store.state.todos[0].slots.length, 0);
  } finally { globalThis.confirm = orig; }
});

test('Focus planifié : lié à UNE tâche ou UN événement, lancé depuis la liste, marqué fait à la fin', async () => {
  const store = createStore(memory()); const calId = store.state.calendars[0].id; const future = '2999-01-01';
  store.commit((s) => { s.events.push(newEvent({ id: 'e1', calendarId: calId, title: 'TP', date: future })); s.todos.push(newTodo({ id: 't1', name: 'Exo 3' })); });
  openFocusPlanSheet(store, { todoId: 't1', date: future });
  const dlg = lastDialog(); const selects = dlg.querySelectorAll('select');
  assert.equal(selects[0].value, 'todo'); // « Lier à » = une tâche
  change(selects[0], 'event'); change(dlg.querySelectorAll('select')[2], 'e1'); // l'événement remplace la tâche
  await submit(dlg);
  assert.equal(store.state.focusPlans.length, 1); assert.deepEqual([store.state.focusPlans[0].todoId, store.state.focusPlans[0].eventId], ['', 'e1']);
  const { host } = mount('focus', store);
  assert.ok(host.textContent.includes('Sessions planifiées') && host.textContent.includes('TP'));
  // choisir une tâche vide l'événement, et réciproquement
  const todoSel = host.querySelector('select[aria-label="Tâche liée"]'); const eventSel = host.querySelector('select[aria-label="Événement lié"]');
  change(eventSel, 'e1'); assert.equal(todoSel.value, ''); change(todoSel, 't1'); assert.equal(eventSel.value, '');
  click([...host.querySelectorAll('button')].find((b) => b.textContent.includes('Lancer')));
  const host2 = mount('focus', store).host;
  click([...host2.querySelectorAll('button')].find((b) => b.textContent.includes('Démarrer la concentration')));
  const run = store.state.focusRun; assert.equal(run.planId, store.state.focusPlans[0].id); assert.equal(run.eventId, 'e1'); assert.equal(run.todoId, '');
  endRun(store, 'done');
  assert.equal(store.state.focusPlans[0].done, true); assert.equal(store.state.sessions[0].planId, run.planId);
});

test('menus : planifier un Focus et planifier son travail depuis une tâche', () => {
  const store = createStore(memory());
  store.commit((s) => s.todos.push(newTodo({ id: 't1', name: 'Rendre TP' })));
  const { host } = mount('workspace', store);
  const card = [...host.querySelectorAll('li.card')].find((c) => c.textContent.includes('Rendre TP'));
  card.dispatchEvent(new win.Event('contextmenu', { bubbles: true, cancelable: true }));
  const labels = [...document.querySelectorAll('.ctx [role="menuitem"]')].map((b) => b.textContent);
  assert.ok(labels.includes('Planifier un Focus…') && labels.includes('Planifier mon travail…'));
  click([...document.querySelectorAll('.ctx [role="menuitem"]')].find((b) => b.textContent === 'Planifier un Focus…'));
  assert.ok(lastDialog().textContent.includes('Planifier une session Focus'));
  focusMod.prepareSession({ todoId: 't1', eventId: 'e1' }); // les deux donnés : la tâche l'emporte
});
