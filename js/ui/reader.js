import { h } from '../dom.js';
import { uid } from '../store.js';
import { getFile } from '../files.js';
import { openPdf, renderPage } from '../pdfdoc.js';
import { progressOf } from '../library-logic.js';

// Lecteur plein écran : une page à la fois, zoom, signets, reprise à la dernière page.
export async function openReader(ctx, book, startPage) {
  const { store } = ctx;
  const live = () => store.state.library.find((b) => b.id === book.id);
  const status = h('p', { class: 'reader__status', role: 'status' }, 'Chargement…');
  const wrap = h('div', { class: 'reader__page' });
  const canvas = h('canvas', { 'aria-label': 'Page du document' });
  wrap.append(canvas);
  let doc; let page = 1; let zoom = 1; let task; let token = 0;

  const input = h('input', { type: 'number', min: 1, value: 1, class: 'reader__num', 'aria-label': 'Numéro de page' });
  const total = h('span', { class: 'muted' }, '/ …');
  const mark = h('button', { class: 'btn', 'aria-pressed': 'false', onclick: toggleMark }, 'Signet');

  const dlg = h('dialog', { class: 'reader', 'aria-label': `Lecture : ${book.title}` },
    h('header', { class: 'reader__bar' },
      h('button', { class: 'btn', onclick: () => dlg.close() }, 'Fermer'),
      h('span', { class: 'reader__title' }, book.title)),
    h('div', { class: 'reader__scroll' }, status, wrap),
    h('footer', { class: 'reader__bar' },
      h('button', { class: 'btn', 'aria-label': 'Page précédente', onclick: () => go(page - 1) }, '←'),
      input, total,
      h('button', { class: 'btn', 'aria-label': 'Page suivante', onclick: () => go(page + 1) }, '→'),
      h('button', { class: 'btn', 'aria-label': 'Réduire', onclick: () => setZoom(zoom - 0.25) }, '−'),
      h('button', { class: 'btn', 'aria-label': 'Agrandir', onclick: () => setZoom(zoom + 0.25) }, '+'),
      mark));

  function marked() { return live()?.bookmarks.find((m) => m.page === page); }
  function syncMark() { mark.setAttribute('aria-pressed', String(Boolean(marked()))); mark.textContent = marked() ? 'Signet ✓' : 'Signet'; }
  function toggleMark() {
    store.commit(() => {
      const b = live(); if (!b) return;
      const m = marked();
      if (m) b.bookmarks = b.bookmarks.filter((x) => x.id !== m.id);
      else b.bookmarks.push({ id: uid(), page, label: `Page ${page}`, date: new Date().toISOString() });
    }, { silent: true });
    syncMark();
  }
  const setZoom = (z) => { zoom = Math.min(4, Math.max(0.5, z)); draw(); };

  async function draw() {
    if (!doc) return;
    const mine = ++token;
    task?.cancel?.();
    const p = await doc.getPage(page);
    if (mine !== token) return;
    const width = Math.max(200, (dlg.querySelector('.reader__scroll').clientWidth - 16) * zoom);
    task = await renderPage(p, canvas, width);
    canvas.style.width = `${width}px`;
    try { await task.promise; } catch { return; }
    status.textContent = '';
  }

  function go(n) {
    if (!doc) return;
    page = Math.min(doc.numPages, Math.max(1, Math.round(Number(n)) || 1));
    input.value = page;
    store.commit(() => {
      const b = live(); if (!b) return;
      b.page = page; b.progress = progressOf(page, doc.numPages); b.opened = new Date().toISOString();
    }, { silent: true });
    syncMark();
    dlg.querySelector('.reader__scroll').scrollTop = 0;
    draw();
  }

  input.addEventListener('change', () => go(input.value));
  dlg.addEventListener('keydown', (e) => {
    if (e.target === input) return;
    if (e.key === 'ArrowRight' || e.key === 'PageDown') go(page + 1);
    if (e.key === 'ArrowLeft' || e.key === 'PageUp') go(page - 1);
  });
  let x0 = null;
  wrap.addEventListener('pointerdown', (e) => { x0 = e.clientX; });
  wrap.addEventListener('pointerup', (e) => {
    if (x0 !== null && zoom === 1 && Math.abs(e.clientX - x0) > 70) go(page + (e.clientX < x0 ? 1 : -1));
    x0 = null;
  });
  dlg.addEventListener('close', () => {
    token += 1; task?.cancel?.(); doc?.destroy(); dlg.remove();
    store.commit(() => {}); // rafraîchit progression et récents
  });

  document.body.append(dlg);
  dlg.showModal();
  try {
    const blob = await getFile(book.id);
    if (!blob) throw new Error('absent');
    doc = await openPdf(blob);
    total.textContent = `/ ${doc.numPages}`;
    input.max = doc.numPages;
    go(startPage ?? live()?.page ?? 1);
  } catch {
    status.textContent = 'Impossible d\'ouvrir ce fichier sur cet appareil.';
  }
}
