import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setupDOM, memory } from './helpers/dom.js';
const win = setupDOM();
const { createStore, newTodo, newNote, newLink, newBook, newEvent } = await import('../js/store.js');
const { ymd } = await import('../js/calendar-logic.js');
const { TABS } = await import('../js/app.js');

const mod = (key) => TABS.find(([k]) => k === key)[2];
const mount = (key, store, data = {}) => {
  const host = document.createElement('div');
  const ctx = { store, data, rerender: () => { host.replaceChildren(mod(key).render(ctx)); } };
  ctx.rerender();
  return { host, ctx };
};
const click = (el) => el.dispatchEvent(new win.Event('click', { bubbles: true }));
const byText = (root, sel, text) => [...root.querySelectorAll(sel)].find((e) => e.textContent.includes(text));

test('chaque onglet s\'affiche à vide, sans erreur', () => {
  for (const [key] of TABS) {
    const { host } = mount(key, createStore(memory()), { summaries: [], videos: { videos: [] } });
    assert.ok(host.querySelector('h1'), `${key} sans titre`);
  }
});

test('workspace : liste les cours et ouvre la page d\'un cours (structure Notion)', () => {
  const store = createStore(memory());
  const { host } = mount('workspace', store);
  assert.ok(byText(host, '.course', 'Physique'));
  click(byText(host, '.course', 'Physique'));
  const t = host.textContent;
  for (const label of ['Code du cours', 'Année', 'Prof', 'Travaux', 'Examen', 'Bureau', 'Horaire de cours', 'Email', 'Salle de cours', 'Notes', 'Lectures', 'Questions', 'Syllabus', 'Mes to-dos']) {
    assert.ok(t.includes(label), `manque : ${label}`);
  }
});

test('workspace : le kanban a 4 colonnes et range les to-dos', () => {
  const store = createStore(memory());
  store.commit((s) => {
    s.todos.push(newTodo({ name: 'Devoir immuno', status: 'A faire' }), newTodo({ name: 'Squelette du pied', status: 'En cours' }));
  });
  const { host } = mount('workspace', store);
  assert.equal(host.querySelectorAll('.col').length, 4);
  assert.ok(host.querySelector('.col--todo').textContent.includes('Devoir immuno'));
  assert.ok(host.querySelector('.col--doing').textContent.includes('Squelette du pied'));
});

test('workspace : le bouton → fait avancer le statut', () => {
  const store = createStore(memory());
  store.commit((s) => s.todos.push(newTodo({ name: 'Avancer', status: 'A faire' })));
  const { host } = mount('workspace', store);
  click(host.querySelector('.card__next'));
  assert.equal(store.state.todos[0].status, 'En cours');
});

test('workspace : la recherche filtre le kanban', () => {
  const store = createStore(memory());
  store.commit((s) => s.todos.push(newTodo({ name: 'Alpha' }), newTodo({ name: 'Bravo' })));
  const { host } = mount('workspace', store);
  const input = host.querySelector('input[type="search"]');
  input.value = 'alp'; input.dispatchEvent(new win.Event('input'));
  const names = [...host.querySelectorAll('.card__name')].map((e) => e.textContent);
  assert.deepEqual(names, ['Alpha']);
  input.value = ''; input.dispatchEvent(new win.Event('input'));
});

test('workspace : créer un to-do via la feuille modale', async () => {
  const store = createStore(memory());
  const { host } = mount('workspace', store);
  click(byText(host, 'button', '+ To-do'));
  const dlg = document.querySelector('dialog.sheet');
  assert.ok(dlg);
  dlg.querySelector('input[type="text"]').value = 'Nouveau devoir';
  dlg.querySelector('form').dispatchEvent(new win.Event('submit', { cancelable: true }));
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(store.state.todos[0].name, 'Nouveau devoir');
  assert.equal(document.querySelector('dialog.sheet'), null);
});

test('workspace : un nom vide est refusé', async () => {
  const store = createStore(memory());
  const { host } = mount('workspace', store);
  click(byText(host, 'button', '+ To-do'));
  const dlg = document.querySelector('dialog.sheet');
  dlg.querySelector('form').dispatchEvent(new win.Event('submit', { cancelable: true }));
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(store.state.todos.length, 0);
  assert.match(dlg.querySelector('.error').textContent, /obligatoire/);
  dlg.close();
});

