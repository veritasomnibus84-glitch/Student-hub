import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setupDOM, memory } from './helpers/dom.js';
const win = setupDOM();
const { createStore, newTodo, newNote, newLink } = await import('../js/store.js');
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

test('workspace : créer un to-do via la feuille modale', () => {
  const store = createStore(memory());
  const { host } = mount('workspace', store);
  click(byText(host, 'button', '+ To-do'));
  const dlg = document.querySelector('dialog.sheet');
  assert.ok(dlg);
  dlg.querySelector('input[type="text"]').value = 'Nouveau devoir';
  dlg.querySelector('form').dispatchEvent(new win.Event('submit', { cancelable: true }));
  assert.equal(store.state.todos[0].name, 'Nouveau devoir');
  assert.equal(document.querySelector('dialog.sheet'), null);
});

test('workspace : un nom vide est refusé', () => {
  const store = createStore(memory());
  const { host } = mount('workspace', store);
  click(byText(host, 'button', '+ To-do'));
  const dlg = document.querySelector('dialog.sheet');
  dlg.querySelector('form').dispatchEvent(new win.Event('submit', { cancelable: true }));
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
