// Actions sur un to-do partagées par Workspace, Home, Agenda et Focus : changer le statut, supprimer, ajouter une sous-tâche.
import { newTodo } from '../store.js';
import { setStatus, openChildren, children, removeTodo, inheritFromParent, DONE } from '../tasks-logic.js';
import { blockers, isBlocked, dependents, indexById } from '../deps-logic.js';
import { showToast } from '../reminders.js';

const plural = (n, one, many) => (n > 1 ? many : one);

const names = (list) => list.map((b) => `« ${b.name || 'Sans titre'} »`).join(', ');

// Change le statut. Démarrer ou terminer une tâche bloquée demande confirmation (refusé en mode strict) ;
// terminer un parent qui a des sous-tâches ouvertes demande de les terminer aussi (Annuler : rien ne change).
export function changeStatus(store, todo, status, { silent = false } = {}) {
  const { todos } = store.state;
  if ((status === 'En cours' || status === DONE) && todo.status !== status) {
    const waiting = blockers(todo, indexById(todos));
    if (waiting.length) {
      if (store.state.settings.work.strictDeps) { showToast(`Bloquée par ${names(waiting)} : termine d'abord ce blocage.`); return false; }
      if (!confirm(`Cette tâche attend ${names(waiting)}. La ${status === DONE ? 'terminer' : 'démarrer'} quand même ?`)) return false;
    }
  }
  let cascade = false;
  const open = status === DONE ? openChildren(todos, todo.id) : [];
  if (open.length) {
    if (!confirm(`Terminer aussi ${open.length} ${plural(open.length, 'sous-tâche', 'sous-tâches')} ?`)) return false;
    cascade = true;
  }
  const waitingBefore = status === DONE ? dependents(todos, todo.id).filter((d) => isBlocked(d, indexById(todos))) : [];
  store.commit((st) => { setStatus(st, todo.id, status, { cascade }); }, { silent });
  const byId = indexById(store.state.todos);
  const freed = waitingBefore.filter((d) => !isBlocked(d, byId));
  if (freed.length) showToast(`Débloque : ${names(freed)}`);
  return true;
}

// Supprime un to-do ; s'il a des sous-tâches, demande si on les supprime aussi (sinon elles deviennent des tâches à part entière).
export function deleteTodo(store, todo, { confirmed = false } = {}) {
  if (!confirmed && !confirm(`Supprimer le to-do « ${todo.name || 'Sans titre'} » ?`)) return false;
  const kids = children(store.state.todos, todo.id).length;
  const cascade = kids > 0 && confirm(`Supprimer aussi ${kids} ${plural(kids, 'sous-tâche', 'sous-tâches')} ? (Annuler : elles sont conservées.)`);
  store.commit((st) => { removeTodo(st, todo.id, { cascade }); });
  return true;
}

// Ajoute une sous-tâche : elle hérite du cours (et du projet) du parent.
export function addSubtask(store, parent, name) {
  const title = String(name ?? '').trim();
  if (!title) return false;
  store.commit((st) => { st.todos.push(newTodo({ ...inheritFromParent(parent), name: title.slice(0, 300) })); });
  return true;
}
