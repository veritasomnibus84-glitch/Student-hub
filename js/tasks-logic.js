// Sous-tâches, progression et règles de statut (logique pure, sans navigateur).
import { STATUSES } from './constants.js';
import { todayISO } from './kanban.js';

export const DONE = 'Terminés';
export const MAX_EFFORT = 6000;

export const isDone = (t) => t?.status === DONE;
export const children = (todos, id) => todos.filter((t) => t.parentId === id);
export const projectTodos = (todos, projectId) => todos.filter((t) => t.projectId === projectId);

// Un seul niveau : le parent n'a pas de parent, et une tâche qui a des enfants ne devient pas enfant.
export function canNest(todos, id, parentId) {
  if (!parentId) return true; // détacher est toujours permis
  if (id === parentId) return false;
  const parent = todos.find((t) => t.id === parentId);
  if (!parent || parent.parentId) return false;
  return children(todos, id).length === 0;
}

// Parents possibles pour une tâche (menu « Sous-tâche de »).
export const parentChoices = (todos, id) => todos.filter((t) => !t.parentId && t.id !== id && canNest(todos, id, t.id));

// Compte « faites / total » des sous-tâches d'une tâche (null si elle n'en a pas).
export function subCounts(todo, todos) {
  const kids = children(todos, todo.id);
  return kids.length ? { done: kids.filter(isDone).length, total: kids.length } : null;
}

// Avancement d'une tâche, de 0 à 1 : part des sous-tâches faites, ou 1 / 0 sans sous-tâche.
export function itemProgress(todo, todos) {
  const c = subCounts(todo, todos);
  if (c) return c.done / c.total;
  return isDone(todo) ? 1 : 0;
}

// Moyenne à poids égal des tâches de niveau 1 de `list` : les sous-tâches ne comptent jamais en plus de leur parent.
export function rollup(list, todos) {
  const top = list.filter((t) => !t.parentId);
  if (!top.length) return 0;
  return top.reduce((n, t) => n + itemProgress(t, todos), 0) / top.length;
}

const autoClose = (state) => state.settings?.work?.autoCloseParent !== false;

// Change le statut d'une tâche et tient `doneAt` à jour. Renvoie les identifiants modifiés.
// `cascade` : en terminant un parent, termine aussi ses sous-tâches.
export function setStatus(state, id, status, { today = todayISO(), cascade = false } = {}) {
  const t = state.todos.find((x) => x.id === id);
  if (!t || !STATUSES.includes(status)) return [];
  const changed = [];
  const apply = (x, s) => {
    if (x.status === s) return;
    x.status = s; x.doneAt = s === DONE ? today : ''; changed.push(x.id);
  };
  apply(t, status);
  if (cascade && status === DONE) children(state.todos, t.id).forEach((c) => apply(c, DONE));
  const parent = t.parentId ? state.todos.find((x) => x.id === t.parentId) : null;
  const kids = parent ? children(state.todos, parent.id) : [];
  if (parent && kids.length) {
    const all = kids.every(isDone);
    if (all && !isDone(parent) && autoClose(state)) apply(parent, DONE);
    else if (!all && isDone(parent)) apply(parent, 'En cours');
  }
  return changed;
}

// Sous-tâches pas encore terminées (pour demander « Terminer aussi… ? »).
export const openChildren = (todos, id) => children(todos, id).filter((c) => !isDone(c));

// Nouvelle sous-tâche : hérite du cours (et du projet) du parent, garde sa propre deadline.
export function inheritFromParent(parent) {
  return { parentId: parent.id, courseId: parent.courseId, projectId: parent.projectId ?? '' };
}

// Supprime une tâche. Ses sous-tâches sont supprimées (`cascade`) ou deviennent des tâches de niveau 1.
export function removeTodo(state, id, { cascade = false } = {}) {
  const ids = new Set([id]);
  if (cascade) children(state.todos, id).forEach((c) => ids.add(c.id));
  else state.todos.forEach((t) => { if (t.parentId === id) t.parentId = ''; });
  state.todos = state.todos.filter((t) => !ids.has(t.id));
  state.todos.forEach((t) => { if (Array.isArray(t.blockedBy)) t.blockedBy = t.blockedBy.filter((b) => !ids.has(b)); });
  return ids.size;
}

// Lecture d'une sauvegarde : un parent doit exister, ne pas être lui-même une sous-tâche, et ne pas être la tâche elle-même.
export function fixParents(todos) {
  const ids = new Set(todos.map((t) => t.id));
  const rawParent = new Map(todos.map((t) => [t.id, ids.has(t.parentId) && t.parentId !== t.id ? t.parentId : '']));
  return todos.map((t) => {
    const p = rawParent.get(t.id);
    return { ...t, parentId: p && !rawParent.get(p) ? p : '' };
  });
}
