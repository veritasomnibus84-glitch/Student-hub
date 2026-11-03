// Dépendances entre tâches (logique pure). « X.blockedBy = [Y] » signifie : Y doit être fini avant X.
import { isDone } from './tasks-logic.js';

export const MAX_BLOCKERS = 20;
export const indexById = (todos) => new Map(todos.map((t) => [t.id, t]));
const ids = (t) => (Array.isArray(t.blockedBy) ? t.blockedBy : []);

// Tâches non terminées qui bloquent encore `t` (les siennes, puis celles de son parent).
export function blockers(t, byId) {
  const own = ids(t).map((b) => byId.get(b)).filter((b) => b && !isDone(b));
  const parent = t.parentId ? byId.get(t.parentId) : null;
  const inherited = parent && !isDone(parent) ? blockers(parent, byId).filter((b) => !own.includes(b)) : [];
  return [...own, ...inherited];
}
export const isBlocked = (t, byId) => blockers(t, byId).length > 0;

// Tâches non terminées qui attendent `id` (dépendances directes).
export const dependents = (todos, id) => todos.filter((t) => !isDone(t) && ids(t).includes(id));

// En partant de `from` et en suivant « bloquée par », atteint-on `target` ?
function reaches(from, target, byId) {
  const seen = new Set(); const stack = [from];
  while (stack.length) {
    const cur = stack.pop();
    if (cur === target) return true;
    if (seen.has(cur)) continue;
    seen.add(cur);
    const t = byId.get(cur);
    if (t) stack.push(...ids(t));
  }
  return false;
}

// Ajouter « x bloquée par y » crée-t-il une boucle ? (oui si y dépend déjà de x, directement ou non)
export const wouldCycle = (todos, x, y) => x === y || reaches(y, x, indexById(todos));

// Message d'erreur (vide si le lien est permis).
export function checkBlock(todos, x, y) {
  if (x === y) return 'Une tâche ne peut pas se bloquer elle-même.';
  const a = todos.find((t) => t.id === x); const b = todos.find((t) => t.id === y);
  if (b && (b.parentId === x || a?.parentId === y)) return 'Une tâche et sa sous-tâche ne se bloquent pas entre elles.';
  if (reaches(y, x, indexById(todos))) return 'Cela créerait une boucle : cette tâche attend déjà l\'autre.';
  if (a && ids(a).length >= MAX_BLOCKERS && !ids(a).includes(y)) return `${MAX_BLOCKERS} blocages au maximum par tâche.`;
  return '';
}

// Lecture d'une sauvegarde (ou fusion de deux appareils) : retire les liens inutiles et coupe les boucles.
// Ordre fixe du tableau : le lien qui ferme la boucle est abandonné, avec le même résultat sur tous les appareils.
export function breakCycles(todos) {
  const exist = new Map(todos.map((t) => [t.id, t]));
  const graph = new Map(todos.map((t) => [t.id, { id: t.id, blockedBy: [] }]));
  return todos.map((t) => {
    const kept = [];
    for (const b of new Set(ids(t))) {
      const other = exist.get(b);
      if (!other || b === t.id || kept.length >= MAX_BLOCKERS) continue;
      if (other.parentId === t.id || t.parentId === b) continue; // parent ↔ sous-tâche
      if (reaches(b, t.id, graph)) continue; // fermerait une boucle
      kept.push(b); graph.get(t.id).blockedBy.push(b);
    }
    return { ...t, blockedBy: kept };
  });
}

const byDeadline = (a, b) => (a.deadline || '9999-99-99').localeCompare(b.deadline || '9999-99-99');

// Tâches à faire maintenant : non terminées, non bloquées, sans sous-tâche ouverte ; les plus urgentes d'abord, puis celles qui en débloquent le plus.
export function ready(todos) {
  const byId = indexById(todos);
  const hasOpenKids = new Set(todos.filter((t) => t.parentId && !isDone(t)).map((t) => t.parentId));
  return todos.filter((t) => !isDone(t) && t.status !== 'Sans statut' && !hasOpenKids.has(t.id) && !isBlocked(t, byId))
    .map((t) => ({ t, n: dependents(todos, t.id).length }))
    .sort((a, b) => byDeadline(a.t, b.t) || b.n - a.n || a.t.name.localeCompare(b.t.name))
    .map((x) => x.t);
}

// Plus tôt possible pour commencer : la plus tardive des deadlines des blocages non terminés ('' si aucune).
export function earliestStart(t, byId) {
  return blockers(t, byId).map((b) => b.deadline).filter(Boolean).sort().pop() ?? '';
}

// Incohérences de dates : une tâche due AVANT un de ses blocages.
export function conflicts(todos) {
  const byId = indexById(todos); const out = [];
  for (const t of todos) {
    if (isDone(t) || !t.deadline) continue;
    for (const b of ids(t)) {
      const other = byId.get(b);
      if (other && !isDone(other) && other.deadline && t.deadline < other.deadline) out.push({ todo: t, blocker: other });
    }
  }
  return out;
}

// Ordre conseillé (tri topologique, algorithme de Kahn) : les blocages avant les tâches qui en dépendent, puis par deadline.
export function topoOrder(list) {
  const inList = new Map(list.map((t, i) => [t.id, { t, i }]));
  const left = new Map(list.map((t) => [t.id, ids(t).filter((b) => inList.has(b) && b !== t.id).length]));
  const order = []; const done = new Set();
  const pick = () => [...left.entries()].filter(([id, n]) => n === 0 && !done.has(id)).map(([id]) => inList.get(id))
    .sort((a, b) => byDeadline(a.t, b.t) || a.i - b.i)[0];
  for (let next = pick(); next; next = pick()) {
    order.push(next.t); done.add(next.t.id);
    for (const t of list) if (!done.has(t.id) && ids(t).includes(next.t.id)) left.set(t.id, left.get(t.id) - 1);
  }
  for (const t of list) if (!done.has(t.id)) order.push(t); // sécurité : une boucle résiduelle n'est jamais perdue
  return order;
}