test('notes : créer, épingler, filtrer par lieu', () => {
  const store = createStore(memory());
  const { host } = mount('notes', store);
  click(byText(host, 'button', '+ Note'));
  assert.equal(store.state.notes.length, 1);
  store.commit((s) => s.notes.push(newNote({ title: 'Chimie note', courseId: s.courses[2].id })));
  const { host: h2 } = mount('notes', store);
  assert.equal(h2.querySelectorAll('.note').length, 2);
});

test('liens : groupés par catégorie, URL dangereuse non cliquable', () => {
  const store = createStore(memory());
  store.commit((s) => s.links.push(
    newLink({ title: 'Portail', url: 'https://exemple.org', category: 'École', description: 'Notes et devoirs' }),
    newLink({ title: 'Piège', url: 'javascript:alert(1)' })));
  const { host } = mount('links', store);
  assert.ok(byText(host, 'h2', 'École'));
  assert.ok(byText(host, 'h2', 'Divers'));
  assert.equal(host.querySelectorAll('a[href^="javascript"]').length, 0);
  assert.equal(host.querySelectorAll('a[target="_blank"][rel*="noopener"]').length, 1);
});

test('messages : filtre par source et marque lu', () => {
  const store = createStore(memory());
  const data = { summaries: [
    { id: 'a', source: 'gmail', from: 'Prof', summary: 'Mail A', date: '2026-10-16T10:00:00Z' },
    { id: 'b', source: 'whatsapp', from: 'Classe', summary: '<b>Msg B</b>', date: '2026-10-17T10:00:00Z' },
  ] };
  const { host } = mount('messages', store, data);
  assert.equal(host.querySelectorAll('.msg').length, 2);
  assert.equal(host.querySelector('.msg b'), null, 'le HTML des résumés doit rester du texte');
  click(byText(host, '.seg__btn', 'Gmail'));
  assert.equal(host.querySelectorAll('.msg').length, 1);
  click(byText(host, '.msg button', 'Marquer lu'));
  assert.deepEqual(store.state.read, ['a']);
  click(byText(host, '.seg__btn', 'Tout'));
});

test('vidéos : groupées par chaîne, ids invalides ignorés', () => {
  const data = { videos: { videos: [
    { id: 'abcdefghijk', title: 'Cours 1', channel: 'Ma chaîne', published: '2026-10-10T00:00:00Z' },
    { id: '"><script>', title: 'Piège', channel: 'Ma chaîne' },
  ] } };
  const { host } = mount('videos', createStore(memory()), data);
  assert.equal(host.querySelectorAll('.vcard').length, 1);
  assert.ok(byText(host, 'h2', 'Ma chaîne'));
  assert.equal(host.querySelector('img').getAttribute('src'), 'https://i.ytimg.com/vi/abcdefghijk/mqdefault.jpg');
});

test('bibliothèque : vide, puis sections Favoris / Récents / Signets', () => {
  const store = createStore(memory());
  const { host } = mount('library', store);
  assert.ok(host.textContent.includes('Ta bibliothèque est vide'));
  store.commit((s) => s.library.push(
    newBook({ title: 'Algèbre 2', author: 'Guin', fingerprint: 'a|1', favorite: true, opened: '2026-10-10T10:00:00Z', bookmarks: [{ id: 'm1', page: 4, label: 'x', date: '2026-10-11T00:00:00Z' }] }),
    newBook({ title: 'Géométrie', fingerprint: 'b|2' })));
  const { host: h2, ctx } = mount('library', store);
  assert.equal(h2.querySelectorAll('.book').length, 2);
  click(byText(h2, '.seg__btn', 'Favoris'));
  assert.deepEqual([...h2.querySelectorAll('.book__title')].map((e) => e.textContent), ['Algèbre 2']);
  click(byText(h2, '.seg__btn', 'Récents'));
  assert.equal(h2.querySelectorAll('.book').length, 1);
  click(byText(h2, '.seg__btn', 'Signets'));
  assert.ok(h2.textContent.includes('Algèbre 2 — page 4'));
  click(byText(h2, '.seg__btn', 'Bibliothèque'));
  assert.ok(ctx);
});

