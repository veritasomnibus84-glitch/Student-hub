import { h, field, select, empty, formatDate } from '../dom.js';
import { newBook, removeBook } from '../store.js';
import { attachMenu, copyItem } from '../ui/context-menu.js';
import { openSheet } from '../ui/dialog.js';
import { openReader } from '../ui/reader.js';
import { putFile, putCover, getCover, listFileIds, deleteFile, keepStorage } from '../files.js';
import { readMeta } from '../pdfdoc.js';
import {
  LIB_SORTS, LIB_VIEWS, LIB_GROUPS, LIB_SECTIONS, defaultDir, filterBooks, sortBooks, groupBooks, recents,
  favorites, allBookmarks, folderNames, parseTags, titleFromFilename, fingerprint, formatSize,
} from '../library-logic.js';

const view = { section: 'library', query: '', sort: 'added', dir: 'desc', mode: 'grid', group: 'none', message: '' };
const device = { present: new Set(), covers: new Map(), loaded: false };

// Charge (une fois par changement) quels PDF et quelles couvertures existent sur CET appareil.
async function hydrate(ctx) {
  try {
    const ids = new Set(await listFileIds());
    let changed = !device.loaded || ids.size !== device.present.size || [...ids].some((i) => !device.present.has(i));
    device.present = ids;
    for (const b of ctx.store.state.library) {
      if (ids.has(b.id) && !device.covers.has(b.id)) {
        device.covers.set(b.id, (await getCover(b.id)) || '');
        changed = true;
      }
    }
    device.loaded = true;
    return changed;
  } catch { const was = device.loaded; device.loaded = true; return !was; }
}

export function render(ctx) {
  const { store } = ctx;
  const books = store.state.library;
  const fileInput = h('input', {
    type: 'file', accept: 'application/pdf,.pdf', multiple: true, class: 'visually-hidden', 'aria-label': 'Choisir des PDF',
    onchange: (e) => { importFiles(ctx, [...e.target.files]); e.target.value = ''; },
  });
  const status = h('p', { class: 'muted', role: 'status', id: 'lib-status' }, view.message);

  hydrate(ctx).then((changed) => { if (changed && document.getElementById('lib-status')) ctx.rerender(); });

  return h('div', { class: 'page' },
    h('h1', { class: 'page-title' }, 'Bibliothèque'),
    h('div', { class: 'seg seg--wrap', role: 'group', 'aria-label': 'Section' }, LIB_SECTIONS.map(([k, label]) => h('button', {
      class: `seg__btn ${view.section === k ? 'is-on' : ''}`.trim(), 'aria-pressed': String(view.section === k),
      onclick: () => { view.section = k; ctx.rerender(); },
    }, label))),
    h('div', { class: 'toolbar' },
      h('button', { class: 'btn btn--primary', onclick: () => fileInput.click() }, '+ Importer des PDF'), fileInput),
    status,
    body(ctx, books));
}

function body(ctx, books) {
  if (view.section === 'bookmarks') return bookmarksView(ctx, books);
  if (view.section === 'folders') return foldersView(ctx, books);
  if (view.section === 'recent') return list(ctx, recents(books), 'Aucune lecture récente.', 'Ouvre un PDF pour qu\'il apparaisse ici.');
  if (view.section === 'favorites') return list(ctx, favorites(books), 'Aucun favori.', 'Appuie sur l\'étoile d\'un livre.');
  return libraryView(ctx, books);
}

function controls(ctx) {
  return h('div', { class: 'toolbar' },
    h('input', {
      type: 'search', placeholder: 'Rechercher…', value: view.query, 'aria-label': 'Rechercher dans la bibliothèque',
      oninput: (e) => { view.query = e.target.value; redrawList(ctx); },
    }),
    select(LIB_SORTS, view.sort, { 'aria-label': 'Trier par', onchange: (e) => { view.sort = e.target.value; view.dir = defaultDir(view.sort); ctx.rerender(); } }),
    h('button', { class: 'btn', 'aria-label': view.dir === 'asc' ? 'Ordre croissant' : 'Ordre décroissant', onclick: () => { view.dir = view.dir === 'asc' ? 'desc' : 'asc'; ctx.rerender(); } }, view.dir === 'asc' ? '↑' : '↓'),
    select(LIB_VIEWS, view.mode, { 'aria-label': 'Affichage', onchange: (e) => { view.mode = e.target.value; ctx.rerender(); } }),
    select(LIB_GROUPS, view.group, { 'aria-label': 'Regrouper', onchange: (e) => { view.group = e.target.value; ctx.rerender(); } }));
}

