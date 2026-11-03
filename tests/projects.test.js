import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setupDOM, memory } from './helpers/dom.js';
const win = setupDOM();
const { createStore, newTodo, newProject, sanitizeState, removeProject, removeCourse } = await import('../js/store.js');
const { projectStats } = await import('../js/modules/projects.js');
const { SECTIONS } = await import('../js/data-io.js');
const { filterTodos } = await import('../js/kanban.js');
const { TABS } = await import('../js/app.js');

const todo = (id, p = {}) => newTodo({ id, name: id, ...p });
const click = (el) => el.dispatchEvent(new win.Event('click', { bubbles: true }));
const byText = (root, sel, text) => [...root.querySelectorAll(sel)].find((e) => e.textContent.includes(text));
const mountWs = (store) => {
  const mod = TABS.find(([k]) => k === 'workspace')[2];
  const host = document.createElement('div'); const ctx = { store, data: {}, rerender: () => host.replaceChildren(mod.render(ctx)) }; ctx.rerender();
  store.subscribe(() => ctx.rerender());
  return { host, ctx };
};

test('sanitizeState : projets validés, projectId inconnu vidé, anciennes sauvegardes sans projets', () => {
  const s = sanitizeState({
    projects: [{ id: 'p1', name: '', color: 'neon', deadline: 'bientôt', archived: 1 }, { id: 'p2', name: 'Dossier', color: 'teal', deadline: '2026-12-01', archived: true }],
    todos: [{ id: 't1', projectId: 'p2' }, { id: 't2', projectId: 'fantome' }],
  });
  assert.deepEqual(s.projects[0], { id: 'p1', name: 'Projet', courseId: '', deadline: '', color: 'blue', archived: false });
  assert.deepEqual([s.projects[1].color, s.projects[1].deadline, s.projects[1].archived], ['teal', '2026-12-01', true]);
  assert.deepEqual(s.todos.map((t) => t.projectId), ['p2', '']);
  assert.deepEqual(sanitizeState({ todos: [{ id: 'old' }] }).projects, []);
});

test('removeProject conserve les tâches ; removeCourse vide le cours des projets', () => {
  const st = { projects: [newProject({ id: 'p', courseId: 'c' })], todos: [todo('a', { projectId: 'p' })], courses: [{ id: 'c' }], notes: [] };
  removeCourse(st, 'c');
  assert.equal(st.projects[0].courseId, '');
  removeProject(st, 'p');
  assert.deepEqual([st.projects.length, st.todos[0].projectId], [0, '']);
});

test('projectStats : moyenne des tâches de niveau 1, compte des tâches terminées', () => {
  const p = newProject({ id: 'p' });
  const list = [todo('a', { projectId: 'p', status: 'Terminés' }), todo('b', { projectId: 'p' }), todo('c', { projectId: 'p', parentId: 'b', status: 'Terminés' }), todo('d', { projectId: 'p' }), todo('x')];
  list[2].parentId = 'b';
  const st = projectStats(p, list);
  assert.deepEqual([st.done, st.total], [1, 3]);
  assert.equal(Math.round(st.ratio * 100), 67, '(1 + 1 + 0) / 3 : b est terminée à 100 % par sa seule sous-tâche');
  assert.deepEqual(projectStats(newProject({ id: 'vide' }), list), { ratio: 0, done: 0, total: 0 });
});

test('filterTodos par projet', () => {
  const list = [todo('a', { projectId: 'p' }), todo('b'), todo('c', { projectId: 'q' })];
  assert.deepEqual(filterTodos(list, { projectId: 'p' }).map((t) => t.id), ['a']);
  assert.equal(filterTodos(list, {}).length, 3);
});

test('projets : suppression avec marqueur, et un projet supprimé ailleurs ne revient pas à la fusion', () => {
  const store = createStore(memory());
  store.commit((s) => { s.projects.push(newProject({ id: 'p', name: 'Dossier' })); });
  const before = store.exportSection('workspace');
  store.commit((s) => removeProject(s, 'p'));
  assert.ok(store.state.tombstones.projects.p);
  store.importFile(before, { mode: 'merge' });
  assert.equal(store.state.projects.length, 0, 'le marqueur de suppression l\'emporte');
});

