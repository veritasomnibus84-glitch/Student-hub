import { h } from './dom.js';
import { createStore } from './store.js';
import * as workspace from './modules/workspace.js';
import * as library from './modules/library.js';
import * as messages from './modules/messages.js';
import * as videos from './modules/videos.js';
import * as notes from './modules/notes.js';
import * as links from './modules/links.js';

// Ajouter un onglet = un module (render(ctx) -> Element) + une ligne ici.
export const TABS = [
  ['workspace', 'Workspace', workspace], ['library', 'Biblio', library], ['messages', 'Messages', messages],
  ['videos', 'Vidéos', videos], ['notes', 'Notes', notes], ['links', 'Liens', links],
];

async function loadJSON(path, fallback) {
  try {
    const r = await fetch(path, { cache: 'no-cache' });
    return r.ok ? await r.json() : fallback;
  } catch { return fallback; }
}

export async function start(root, storage = localStorage) {
  const store = createStore(storage);
  const data = {
    summaries: await loadJSON('data/summaries.json', []),
    videos: await loadJSON('data/videos.json', { videos: [] }),
  };
  const ctx = { store, data, rerender: () => draw() };
  const main = h('main', { id: 'main', tabindex: '-1' });
  const nav = h('nav', { class: 'nav', 'aria-label': 'Sections' });
  const status = h('p', { class: 'muted', role: 'status' });

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
    return h('details', { class: 'tools' }, h('summary', null, 'Données'),
      h('div', { class: 'row wrap' },
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
  root.replaceChildren(h('header', { class: 'top' }, h('span', { class: 'brand' }, 'Student Hub'), nav), main);
  draw();
  return { store, ctx };
}