test('bibliothèque : recherche et regroupement par auteur', () => {
  const store = createStore(memory());
  store.commit((s) => s.library.push(
    newBook({ title: 'Algèbre 2', author: 'Guin', fingerprint: 'a|1' }), newBook({ title: 'Geometry', author: 'Rich', fingerprint: 'b|2' })));
  const { host } = mount('library', store);
  const search = host.querySelector('input[type="search"]');
  search.value = 'geom'; search.dispatchEvent(new win.Event('input'));
  assert.deepEqual([...host.querySelectorAll('.book__title')].map((e) => e.textContent), ['Geometry']);
  search.value = ''; search.dispatchEvent(new win.Event('input'));
  const group = host.querySelector('select[aria-label="Regrouper"]');
  group.value = 'author'; group.dispatchEvent(new win.Event('change'));
  assert.ok(byText(host, 'h2', 'Guin') && byText(host, 'h2', 'Rich'));
});

test('bibliothèque : un titre HTML reste du texte', () => {
  const store = createStore(memory());
  store.commit((s) => s.library.push(newBook({ title: '<img src=x onerror=alert(1)>', fingerprint: 'c|3' })));
  const { host } = mount('library', store);
  assert.equal(host.querySelector('.book img[src="x"]'), null);
  assert.ok(host.textContent.includes('<img src=x'));
});

const submit = async (dlg) => { dlg.querySelector('form').dispatchEvent(new win.Event('submit', { cancelable: true })); await new Promise((r) => setTimeout(r, 0)); };

test('agenda : mois, semaine, année s\'affichent et la navigation fonctionne', () => {
  const store = createStore(memory());
  store.commit((s) => { s.events.push(newEvent({ title: 'Cours physique', date: ymd(new Date()), start: '08:00', end: '10:00', repeat: 'weekly' })); });
  const { host } = mount('calendar', store);
  assert.ok(host.querySelector('.mgrid'));
  assert.ok(host.textContent.includes('Cours physique'));
  click(byText(host, '.seg__btn', 'Semaine'));
  assert.ok(host.querySelector('.wk__col'));
  assert.equal(host.querySelectorAll('.wk__col').length, 7);
  assert.ok(host.querySelector('.wk__ev'));
  click(byText(host, '.seg__btn', 'Année'));
  assert.equal(host.querySelectorAll('.yr__m').length, 12);
  click(byText(host, '.seg__btn', 'Mois'));
  const title1 = host.querySelector('.cal__title').textContent;
  click(host.querySelector('button[aria-label="Suivant"]'));
  assert.notEqual(host.querySelector('.cal__title').textContent, title1);
  click(byText(host, 'button', "Aujourd'hui"));
  assert.equal(host.querySelector('.cal__title').textContent, title1);
});

test('agenda : créer un événement répété avec rappel via la feuille', async () => {
  const store = createStore(memory());
  const { host } = mount('calendar', store);
  click(byText(host, 'button', '+ Événement'));
  const dlg = document.querySelector('dialog.sheet');
  dlg.querySelector('input[type="text"]').value = 'TP chimie';
  const selects = dlg.querySelectorAll('select');
  selects[1].value = 'weekly'; selects[1].dispatchEvent(new win.Event('change'));
  selects[2].value = '15';
  await submit(dlg);
  const e = store.state.events[0];
  assert.equal(e.title, 'TP chimie'); assert.equal(e.repeat, 'weekly'); assert.equal(e.reminder, 15);
  assert.equal(document.querySelector('dialog.sheet'), null);
});

test('agenda : fin avant début refusée, titre obligatoire', async () => {
  const store = createStore(memory());
  const { host } = mount('calendar', store);
  click(byText(host, 'button', '+ Événement'));
  const dlg = document.querySelector('dialog.sheet');
  await submit(dlg);
  assert.match(dlg.querySelector('.error').textContent, /titre/);
  dlg.querySelector('input[type="text"]').value = 'X';
  const times = dlg.querySelectorAll('input[type="time"]');
  times[0].value = '10:00'; times[1].value = '09:00';
  await submit(dlg);
  assert.match(dlg.querySelector('.error').textContent, /fin/);
  assert.equal(store.state.events.length, 0);
  dlg.close();
});

