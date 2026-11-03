import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setupDOM, memory } from './helpers/dom.js';
const win = setupDOM();
const { itemsOn, occurrenceOn, spanOf, dueReminders } = await import('../js/calendar-logic.js');
const { createStore, newEvent } = await import('../js/store.js');
const { newDeck, newCard } = await import('../js/revision-logic.js');
const { studyItemsOn } = await import('../js/planning.js');
const { TABS } = await import('../js/app.js');
const cal = await import('../js/modules/calendar.js');

const base = () => ({ calendars: [{ id: 'c', visible: true, color: 'blue' }], events: [], todos: [], courses: [], decks: [], cards: [], calPrefs: {} });
const ev = (p) => ({ id: 'e', calendarId: 'c', title: 'Stage', date: '2026-10-26', start: '09:00', end: '10:00', allDay: false, repeat: 'none', until: '', endDate: '', exceptions: {}, location: '', description: '', reminder: null, ...p });
const shape = (st, d) => itemsOn(st, d).filter((i) => i.kind === 'event').map((i) => [i.title, i.start, i.end, i.allDay]);

test('événement sur plusieurs jours : premier jour jusqu\'à minuit, milieu en « journée », dernier jour depuis minuit', () => {
  const st = base(); st.events = [ev({ endDate: '2026-10-28' })];
  assert.equal(spanOf(st.events[0]), 2);
  assert.deepEqual(shape(st, '2026-10-25'), []);
  assert.deepEqual(shape(st, '2026-10-26'), [['Stage', '09:00', '23:59', false]]);
  assert.deepEqual(shape(st, '2026-10-27'), [['Stage', '', '', true]]);
  assert.deepEqual(shape(st, '2026-10-28'), [['Stage', '00:00', '10:00', false]]);
  assert.deepEqual(shape(st, '2026-10-29'), []);
  st.events = [ev({ endDate: '2026-10-27', allDay: true })];
  assert.deepEqual(shape(st, '2026-10-27'), [['Stage', '', '', true]]);
});

test('série multi-jours : chaque occurrence couvre ses jours', () => {
  const st = base(); st.events = [ev({ repeat: 'weekly', endDate: '2026-10-27' })];
  assert.equal(shape(st, '2026-11-02').length, 1); assert.equal(shape(st, '2026-11-03').length, 1); assert.equal(shape(st, '2026-11-04').length, 0);
});

test('une seule occurrence : supprimée, déplacée, modifiée ; le reste de la série ne bouge pas', () => {
  const st = base();
  st.events = [ev({ repeat: 'weekly', exceptions: { '2026-11-02': { deleted: true }, '2026-11-09': { date: '2026-11-10', title: 'Déplacé', start: '14:00', end: '15:00' }, '2026-11-16': { title: 'Renommé' } } })];
  assert.deepEqual(shape(st, '2026-10-26'), [['Stage', '09:00', '10:00', false]]);
  assert.deepEqual(shape(st, '2026-11-02'), []);
  assert.deepEqual(shape(st, '2026-11-09'), []); assert.deepEqual(shape(st, '2026-11-10'), [['Déplacé', '14:00', '15:00', false]]);
  assert.deepEqual(shape(st, '2026-11-16'), [['Renommé', '09:00', '10:00', false]]);
  assert.deepEqual(shape(st, '2026-11-23'), [['Stage', '09:00', '10:00', false]]);
  assert.equal(itemsOn(st, '2026-11-10')[0].origin, '2026-11-09'); // l'occurrence d'origine reste identifiable
  assert.equal(occurrenceOn(st.events[0], '2026-11-02'), null);
});

test('rappels : une occurrence supprimée ne sonne pas, une déplacée sonne à sa nouvelle heure', () => {
  const st = base(); st.events = [ev({ repeat: 'weekly', reminder: 10, exceptions: { '2026-11-02': { deleted: true }, '2026-11-09': { date: '2026-11-10', start: '14:00', end: '15:00' } } })];
  assert.equal(dueReminders(st, new Date('2026-11-02T08:55:00'), new Set()).length, 0);
  assert.equal(dueReminders(st, new Date('2026-11-09T08:55:00'), new Set()).length, 0);
  assert.equal(dueReminders(st, new Date('2026-11-10T13:55:00'), new Set()).length, 1);
  assert.equal(dueReminders(st, new Date('2026-11-16T08:55:00'), new Set()).length, 1);
});

