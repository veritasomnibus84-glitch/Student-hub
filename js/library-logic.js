// Logique pure de la bibliothèque (testée sans navigateur).
export const LIB_SORTS = [
  ['added', 'Date d\'ajout'], ['title', 'Titre'], ['author', 'Auteur'], ['size', 'Taille'],
  ['pages', 'Pages'], ['opened', 'Dernière lecture'], ['progress', 'Progression'],
];
export const LIB_VIEWS = [['cover', 'Couvertures'], ['grid', 'Grille'], ['list', 'Liste'], ['condensed', 'Condensée']];
export const LIB_GROUPS = [['none', 'Sans regroupement'], ['author', 'Par auteur'], ['tag', 'Par tag'], ['folder', 'Par dossier']];
export const LIB_SECTIONS = [
  ['library', 'Bibliothèque'], ['folders', 'Dossiers'], ['recent', 'Récents'], ['favorites', 'Favoris'], ['bookmarks', 'Signets'],
];

export const defaultDir = (by) => (by === 'title' || by === 'author' ? 'asc' : 'desc');

export function filterBooks(books, { query = '', folder = null, tag = '' } = {}) {
  const q = query.trim().toLowerCase();
  return books.filter((b) => (folder === null || b.folder === folder) && (!tag || b.tags.includes(tag))
    && (!q || [b.title, b.author, b.name, b.folder, ...b.tags].some((x) => x.toLowerCase().includes(q))));
}

export function sortBooks(books, by = 'added', dir = defaultDir(by)) {
  const sign = dir === 'asc' ? 1 : -1;
  return [...books].sort((a, b) => {
    const x = a[by]; const y = b[by];
    const ex = x === '' || x == null; const ey = y === '' || y == null;
    if (ex && ey) return 0;
    if (ex) return 1;
    if (ey) return -1;
    if (typeof x === 'string') return sign * x.localeCompare(y, 'fr', { sensitivity: 'base' });
    return sign * (x - y);
  });
}

export function groupBooks(books, by = 'none') {
  if (by === 'none') return [['', books]];
  const map = new Map();
  const add = (k, b) => { if (!map.has(k)) map.set(k, []); map.get(k).push(b); };
  for (const b of books) {
    if (by === 'tag') (b.tags.length ? b.tags : ['']).forEach((t) => add(t, b));
    else add((by === 'author' ? b.author : b.folder).trim(), b);
  }
  const none = { author: 'Sans auteur', tag: 'Sans tag', folder: 'Sans dossier' }[by];
  return [...map].sort(([a], [b]) => (a === '' ? 1 : b === '' ? -1 : a.localeCompare(b, 'fr')))
    .map(([k, v]) => [k || none, v]);
}

export const recents = (books, limit = 30) => books.filter((b) => b.opened)
  .sort((a, b) => b.opened.localeCompare(a.opened)).slice(0, limit);

export const favorites = (books) => books.filter((b) => b.favorite);

export function allBookmarks(books) {
  return books.flatMap((book) => book.bookmarks.map((bookmark) => ({ book, bookmark })))
    .sort((a, b) => b.bookmark.date.localeCompare(a.bookmark.date));
}

export const folderNames = (books) => [...new Set(books.map((b) => b.folder.trim()).filter(Boolean))]
  .sort((a, b) => a.localeCompare(b, 'fr'));

export const parseTags = (text) => [...new Set(String(text).split(/[,;\n]/).map((t) => t.trim()).filter(Boolean))]
  .map((t) => t.slice(0, 40)).slice(0, 30);

export const titleFromFilename = (name) => String(name).replace(/\.[a-z0-9]{1,5}$/i, '').replace(/[_]+/g, ' ').replace(/\s+/g, ' ').trim() || 'Sans titre';

// Identifie le même fichier sur deux appareils (nom + taille).
export const fingerprint = (file) => `${file.name}|${file.size}`;

export function formatSize(bytes) {
  if (!bytes) return '';
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} Ko`;
  return `${(bytes / 1024 / 1024).toFixed(bytes < 10 * 1024 * 1024 ? 1 : 0)} Mo`;
}

export const progressOf = (page, pages) => (pages > 0 ? Math.min(100, Math.round((page / pages) * 100)) : 0);