test('agenda : masquer un agenda retire ses événements de la vue ; la recherche trouve', () => {
  const store = createStore(memory());
  store.commit((s) => { s.events.push(newEvent({ title: 'Cours X', date: ymd(new Date()), calendarId: 'cal-cours' })); });
  const { host } = mount('calendar', store);
  assert.ok(host.querySelector('.mday__ev').textContent.length >= 0);
  assert.ok(host.textContent.includes('Cours X'));
  store.commit((s) => { s.calendars.find((c) => c.id === 'cal-cours').visible = false; });
  const { host: h2 } = mount('calendar', store);
  assert.ok(!h2.textContent.includes('Cours X'));
  const search = h2.querySelector('input[type="search"]');
  search.value = 'cours x'; search.dispatchEvent(new win.Event('input'));
  assert.ok(h2.textContent.includes('Cours X'));
  search.value = '';  search.dispatchEvent(new win.Event('input'));
});

test('agenda : les to-dos et examens apparaissent dans le jour sélectionné', () => {
  const store = createStore(memory());
  store.commit((s) => { s.todos.push(newTodo({ name: 'Rapport', deadline: ymd(new Date()) })); s.courses[0].exam = ymd(new Date()); });
  const { host } = mount('calendar', store);
  assert.ok(byText(host, '.ev--row', 'Rapport'));
  assert.ok(byText(host, '.ev--row', 'Examen'));
});

test('home : salutation, recherche globale, tâches, note du jour', () => {
  const store = createStore(memory());
  store.commit((s) => { s.todos.push(newTodo({ name: 'Devoir immuno' })); });
  const { host } = mount('home', store, { summaries: [{ id: 'a' }] });
  assert.match(host.querySelector('.home__hello').textContent, /Bonjour|Bon après-midi|Bonsoir/);
  assert.match(host.querySelector('.home__clock').textContent, /\d\d:\d\d/);
  assert.ok(host.textContent.includes('1 non lu'));
  const search = host.querySelector('input[type="search"]');
  search.value = 'immuno'; search.dispatchEvent(new win.Event('input'));
  assert.ok(byText(host, '.result', 'Devoir immuno'));
  click(host.querySelector('button[aria-label^="Terminer"]'));
  assert.equal(store.state.todos[0].status, 'Terminés');
  click(byText(host, 'button', 'Note du jour'));
  assert.equal(store.state.notes.length, 1);
  click(byText(host, 'button', 'Note du jour'));
  assert.equal(store.state.notes.length, 1, 'pas de doublon');
});

test('suppression : un cours depuis sa page, un to-do depuis sa carte', () => {
  const store = createStore(memory());
  store.commit((s) => { s.todos.push(newTodo({ name: 'À jeter' })); });
  const { host } = mount('workspace', store);
  click(host.querySelector('.card__del'));
  assert.equal(store.state.todos.length, 0);
  const n = store.state.courses.length;
  click(byText(host, '.course', 'Chimie'));
  click(byText(host, 'button', 'Supprimer le cours'));
  assert.equal(store.state.courses.length, n - 1);
  assert.ok(host.querySelector('.courses'));
});

const { runImport, dataPanel, backupPanel } = await import('../js/ui/data-panel.js');
const { showResult } = await import('../js/modules/focus.js');
const { openTodoDialog } = await import('../js/ui/todo-dialog.js');
const { SECTIONS } = await import('../js/data-io.js');

const toTimer = (host) => click(byText(host, '.seg__btn', 'Concentration'));

test('focus : démarrer, abandonner (arbre mort), statistiques', () => {
  const store = createStore(memory());
  const { host } = mount('focus', store);
  toTimer(host);
  assert.ok(host.querySelector('.focus__globe svg.tree'));
  click(byText(host, '.chipbtn', '45 min'));
  assert.equal(host.querySelector('.focus__clock').textContent, '45:00');
  click(byText(host, 'button', 'Démarrer la concentration'));
  assert.equal(store.state.focusRun.planned, 45);
  const { host: h2 } = mount('focus', store);
  assert.ok(h2.querySelector('.focus__clock').textContent.startsWith('44:') || h2.querySelector('.focus__clock').textContent === '45:00');
  assert.ok(byText(h2, 'button', 'Abandonner'));
  click(byText(h2, 'button', 'Abandonner'));
  assert.equal(store.state.focusRun, null);
  assert.equal(store.state.sessions[0].status, 'failed');
  const { host: h3 } = mount('focus', store);
  assert.ok(h3.textContent.includes('Arbre mort'));
});

