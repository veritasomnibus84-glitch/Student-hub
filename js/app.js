import { h } from './dom.js';
import { createStore } from './store.js';
import { STORAGE_KEY } from './constants.js';
import { loadLock, clearLock, isUnlocked, markUnlocked, markLocked } from './lock.js';
import { showLockScreen, manageLock } from './ui/lock-screen.js';
import { startReminders } from './reminders.js';
import * as home from './modules/home.js';
import * as calendar from './modules/calendar.js';
import * as workspace from './modules/workspace.js';
import * as library from './modules/library.js';
import * as messages from './modules/messages.js';
import * as videos from './modules/videos.js';
import * as notes from './modules/notes.js';
import * as links from './modules/links.js';

// Ajouter un onglet = un module (render(ctx) -> Element) + une ligne ici.
export const TABS = [
  ['home', 'Home', home], ['workspace', 'Workspace', workspace], ['calendar', 'Agenda', calendar], ['library', 'Biblio', library], ['messages', 'Messages', messages],
  ['videos', 'Vidéos', videos], ['notes', 'Notes', notes], ['links', 'Liens', links],
];

async function loadJSON(path, fallback) {
  try {
    const r = await fetch(path, { cache: 'no-cache' });
    return r.ok ? await r.json() : fallback;
  } catch { return fallback; }
}

export async function start(root, storage = localStorage, session = sessionStorage) {
  let lock = loadLock(storage);
  if (lock && !isUnlocked(session)) {
    await new Promise((resolve) => showLockScreen(root, lock, {
      onUnlock: () => { markUnlocked(session); resolve(); },
      onForgot: () => { clearLock(storage); storage.removeItem(STORAGE_KEY); markLocked(session); lock = null; resolve(); },
    }));
  }
  const store = createStore(storage);
  const data = {
    summaries: await loadJSON('data/summaries.json', []),
    videos: await loadJSON('data/videos.json', { videos: [] }),
  };
  const ctx = { store, data, rerender: () => draw() };
  const main = h('main', { id: 'main', tabindex: '-1' });
  const nav = h('nav', { class: 'nav', 'aria-label': 'Sections' });
  const status = h('p', { class: 'muted', role: 'status' });
  let toolsOpen = false;

  const current = () => (TABS.find(([k]) => k === location.hash.slice(1)) ?? TABS[0]);

  function draw() {
    const [key, , mod] = current();
    nav.replaceChildren(...TABS.map(([k, label]) => h('a', { href: `#${k}`, 'aria-current': k === key ? 'page' : null }, label)));
    main.replaceChildren(mod.render(ctx), dataTools());
  }

  function dataTools() {
    const file = h('input', {
      type: 'file', accept: 'application/json', class: 'visually-hidden', 'aria-label': 'Importer un fichier JSON',
      onchange: async (e) => {
        const f = e.target.files[0]; if (!f) return;
        try { store.importJSON(await f.text()); status.textContent = 'Import réussi.'; } catch { status.textContent = 'Fichier invalide : rien n\'a été modifié.'; }
      },
    });
    return h('details', { class: 'tools', open: toolsOpen, ontoggle: (e) => { toolsOpen = e.target.open; } }, h('summary', null, 'Données'),
      h('div', { class: 'row wrap' },
        h('button', { class: 'btn', onclick: () => manageLock(storage, lock, (l) => { lock = l; markUnlocked(session); draw(); }) }, lock ? 'Verrou…' : 'Définir un verrou'),
        lock && h('button', { class: 'btn', onclick: () => { markLocked(session); location.reload(); } }, 'Verrouiller maintenant'),
        h('button', { class: 'btn', onclick: () => {
          const a = h('a', { href: URL.createObjectURL(new Blob([store.exportJSON()], { type: 'application/json' })), download: 'student-hub.json' });
          a.click(); URL.revokeObjectURL(a.href);
        } }, 'Exporter'),
        h('button', { class: 'btn', onclick: () => file.click() }, 'Importer'), file,
        h('button', { class: 'btn btn--danger', onclick: () => { if (confirm('Tout effacer et revenir aux données de départ ?')) store.reset(); } }, 'Réinitialiser')),
      h('p', { class: 'muted' }, 'L\'export contient ton catalogue (tags, favoris, signets, progression), pas les fichiers PDF.'),
      status);
  }

  store.subscribe(draw);
  window.addEventListener('hashchange', () => { draw(); main.focus(); });
  root.replaceChildren(h('header', { class: 'top' },
    h('a', { class: 'brand', href: '#home' }, h('img', { src: 'assets/logo.svg', alt: '', width: 28, height: 28 }), 'Student Hub'), nav), main);
  draw();
  startReminders(store);
  return { store, ctx };
}
