// Menu contextuel : clic droit (ordinateur), appui long de 500 ms (téléphone) ou bouton « ⋯ ». Aucun innerHTML.
import { h } from '../dom.js';
import { showToast } from '../reminders.js';

let current = null;
export function closeMenu() { if (current) { current(); current = null; } }

export function openMenu(items, x = 0, y = 0) {
  closeMenu();
  const list = items.filter(Boolean);
  if (!list.length) return;
  const menu = h('div', { class: 'ctx', role: 'menu', 'aria-label': 'Actions' }, list.map((it) => h('button', {
    type: 'button', role: 'menuitem', class: `ctx__item ${it.danger ? 'is-danger' : ''}`.trim(),
    onclick: () => { closeMenu(); it.onSelect(); },
  }, it.label)));
  document.body.append(menu);
  const box = menu.getBoundingClientRect();
  menu.style.left = `${Math.max(4, Math.min(x, window.innerWidth - box.width - 4))}px`;
  menu.style.top = `${Math.max(4, Math.min(y, window.innerHeight - box.height - 4))}px`;
  const items$ = [...menu.querySelectorAll('button')];
  const onDown = (e) => { if (!menu.contains(e.target)) closeMenu(); };
  const onKey = (e) => {
    if (e.key === 'Escape') { closeMenu(); return; }
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    e.preventDefault();
    const i = items$.indexOf(document.activeElement);
    items$[(i + (e.key === 'ArrowDown' ? 1 : -1) + items$.length) % items$.length].focus();
  };
  document.addEventListener('pointerdown', onDown, true);
  document.addEventListener('keydown', onKey);
  window.addEventListener('scroll', closeMenu, true);
  window.addEventListener('resize', closeMenu);
  items$[0].focus();
  current = () => {
    document.removeEventListener('pointerdown', onDown, true); document.removeEventListener('keydown', onKey);
    window.removeEventListener('scroll', closeMenu, true); window.removeEventListener('resize', closeMenu);
    menu.remove();
  };
}

// Clic droit + appui long sur un élément. getItems est appelée à l'ouverture (les actions suivent l'état du moment).
export function attachMenu(el, getItems) {
  el.classList.add('has-menu');
  el.addEventListener('contextmenu', (e) => { e.preventDefault(); openMenu(getItems(), e.clientX, e.clientY); });
  let timer = 0; let fired = false; let sx = 0; let sy = 0;
  const stop = () => clearTimeout(timer);
  el.addEventListener('pointerdown', (e) => {
    fired = false;
    if (e.pointerType === 'mouse') return;
    sx = e.clientX; sy = e.clientY;
    timer = setTimeout(() => { fired = true; openMenu(getItems(), sx, sy); }, 500);
  });
  el.addEventListener('pointermove', (e) => { if (Math.hypot(e.clientX - sx, e.clientY - sy) > 10) stop(); });
  ['pointerup', 'pointercancel', 'pointerleave'].forEach((t) => el.addEventListener(t, stop));
  el.addEventListener('click', (e) => { if (fired) { e.preventDefault(); e.stopPropagation(); fired = false; } }, true); // le clic qui suit l'appui long ne doit rien ouvrir
  return el;
}

// Petit bouton « ⋯ » pour ceux qui n'ont ni clic droit ni appui long.
export function menuButton(getItems, label = 'Actions') {
  return h('button', {
    type: 'button', class: 'btn btn--ghost menu-btn', 'aria-label': label, 'aria-haspopup': 'menu',
    onclick: (e) => { e.stopPropagation(); const r = e.currentTarget.getBoundingClientRect(); openMenu(getItems(), r.left, r.bottom); },
  }, '⋯');
}

export async function copyText(text) {
  try { await navigator.clipboard.writeText(String(text)); showToast('Copié.'); } catch { showToast('Copie impossible sur ce navigateur.'); }
}
export const copyItem = (text, label = 'Copier le texte') => ({ label, onSelect: () => copyText(text) });
export const deleteItem = (what, run) => ({ label: 'Supprimer', danger: true, onSelect: () => { if (confirm(`Supprimer ${what} ?`)) run(); } });