test('export / import de l\'onglet Workspace : les projets voyagent avec les cours et les to-dos', () => {
  assert.ok(SECTIONS.workspace.keys.includes('projects'));
  const a = createStore(memory());
  a.commit((s) => { s.projects.push(newProject({ id: 'p', name: 'Partiel', color: 'red' })); s.todos.push(todo('t', { projectId: 'p' })); });
  const b = createStore(memory());
  b.importFile(a.exportSection('workspace'), { mode: 'merge', only: 'workspace' });
  assert.deepEqual([b.state.projects[0].name, b.state.todos[0].projectId], ['Partiel', 'p']);
  // un ancien fichier sans « projects » ne vide pas les projets existants
  const old = JSON.stringify({ app: 'student-hub', kind: 'section', section: 'workspace', version: 1, data: { courses: [], todos: [] } });
  b.importFile(old, { mode: 'merge', only: 'workspace' });
  assert.equal(b.state.projects.length, 1);
});

test('Workspace : le sélecteur Tableau / Projets / Rapports existe, sans nouvel onglet', () => {
  const store = createStore(memory());
  const { host } = mountWs(store);
  assert.deepEqual([...host.querySelectorAll('.seg__btn')].map((b) => b.textContent), ['Tableau', 'Projets', 'Rapports']);
  assert.equal(TABS.length, 12, 'toujours 12 onglets');
  click(byText(host, '.seg__btn', 'Projets'));
  assert.ok(host.textContent.includes('Aucun projet.'));
  click(byText(host, '.seg__btn', 'Tableau'));
  assert.ok(byText(host, '.course', 'Physique'));
});

test('Projets : créer un projet, y ajouter un to-do, voir l\'avancement et l\'ordre conseillé', async () => {
  const store = createStore(memory());
  const { host } = mountWs(store);
  click(byText(host, '.seg__btn', 'Projets'));
  click(byText(host, 'button', '+ Nouveau projet'));
  const dlg = [...document.querySelectorAll('dialog')].pop();
  dlg.querySelector('input[type=text]').value = 'Dossier d\'informatique';
  dlg.querySelector('form').dispatchEvent(new win.Event('submit', { bubbles: true, cancelable: true }));
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(store.state.projects.length, 1);
  const pid = store.state.projects[0].id;
  assert.ok(host.querySelector('input[aria-label="Nom du projet"]'), 'la page du projet s\'ouvre');
  store.commit((s) => { s.todos.push(todo('a', { name: 'Plan', projectId: pid, status: 'Terminés' }), todo('b', { name: 'Rédaction', projectId: pid, blockedBy: ['a'] }), todo('c', { name: 'Hors projet' })); });
  assert.ok(host.textContent.includes('1 tâche terminée sur 2'));
  assert.ok(host.textContent.includes('Rédaction') && !host.textContent.includes('Hors projet'), 'le kanban est filtré par projet');
  store.commit((s) => { s.todos[0].status = 'A faire'; s.todos[0].doneAt = ''; });
  assert.ok(host.textContent.includes('Ordre conseillé'));
  assert.ok(host.querySelector('.order').textContent.includes('après Plan'));
  click(byText(host, 'button', '← Projets'));
  assert.ok(host.querySelector('progress[aria-label^="Avancement"]'));
});

test('Projets : archivés repliés dans la liste', () => {
  const store = createStore(memory());
  store.commit((s) => { s.projects.push(newProject({ id: 'a', name: 'Actif' }), newProject({ id: 'b', name: 'Ancien', archived: true })); });
  const { host } = mountWs(store);
  click(byText(host, '.seg__btn', 'Projets'));
  assert.ok(host.textContent.includes('Archivés (1)'));
  assert.equal(host.querySelectorAll('details > ul > li').length, 1);
});