test('import : fin d\'événement et exceptions invalides écartées', () => {
  const store = createStore(memory());
  const cals = store.state.calendars[0].id;
  const e = (p) => newEvent({ calendarId: cals, title: 'x', date: '2026-10-26', ...p });
  store.importFile(JSON.stringify({ app: 'student-hub', kind: 'section', section: 'calendar', version: 1, data: { events: [
    e({ id: 'a', endDate: '2026-10-25' }), e({ id: 'b', endDate: '2030-01-01' }), e({ id: 'c', endDate: '2026-10-28' }),
    e({ id: 'd', repeat: 'weekly', exceptions: { '2026-11-02': { deleted: true }, nope: { deleted: true }, '2026-11-09': { date: 'x', title: 'T', start: '14:00', end: '13:00', evil: 1 }, '2026-11-16': 'x' } }),
  ] } }));
  const byId = Object.fromEntries(store.state.events.map((x) => [x.id, x]));
  assert.equal(byId.a.endDate, ''); assert.equal(byId.b.endDate, ''); assert.equal(byId.c.endDate, '2026-10-28');
  assert.deepEqual(byId.d.exceptions, { '2026-11-02': { deleted: true }, '2026-11-09': { title: 'T', start: '14:00', end: '14:00' } });
});

test('planning de Mémorisation dans l\'Agenda : tâches du jour, jusqu\'à l\'examen, masquable', () => {
  const today = new Date(); const pad = (n) => String(n).padStart(2, '0');
  const f = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const plus = (n) => { const d = new Date(today); d.setDate(d.getDate() + n); return f(d); };
  const st = base();
  st.decks = [newDeck({ id: 'd', name: 'Cinématique', exam: plus(10) })];
  st.cards = Array.from({ length: 12 }, () => newCard({ deckId: 'd', front: 'q', back: 'a' }));
  const t0 = itemsOn(st, f(today)).filter((i) => i.kind === 'study');
  assert.equal(t0.length, 1); assert.ok(t0[0].title.includes('Cinématique') && t0[0].title.includes('nouvelle'));
  assert.equal(itemsOn(st, plus(11)).filter((i) => i.kind === 'study').length, 0); // après l'examen
  assert.equal(itemsOn(st, plus(-1)).filter((i) => i.kind === 'study').length, 0); // passé
  st.calPrefs = { study: false }; assert.equal(itemsOn(st, f(today)).filter((i) => i.kind === 'study').length, 0);
  assert.equal(studyItemsOn({ decks: [], cards: [] }, f(today)).length, 0);
});

// ---- Interface ----
const click = (el) => el.dispatchEvent(new win.Event('click', { bubbles: true }));
const btn = (root, text) => [...root.querySelectorAll('button')].find((b) => b.textContent.includes(text));
const tick = () => new Promise((r) => setTimeout(r, 0));
const submit = async (dlg) => { dlg.querySelector('form').dispatchEvent(new win.Event('submit', { cancelable: true })); await tick(); };
const lastDialog = () => [...document.querySelectorAll('dialog')].pop();
function mount(store, view = 'month', date = '2026-11-09') {
  const mod = TABS.find(([k]) => k === 'calendar')[2];
  cal.openCalendarAt(date, view);
  const host = document.createElement('div'); document.body.append(host);
  const ctx = { store, data: {}, rerender: () => host.replaceChildren(mod.render(ctx)) };
  store.subscribe(() => ctx.rerender()); ctx.rerender(); return { host, ctx };
}
const chipsNamed = (host, title) => [...host.querySelectorAll('button.ev')].filter((b) => b.textContent.includes(title)); // panneau du jour sélectionné
const cellsNamed = (host, title) => [...host.querySelectorAll('button.mday')].filter((b) => b.textContent.includes(title)); // cases du mois
const cellOf = (host, day) => [...host.querySelectorAll('button.mday')].find((b) => !b.classList.contains('is-out') && b.textContent.startsWith(String(day)));

test('événement répété : choix « cet événement seulement » ou « toute la série »', async () => {
  const store = createStore(memory()); const calId = store.state.calendars[0].id;
  store.commit((s) => s.events.push(newEvent({ id: 'r1', calendarId: calId, title: 'Cours de physique', date: '2026-10-26', start: '09:00', end: '10:00', repeat: 'weekly' })));
  const { host } = mount(store);
  click(chipsNamed(host, 'Cours de physique')[0]);
  const choice = lastDialog(); assert.ok(choice.textContent.includes('se répète'));
  click(btn(choice, 'Cet événement seulement'));
  const occ = lastDialog(); assert.ok(occ.textContent.includes('Cet événement seulement ·'));
  const title = occ.querySelector('input[type="text"]'); title.value = 'Physique : TD';
  await submit(occ);
  assert.deepEqual(Object.keys(store.state.events[0].exceptions), ['2026-11-09']);
  assert.equal(store.state.events[0].title, 'Cours de physique'); // la série garde son titre
  assert.equal(chipsNamed(host, 'Physique : TD').length, 1); assert.ok(cellsNamed(host, 'Cours de physique').length >= 3); assert.equal(cellsNamed(host, 'Physique : TD').length, 1);
  click(chipsNamed(host, 'Physique : TD')[0]); click(btn(lastDialog(), 'Cet événement seulement'));
  const again = lastDialog(); click(btn(again, 'Revenir à la série'));
  assert.deepEqual(store.state.events[0].exceptions, {});
  click(chipsNamed(host, 'Cours de physique')[0]); click(btn(lastDialog(), 'Toute la série'));
  assert.ok(lastDialog().textContent.includes('Se termine le'));
});