test('focus : résultat d\'une réussite et tâche terminée en un clic', () => {
  const store = createStore(memory());
  store.commit((s) => {
    s.todos.push(newTodo({ id: 'td', name: 'Exercices' }));
    s.sessions.push({ id: 's1', start: new Date().toISOString(), planned: 25, actual: 25, status: 'done', tagId: 'tag-etude', title: '', todoId: 'td', eventId: '' });
  });
  showResult(store.state.sessions[0]);
  const { host } = mount('focus', store);
  toTimer(host);
  assert.ok(host.textContent.includes('Arbre planté'));
  click(byText(host, 'button', 'comme terminée'));
  assert.equal(store.state.todos[0].status, 'Terminés');
});

test('focus : statistiques avec des sessions réussies et mortes', () => {
  const store = createStore(memory());
  const at = (h, m = 0) => new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate(), h, m).toISOString();
  store.commit((s) => {
    s.sessions.push(
      { id: 'a', start: at(9), planned: 30, actual: 30, status: 'done', tagId: 'tag-etude', title: '', todoId: '', eventId: '' },
      { id: 'b', start: at(14), planned: 25, actual: 25, status: 'done', tagId: 'tag-travail', title: '', todoId: '', eventId: '' },
      { id: 'c', start: at(16), planned: 25, actual: 4, status: 'failed', tagId: 'tag-travail', title: '', todoId: '', eventId: '' });
  });
  const { host } = mount('focus', store);
  click(byText(host, '.seg__btn', 'Statistiques'));
  const t = host.textContent;
  assert.ok(t.includes('Arbres plantés : 2') && t.includes('Arbres morts : 1'));
  assert.ok(t.includes('55 min'));
  assert.ok(t.includes('Concentration maximale moyenne vers 09:00'));
  assert.equal(host.querySelectorAll('.forest li').length, 3);
  assert.ok(host.querySelector('svg.donut'));
  for (const label of ['Semaine', 'Mois', 'Année']) click(byText(host, '.seg__btn', label));
  assert.ok(host.querySelectorAll('svg.chart').length >= 3);
});

test('focus : gérer les tags', async () => {
  const store = createStore(memory());
  const { host } = mount('focus', store);
  toTimer(host);
  click(byText(host, 'button', 'Gérer les tags'));
  const dlg = document.querySelector('dialog.sheet');
  click(byText(dlg, 'button', '+ Ajouter un tag'));
  const inputs = dlg.querySelectorAll('input[type="text"]');
  inputs[inputs.length - 1].value = 'Maths'; inputs[inputs.length - 1].dispatchEvent(new win.Event('input'));
  await submit(dlg);
  assert.ok(store.state.focusTags.some((t) => t.name === 'Maths'));
});

test('données : import par onglet, refus d\'un autre onglet, formats Hermes', () => {
  const a = createStore(memory());
  a.commit((s) => { s.notes.push(newNote({ title: 'N' })); s.links.push(newLink({ title: 'L', url: 'https://x.org' })); });
  const b = createStore(memory());
  assert.match(runImport(b, 'notes', a.exportSection('notes'), 'merge'), /1 notes/);
  assert.throws(() => runImport(b, 'links', a.exportSection('notes'), 'merge'), /Notes/);
  assert.match(runImport(b, 'messages', '[{"id":"1","source":"gmail","summary":"S"}]', 'merge'), /1 élément importé/);
  assert.equal(b.state.localSummaries.length, 1);
  const { host } = mount('messages', b, { summaries: [] });
  assert.ok(host.textContent.includes('S'));
  assert.match(runImport(b, 'videos', '{"videos":[{"id":"abcdefghijk","title":"V","channel":"C"}]}', 'merge'), /importé/);
  const { host: hv } = mount('videos', b, { videos: { videos: [] } });
  assert.equal(hv.querySelectorAll('.vcard').length, 1);
});

test('données : chaque onglet a son panneau, Home a la sauvegarde de tout', () => {
  const store = createStore(memory());
  const ctx = { store, data: {}, rerender() {} };
  for (const id of Object.keys(SECTIONS)) {
    const p = dataPanel(ctx, id);
    assert.ok(p.textContent.includes(SECTIONS[id].label));
    assert.ok(byText(p, 'button', 'Exporter cet onglet') && byText(p, 'button', 'Importer dans cet onglet'));
  }
  const b = backupPanel(ctx, null);
  assert.ok(byText(b, 'button', 'Tout exporter') && byText(b, 'button', 'Tout importer'));
  assert.equal(b.querySelectorAll('details li').length, Object.keys(SECTIONS).length);
});

