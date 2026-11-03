import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  filterBooks, sortBooks, groupBooks, recents, favorites, allBookmarks, folderNames, parseTags,
  titleFromFilename, fingerprint, formatSize, progressOf, defaultDir,
} from '../js/library-logic.js';
import { newBook, sanitizeState } from '../js/store.js';

const b = (p) => newBook({ title: 'T', ...p });

test('filterBooks : recherche dans titre, auteur, tags, dossier', () => {
  const list = [b({ title: 'Algèbre 2', author: 'Daniel Guin' }), b({ title: 'Geometry', tags: ['schaum'] }), b({ title: 'Chimie', folder: 'L1' })];
  assert.equal(filterBooks(list, { query: 'guin' }).length, 1);
  assert.equal(filterBooks(list, { query: 'SCHAUM' }).length, 1);
  assert.equal(filterBooks(list, { query: 'l1' }).length, 1);
  assert.equal(filterBooks(list, { folder: 'L1' }).length, 1);
  assert.equal(filterBooks(list, { folder: '' }).length, 2);
  assert.equal(filterBooks(list, { tag: 'schaum' })[0].title, 'Geometry');
  assert.equal(filterBooks(list, {}).length, 3);
});

test('sortBooks : texte croissant, nombres décroissants, vides à la fin', () => {
  const list = [b({ title: 'b', size: 5 }), b({ title: 'a', size: 50 }), b({ title: 'é', size: 0 })];
  assert.deepEqual(sortBooks(list, 'title').map((x) => x.title), ['a', 'b', 'é']);
  assert.deepEqual(sortBooks(list, 'size').map((x) => x.size), [50, 5, 0]);
  const authors = [b({ author: '' }), b({ author: 'Zed' }), b({ author: 'Abel' })];
  assert.deepEqual(sortBooks(authors, 'author').map((x) => x.author), ['Abel', 'Zed', '']);
  assert.deepEqual(sortBooks(authors, 'author', 'desc').map((x) => x.author), ['Zed', 'Abel', '']);
  assert.equal(defaultDir('title'), 'asc'); assert.equal(defaultDir('added'), 'desc');
});

test('groupBooks : par auteur, par tag (multi-groupes), sans valeur en dernier', () => {
  const list = [b({ author: 'B', tags: ['x', 'y'] }), b({ author: 'A' }), b({ author: '' })];
  assert.deepEqual(groupBooks(list, 'author').map(([k]) => k), ['A', 'B', 'Sans auteur']);
  const tags = groupBooks(list, 'tag');
  assert.deepEqual(tags.map(([k]) => k), ['x', 'y', 'Sans tag']);
  assert.equal(tags[0][1].length, 1);
  assert.equal(groupBooks(list, 'none')[0][1].length, 3);
});

test('recents, favoris, signets, dossiers', () => {
  const list = [b({ title: 'a', opened: '2026-10-01T00:00:00Z' }), b({ title: 'b', opened: '2026-10-05T00:00:00Z', favorite: true }), b({ title: 'c' })];
  assert.deepEqual(recents(list).map((x) => x.title), ['b', 'a']);
  assert.equal(favorites(list).length, 1);
  const withMarks = [b({ bookmarks: [{ id: '1', page: 3, label: 'x', date: '2026-10-02' }] }), b({ bookmarks: [{ id: '2', page: 9, label: 'y', date: '2026-10-09' }] })];
  assert.deepEqual(allBookmarks(withMarks).map((m) => m.bookmark.page), [9, 3]);
  assert.deepEqual(folderNames([b({ folder: 'Z' }), b({ folder: 'A' }), b({ folder: 'A' }), b({})]), ['A', 'Z']);
});

test('parseTags, titres et tailles', () => {
  assert.deepEqual(parseTags(' maths, physique ;maths\n  '), ['maths', 'physique']);
  assert.equal(titleFromFilename('Cours_de_physique.pdf'), 'Cours de physique');
  assert.equal(titleFromFilename('.pdf'), 'Sans titre');
  assert.equal(fingerprint({ name: 'a.pdf', size: 12 }), 'a.pdf|12');
  assert.equal(formatSize(0), ''); assert.equal(formatSize(2048), '2 Ko'); assert.equal(formatSize(5 * 1024 * 1024), '5.0 Mo');
  assert.equal(progressOf(5, 10), 50); assert.equal(progressOf(1, 0), 0); assert.equal(progressOf(99, 10), 100);
});

test('sanitizeState nettoie la bibliothèque importée', () => {
  const s = sanitizeState({ library: [{ title: 5, size: -3, pages: 'x', progress: 400, page: -2, tags: ['ok', '', 3, ' a '], bookmarks: [{ page: 0 }, 'x'] }, null] });
  assert.equal(s.library.length, 1);
  const k = s.library[0];
  assert.equal(k.title, 'Sans titre'); assert.equal(k.size, 0); assert.equal(k.pages, 0);
  assert.equal(k.progress, 100); assert.equal(k.page, 1);
  assert.deepEqual(k.tags, ['ok', 'a']);
  assert.equal(k.bookmarks.length, 1); assert.equal(k.bookmarks[0].page, 1);
});
