import { h, field } from '../dom.js';
import { makeLock, verifyLock, saveLock, clearLock } from '../lock.js';
import { openSheet } from './dialog.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function showLockScreen(root, lock, { onUnlock, onForgot }) {
  let tries = 0;
  const name = h('input', { type: 'text', autocomplete: 'username', required: true, autocapitalize: 'none' });
  const pass = h('input', { type: 'password', autocomplete: 'current-password', required: true });
  const err = h('p', { class: 'error', role: 'alert' });
  const form = h('form', {
    class: 'lock__form',
    onsubmit: async (e) => {
      e.preventDefault(); err.textContent = '';
      if (await verifyLock(lock, name.value, pass.value)) { onUnlock(); return; }
      tries += 1; err.textContent = 'Nom ou mot de passe incorrect.'; pass.value = '';
      await sleep(Math.min(5000, tries * 700));
    },
  }, field('Nom', name), field('Mot de passe', pass), err, h('button', { type: 'submit', class: 'btn btn--primary' }, 'Entrer'));
  root.replaceChildren(h('main', { class: 'lock' },
    h('img', { src: 'assets/logo.svg', alt: '', width: 64, height: 64 }), h('h1', { class: 'page-title' }, 'Student Hub'), form,
    h('button', {
      class: 'linkish', onclick: () => {
        if (confirm('Effacer le verrou ET toutes les données de cet appareil ?')) onForgot();
      },
    }, 'Mot de passe oublié ?')));
  name.focus();
}

// Définir, changer ou retirer le verrou (demande l'ancien mot de passe s'il existe).
export function manageLock(storage, current, onDone) {
  const name = h('input', { type: 'text', value: current?.name ?? '', autocomplete: 'username', required: true, autocapitalize: 'none' });
  const old = h('input', { type: 'password', autocomplete: 'current-password' });
  const pass = h('input', { type: 'password', autocomplete: 'new-password' });
  const again = h('input', { type: 'password', autocomplete: 'new-password' });
  const body = h('div', { class: 'stack' },
    h('p', { class: 'muted' }, 'Ce verrou cache l\'app derrière un écran de connexion sur cet appareil. Il ne chiffre pas tes données : il protège d\'un regard curieux, pas d\'un expert.'),
    current && field('Mot de passe actuel', old), field('Nom', name),
    field(current ? 'Nouveau mot de passe (vide = retirer le verrou)' : 'Mot de passe (6 caractères minimum)', pass), field('Confirmer', again));
  openSheet(current ? 'Verrou d\'accès' : 'Définir un verrou', body, {
    onSubmit: async () => {
      if (current && !(await verifyLock(current, current.name, old.value))) return 'Mot de passe actuel incorrect.';
      if (current && pass.value === '') { clearLock(storage); onDone(null); return ''; }
      if (!name.value.trim()) return 'Le nom est obligatoire.';
      if (pass.value.length < 6) return 'Le mot de passe doit faire au moins 6 caractères.';
      if (pass.value !== again.value) return 'Les deux mots de passe sont différents.';
      const lock = await makeLock(name.value, pass.value);
      saveLock(storage, lock); onDone(lock);
      return '';
    },
  });
}