let listHost = null;
function redrawList(ctx) {
  if (!listHost) return;
  listHost.replaceChildren(groups(ctx, shown(ctx)));
}
const shown = (ctx) => sortBooks(filterBooks(ctx.store.state.library, { query: view.query }), view.sort, view.dir);

function libraryView(ctx, books) {
  if (!books.length) return empty('Ta bibliothèque est vide.', 'Importe tes PDF de cours : ils restent sur cet appareil. Fais-le aussi sur ton autre appareil.');
  listHost = h('div', null, groups(ctx, shown(ctx)));
  return h('div', { class: 'stack' }, controls(ctx), listHost);
}

function list(ctx, books, none, hint) {
  if (!books.length) return empty(none, hint);
  return groups(ctx, books);
}

function foldersView(ctx, books) {
  if (!books.length) return empty('Aucun dossier.', 'Donne un dossier à un livre avec « Modifier ».');
  const names = [...folderNames(books), ''];
  return h('div', { class: 'stack' }, names.map((name) => {
    const items = sortBooks(books.filter((b) => b.folder.trim() === name), view.sort, view.dir);
    return items.length && h('details', { class: 'block folder', open: true },
      h('summary', null, name || 'Sans dossier', h('span', { class: 'muted' }, ` (${items.length})`)),
      shelf(ctx, items));
  }));
}

function groups(ctx, books) {
  if (!books.length) return empty('Aucun résultat.');
  return h('div', { class: 'stack' }, groupBooks(books, view.group).map(([label, items]) => h('section', null,
    label && h('h2', null, label, h('span', { class: 'muted' }, ` (${items.length})`)), shelf(ctx, items))));
}

function shelf(ctx, items) {
  return h('ul', { class: `shelf shelf--${view.mode}` }, items.map((b) => bookItem(ctx, b)));
}

function bookItem(ctx, b) {
  const { store } = ctx;
  const here = device.present.has(b.id);
  const cover = device.covers.get(b.id);
  const img = cover
    ? h('img', { class: 'cover', src: cover, alt: '', loading: 'lazy' })
    : h('span', { class: 'cover cover--blank', 'aria-hidden': 'true' }, (b.title[0] ?? '?').toUpperCase());
  const meta = [b.author, b.pages && `${b.pages} p.`, formatSize(b.size)].filter(Boolean).join(' · ');
  const open = () => (here ? openReader(ctx, b) : attachFile(ctx, b));
  const star = h('button', {
    class: 'btn btn--ghost star', 'aria-pressed': String(b.favorite), 'aria-label': b.favorite ? `Retirer ${b.title} des favoris` : `Ajouter ${b.title} aux favoris`,
    onclick: () => store.commit(() => { b.favorite = !b.favorite; }),
  }, b.favorite ? '★' : '☆');
  const more = h('button', { class: 'btn btn--ghost', 'aria-label': `Modifier ${b.title}`, onclick: () => editBook(ctx, b) }, '⋯');

  const items = () => [
    { label: here ? 'Ouvrir' : 'Charger le fichier', onSelect: open },
    { label: b.favorite ? 'Retirer des favoris' : 'Ajouter aux favoris', onSelect: () => store.commit(() => { b.favorite = !b.favorite; }) },
    { label: 'Modifier (titre, tags, dossier)', onSelect: () => editBook(ctx, b) },
    copyItem(b.title, 'Copier le titre'),
  ];
  return attachMenu(h('li', { class: `book ${here ? '' : 'book--away'}`.trim() },
    h('button', { class: 'book__open', onclick: open, 'aria-label': `${here ? 'Ouvrir' : 'Charger le fichier de'} ${b.title}` },
      img,
      h('span', { class: 'book__text' },
        h('span', { class: 'book__title' }, b.title),
        view.mode !== 'cover' && h('span', { class: 'muted' }, meta),
        !here && h('span', { class: 'chip chip--soon' }, 'Fichier absent de cet appareil'),
        b.progress > 0 && h('progress', { max: 100, value: b.progress, 'aria-label': `Progression ${b.progress}%` }))),
    h('span', { class: 'book__actions' }, star, more)), items);
}