test('événement répété : menu « supprimer cet événement seulement » / « la série »', () => {
  const store = createStore(memory()); const calId = store.state.calendars[0].id;
  store.commit((s) => s.events.push(newEvent({ id: 'r2', calendarId: calId, title: 'Labo', date: '2026-10-26', repeat: 'weekly' })));
  const { host } = mount(store);
  const orig = globalThis.confirm; globalThis.confirm = () => true;
  try {
    chipsNamed(host, 'Labo')[0].dispatchEvent(new win.Event('contextmenu', { bubbles: true, cancelable: true }));
    const labels = [...document.querySelectorAll('.ctx [role="menuitem"]')].map((b) => b.textContent);
    assert.ok(labels.includes('Supprimer cet événement seulement') && labels.includes('Supprimer la série'));
    click([...document.querySelectorAll('.ctx [role="menuitem"]')].find((b) => b.textContent === 'Supprimer cet événement seulement'));
    assert.equal(Object.values(store.state.events[0].exceptions).filter((x) => x.deleted).length, 1); assert.equal(store.state.events.length, 1);
    assert.equal(chipsNamed(host, 'Labo').length, 0); // le 9 n'a plus d'occurrence
    click(cellOf(host, 16)); // une autre occurrence de la série
    chipsNamed(host, 'Labo')[0].dispatchEvent(new win.Event('contextmenu', { bubbles: true, cancelable: true }));
    click([...document.querySelectorAll('.ctx [role="menuitem"]')].find((b) => b.textContent === 'Supprimer la série'));
    assert.equal(store.state.events.length, 0);
  } finally { globalThis.confirm = orig; }
});

test('formulaire d\'événement : date de fin pour plusieurs jours, refusée avant le début', async () => {
  const store = createStore(memory()); const calId = store.state.calendars[0].id;
  store.commit((s) => s.events.push(newEvent({ id: 'm1', calendarId: calId, title: 'Stage', date: '2026-11-09', start: '09:00', end: '10:00' })));
  const { host } = mount(store);
  click(chipsNamed(host, 'Stage')[0]);
  const dlg = lastDialog(); const dates = dlg.querySelectorAll('input[type="date"]');
  dates[1].value = '2026-11-05'; await submit(dlg);
  assert.ok(dlg.textContent.includes('ne peut pas précéder')); assert.equal(store.state.events[0].endDate, '');
  dates[1].value = '2026-11-11'; await submit(dlg);
  assert.equal(store.state.events[0].endDate, '2026-11-11');
  assert.ok(cellsNamed(host, 'Stage').length >= 3); // 9, 10 et 11 novembre
});

test('vue semaine : créer par glisser (pas de 15 min), un simple clic crée toujours une heure', async () => {
  const store = createStore(memory());
  const { host } = mount(store, 'week', '2026-11-09');
  const col = host.querySelectorAll('.wk__col')[1];
  const ev = (type, y, extra = {}) => Object.assign(new win.Event(type, { bubbles: true }), { pointerType: 'mouse', button: 0, pointerId: 1, clientX: 5, clientY: y, ...extra });
  col.dispatchEvent(ev('pointerdown', 96)); // 2 h (48 px par heure)
  col.dispatchEvent(ev('pointermove', 150));
  assert.ok(col.querySelector('.wk__drag'), 'aperçu du tracé');
  col.dispatchEvent(ev('pointermove', 200)); // 4 h 10 -> créneau 4 h
  col.dispatchEvent(ev('pointerup', 200));
  await tick();
  const dlg = lastDialog(); const times = [...dlg.querySelectorAll('input[type="time"]')].map((i) => i.value);
  assert.deepEqual(times, ['02:00', '04:15']); assert.equal(col.querySelector('.wk__drag'), null);
  await submit(dlg); await new Promise((r) => setTimeout(r, 80));
  // simple clic (sans déplacement) : le gestionnaire de clic existant crée un événement d'une heure
  col.dispatchEvent(ev('pointerdown', 480)); col.dispatchEvent(ev('pointerup', 480)); col.dispatchEvent(Object.assign(new win.Event('click', { bubbles: true }), { clientX: 5, clientY: 480 }));
  const dlg2 = lastDialog(); assert.ok(dlg2 !== dlg);
  assert.deepEqual([...dlg2.querySelectorAll('input[type="time"]')].map((i) => i.value), ['10:00', '11:00']);
  // un doigt qui défile (mouvement avant l'appui long) ne trace rien
  const touch = (type, y) => Object.assign(new win.Event(type, { bubbles: true }), { pointerType: 'touch', pointerId: 2, clientX: 5, clientY: y });
  const before = document.querySelectorAll('dialog').length;
  col.dispatchEvent(touch('pointerdown', 300)); col.dispatchEvent(touch('pointermove', 340)); await new Promise((r) => setTimeout(r, 450)); col.dispatchEvent(touch('pointerup', 340));
  assert.equal(col.querySelector('.wk__drag'), null); assert.equal(document.querySelectorAll('dialog').length, before);
});