test('tâche ↔ événement : planifier une tâche dans l\'agenda', async () => {
  const store = createStore(memory());
  store.commit((s) => { s.todos.push(newTodo({ id: 'td', name: 'Rapport', deadline: '2026-11-05' })); });
  openTodoDialog(store, store.state.todos[0]);
  const dlg = document.querySelector('dialog.sheet');
  click(byText(dlg, 'button', 'Planifier dans l\'agenda'));
  await submit(dlg);
  assert.equal(store.state.events.length, 1);
  assert.equal(store.state.events[0].date, '2026-11-05');
  assert.equal(store.state.todos[0].eventId, store.state.events[0].id);
});

test('tâche ↔ événement : planifier sans deadline est refusé', () => {
  const store = createStore(memory());
  store.commit((s) => { s.todos.push(newTodo({ id: 'td', name: 'Sans date' })); });
  openTodoDialog(store, store.state.todos[0]);
  const dlg = document.querySelector('dialog.sheet');
  click(byText(dlg, 'button', 'Planifier dans l\'agenda'));
  assert.match(dlg.textContent, /Choisis d'abord une deadline/);
  assert.equal(store.state.events.length, 0);
  dlg.close();
});

test('événement : plusieurs tâches et notes liées (créer, lier, délier, supprimer)', async () => {
  const store = createStore(memory());
  store.commit((s) => {
    s.events.push(newEvent({ id: 'e1', title: 'TP chimie', date: '2026-11-03' }));
    s.todos.push(newTodo({ id: 't9', name: 'Existante' })); s.notes.push(newNote({ id: 'n9', title: 'Vieille note' }));
  });
  const { host } = mount('calendar', store);
  const dlgOpen = () => document.querySelector('dialog.sheet');
  const { openEventDialog } = await import('../js/modules/calendar.js');
  openEventDialog({ store, rerender() {} }, store.state.events[0]);
  let dlg = dlgOpen();
  assert.ok(dlg.textContent.includes('Tâches liées (0)') && dlg.textContent.includes('Notes liées (0)'));
  const task = dlg.querySelector('input[aria-label="Nouvelle tâche"]');
  task.value = 'Préparer le matériel';
  click(byText(dlg, 'button', 'Ajouter'));
  assert.equal(store.state.todos.filter((t) => t.eventId === 'e1').length, 1);
  assert.equal(store.state.todos.find((t) => t.name === 'Préparer le matériel').deadline, '2026-11-03');
  const linkSel = dlg.querySelector('select[aria-label="Lier une tâche existante…"]');
  linkSel.value = 't9'; linkSel.dispatchEvent(new win.Event('change'));
  assert.equal(store.state.todos.filter((t) => t.eventId === 'e1').length, 2);
  click(byText(dlg, 'button', '+ Nouvelle note pour cet événement'));
  const noteSel = dlg.querySelector('select[aria-label="Lier une note existante…"]');
  noteSel.value = 'n9'; noteSel.dispatchEvent(new win.Event('change'));
  assert.equal(store.state.notes.filter((n) => n.eventId === 'e1').length, 2);
  assert.ok(dlg.textContent.includes('Tâches liées (2)') && dlg.textContent.includes('Notes liées (2)'));
  click(byText(dlg, 'button', 'Délier'));
  assert.equal(store.state.todos.filter((t) => t.eventId === 'e1').length, 1);
  const { host: h2 } = mount('calendar', store);
  dlg.close();
  const del = (() => { openEventDialog({ store, rerender() {} }, store.state.events[0]); return byText(dlgOpen(), 'button', 'Supprimer'); })();
  click(del);
  assert.equal(store.state.events.length, 0);
  assert.ok(store.state.todos.every((t) => t.eventId === ''));
  assert.ok(host && h2);
});

test('notes : une note peut être rattachée à un événement', () => {
  const store = createStore(memory());
  store.commit((s) => { s.events.push(newEvent({ id: 'e1', title: 'Réunion', date: '2026-11-03' })); s.notes.push(newNote({ title: 'Compte rendu' })); });
  const { host } = mount('notes', store);
  const sel = [...host.querySelectorAll('.note select')].at(-1);
  assert.ok([...sel.options].some((o) => o.value === 'e1'));
  sel.value = 'e1'; sel.dispatchEvent(new win.Event('change'));
  assert.equal(store.state.notes[0].eventId, 'e1');
});