/* ---------- Import ---------- */
async function importFiles(ctx, picked) {
  const { store } = ctx;
  const files = picked.filter((f) => f.type === 'application/pdf' || /\.pdf$/i.test(f.name));
  const say = (t) => { view.message = t; const el = document.getElementById('lib-status'); if (el) el.textContent = t; };
  if (!files.length) { say('Aucun PDF sélectionné.'); return; }
  keepStorage();
  let added = 0; let attached = 0; let skipped = 0; const failed = [];
  for (const [i, f] of files.entries()) {
    say(`Import ${i + 1}/${files.length} : ${f.name}`);
    const fp = fingerprint(f);
    let book = store.state.library.find((b) => b.fingerprint === fp);
    try {
      if (book && device.present.has(book.id)) { skipped += 1; continue; }
      const meta = await readMeta(f);
      if (!book) {
        book = newBook({
          name: f.name, title: meta.title || titleFromFilename(f.name), author: meta.author, size: f.size, pages: meta.pages, fingerprint: fp,
        });
        store.commit((s) => s.library.push(book), { silent: true });
        added += 1;
      } else { attached += 1; }
      await putFile(book.id, f);
      await putCover(book.id, meta.cover);
      device.present.add(book.id); device.covers.set(book.id, meta.cover);
    } catch { failed.push(f.name); }
  }
  say([
    added && `${added} ajouté${added > 1 ? 's' : ''}`, attached && `${attached} relié${attached > 1 ? 's' : ''} au catalogue`,
    skipped && `${skipped} déjà présent${skipped > 1 ? 's' : ''}`, failed.length && `Échec : ${failed.join(', ')}`,
  ].filter(Boolean).join(' · ') || 'Terminé.');
  store.commit(() => {});
}

// Livre connu du catalogue mais dont le fichier n'est pas sur cet appareil : on le rattache.
function attachFile(ctx, book) {
  const input = h('input', { type: 'file', accept: 'application/pdf,.pdf', class: 'visually-hidden' });
  input.addEventListener('change', () => { if (input.files[0]) importFiles(ctx, [input.files[0]]); input.remove(); });
  document.body.append(input);
  input.click();
}

/* ---------- Signets ---------- */
function bookmarksView(ctx, books) {
  const items = allBookmarks(books);
  if (!items.length) return empty('Aucun signet.', 'Dans le lecteur, appuie sur « Signet » pour marquer une page.');
  return h('ul', { class: 'plain' }, items.map(({ book, bookmark }) => h('li', { class: 'block row between' },
    h('button', {
      class: 'linkish', onclick: () => (device.present.has(book.id) ? openReader(ctx, book, bookmark.page) : attachFile(ctx, book)),
    }, `${book.title} — page ${bookmark.page}`),
    h('span', { class: 'row' }, h('span', { class: 'muted' }, formatDate(bookmark.date.slice(0, 10))),
      h('button', {
        class: 'btn btn--ghost', 'aria-label': `Supprimer le signet page ${bookmark.page}`,
        onclick: () => ctx.store.commit(() => { book.bookmarks = book.bookmarks.filter((m) => m.id !== bookmark.id); }),
      }, 'Retirer')))));
}

/* ---------- Édition ---------- */
function editBook(ctx, b) {
  const { store } = ctx;
  const title = h('input', { type: 'text', value: b.title, required: true, maxlength: 300 });
  const author = h('input', { type: 'text', value: b.author, maxlength: 200 });
  const folder = h('input', { type: 'text', value: b.folder, maxlength: 100, list: 'folders-list', placeholder: 'Ex. Algèbre' });
  const datalist = h('datalist', { id: 'folders-list' }, [...new Set([...store.state.courses.map((c) => c.name), ...folderNames(store.state.library)])].map((n) => h('option', { value: n })));
  const tags = h('input', { type: 'text', value: b.tags.join(', '), placeholder: 'maths, exercices, schaum' });
  const del = h('button', {
    type: 'button', class: 'btn btn--danger', onclick: async () => {
      if (!confirm(`Retirer « ${b.title} » de la bibliothèque ? Le fichier sera supprimé de cet appareil.`)) return;
      try { await deleteFile(b.id); } catch { /* déjà absent */ }
      device.present.delete(b.id); device.covers.delete(b.id);
      store.commit((s) => removeBook(s, b.id));
      document.querySelector('dialog.sheet')?.close();
    },
  }, 'Retirer');
  openSheet('Modifier le livre', h('div', { class: 'stack' },
    field('Titre', title), field('Auteur', author), field('Dossier', folder), datalist, field('Tags (séparés par des virgules)', tags)), {
    extra: del,
    onSubmit: () => {
      if (!title.value.trim()) return 'Le titre est obligatoire.';
      store.commit(() => { b.title = title.value.trim(); b.author = author.value.trim(); b.folder = folder.value.trim(); b.tags = parseTags(tags.value); });
      return '';
    },
  });
}
