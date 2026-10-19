import { h } from './dom.js';
import { dueReminders } from './calendar-logic.js';

function notify(r) {
  const text = r.start ? `${r.title} à ${r.start} (dans ${r.minutes} min)` : `${r.title} aujourd'hui`;
  if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
    try { new Notification('Student Hub', { body: text }); } catch { /* certains mobiles l'interdisent : le message en page reste */ }
  }
  const toast = h('div', { class: 'toast', role: 'status' }, h('span', null, text),
    h('button', { class: 'btn btn--ghost', 'aria-label': 'Fermer le rappel', onclick: () => toast.remove() }, '×'));
  document.body.append(toast);
  setTimeout(() => toast.remove(), 15000);
}

// Vérifie les rappels toutes les 30 s tant que l'app est ouverte.
export function startReminders(store) {
  const done = new Set();
  const tick = () => { for (const r of dueReminders(store.state, new Date(), done)) { done.add(r.key); notify(r); } };
  tick();
  return setInterval(tick, 30000);
}
