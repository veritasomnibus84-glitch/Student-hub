import { h } from '../dom.js';

// Feuille modale native (<dialog>) : focus piégé, Échap pour fermer, retire le noeud à la fermeture.
export function openSheet(title, body, { onSubmit, submitLabel = 'Enregistrer', extra = null } = {}) {
  const error = h('p', { class: 'error', role: 'alert' });
  const dlg = h('dialog', { class: 'sheet', 'aria-label': title });
  const form = h('form', {
    class: 'sheet__form',
    onsubmit: async (e) => {
      e.preventDefault();
      error.textContent = '';
      const msg = await onSubmit?.();
      if (msg) { error.textContent = msg; return; }
      dlg.close();
    },
  },
  h('h2', { class: 'sheet__title' }, title), body, error,
  h('div', { class: 'row end' },
    extra,
    h('button', { type: 'button', class: 'btn', onclick: () => dlg.close() }, 'Annuler'),
    h('button', { type: 'submit', class: 'btn btn--primary' }, submitLabel)));
  dlg.append(form);
  dlg.addEventListener('close', () => dlg.remove());
  document.body.append(dlg);
  dlg.showModal();
  return dlg;
}
