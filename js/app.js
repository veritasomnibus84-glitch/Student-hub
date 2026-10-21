import { h } from './dom.js';
import { createStore } from './store.js';
import { STORAGE_KEY } from './constants.js';
import { SECTIONS } from './data-io.js';
import { loadLock, clearLock, isUnlocked, markUnlocked, markLocked } from './lock.js';
import { showLockScreen, manageLock } from './ui/lock-screen.js';
import { startReminders, showToast } from './reminders.js';
import { startFocusRuntime } from './focus-runtime.js';
import { dataPanel, backupPanel } from './ui/data-panel.js';
import * as home from './modules/home.js';
import * as calendar from './modules/calendar.js';
import * as focus from './modules/focus.js';
import * as workspace from './modules/workspace.js';
import * as revision from './modules/revision.js';
import * as library from './modules/library.js';
import * as messages from './modules/messages.js';
import * as videos from './modules/videos.js';
import * as notes from './modules/notes.js';
import * as links from './modules/links.js';
import * as goals from './modules/goals.js';

// Ajouter un onglet = un module (render(ctx) -> Element) + une ligne ici.
export const TABS = [
  ['home', 'Home', home], ['workspace', 'Workspace', workspace], ['calendar', 'Agenda', calendar], ['focus', 'Focus', focus], ['revision', 'Mémorisation', revision],
  ['library', 'Biblio', library], ['messages', 'Messages', messages], ['videos', 'Vidéos', videos], ['notes', 'Notes', notes], ['links', 'Liens', links], ['goals', 'Objectifs', goals],
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
  const current = () => (TABS.find(([k]) => k === location.hash.slice(1)) ?? TABS[0]);

  const lockControls = () => h('div', { class: 'row wrap' },
    h('button', { class: 'btn', onclick: () => manageLock(storage, lock, (l) => { lock = l; markUnlocked(session); draw(); }) }, lock ? 'Verrou…' : 'Définir un verrou'),
    lock && h('button', { class: 'btn', onclick: () => { markLocked(session); location.reload(); } }, 'Verrouiller maintenant'),
    h('button', { class: 'btn btn--danger', onclick: () => { if (confirm('Tout effacer et revenir aux données de départ ?')) store.reset(); } }, 'Réinitialiser'));

  // Un champ retiré du DOM peut déclencher « change » (donc un nouveau dessin) pendant le dessin : on met le second en file.
  let drawing = false; let again = false;
  function draw() {
    if (drawing) { again = true; return; }
    drawing = true;
    try { render(); } finally { drawing = false; }
    if (again) { again = false; draw(); }
  }

  function render() {
    const [key, , mod] = current();
    nav.replaceChildren(...TABS.map(([k, label]) => h('a', { href: `#${k}`, 'aria-current': k === key ? 'page' : null }, label)));
    // Home : toutes les données ; les autres onglets : seulement leurs propres données.
    const tools = key === 'home' ? backupPanel(ctx, lockControls()) : SECTIONS[key] ? dataPanel(ctx, key) : null;
    main.replaceChildren(mod.render(ctx), tools);
  }

  store.subscribe(draw);
  window.addEventListener('hashchange', () => { draw(); main.focus(); });
  root.replaceChildren(h('header', { class: 'top' },
    h('a', { class: 'brand', href: '#home' }, h('img', { src: 'assets/logo.svg', alt: '', width: 28, height: 28 }), 'Student Hub'), nav), main);
  draw();
  startReminders(store);
  startFocusRuntime(store, {
    onEnd: (s) => {
      focus.showResult(s);
      showToast(s.status === 'done' ? 'Arbre planté : bravo !' : 'L\'arbre est mort : tu as quitté la session.');
      draw();
    },
  });
  return { store, ctx };
}
