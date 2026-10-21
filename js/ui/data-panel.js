import { h, select, field } from '../dom.js';
import { SECTIONS, parseSummaries, parseVideos } from '../data-io.js';
import { openSheet } from './dialog.js';
import { download } from './download.js';

const LABELS = {
  courses: 'cours', todos: 'to-dos', calendars: 'agendas', events: 'événements', calPrefs: 'réglages', focusTags: 'tags', sessions: 'sessions',
  library: 'livres', decks: 'leçons', cards: 'cartes', gaps: 'blocages', exams: 'examens', revDays: 'jours', goals: 'objectifs', tips: 'conseils', tipsSeeded: 'réglage', localSummaries: 'résumés', read: 'lus', localVideos: 'vidéos', notes: 'notes', links: 'liens',
};
const HINTS = {
  messages: 'Importe le fichier summaries.json d\'Hermes ou un export de cet onglet.',
  videos: 'Importe le fichier videos.json ou un export de cet onglet.',
  library: 'Seulement le catalogue (titres, tags, favoris, signets). Les PDF restent sur chaque appareil.',
};
const stamp = () => new Date().toISOString().slice(0, 10);
let message = '';
let open = false;

function say(text) { message = text; const el = document.getElementById('data-msg'); if (el) el.textContent = text; }

export function runImport(store, sectionId, text, mode) {
  if (sectionId === 'messages' || sectionId === 'videos') {
    const items = sectionId === 'messages' ? parseSummaries(text) : parseVideos(text);
    if (items) {
      const n = store.importLocal(sectionId, items, mode);
      return `${items.length} élément${items.length > 1 ? 's' : ''} importé${items.length > 1 ? 's' : ''} (${n} au total).`;
    }
  }
  const res = store.importFile(text, { mode, only: sectionId });
  return `Import réussi : ${Object.entries(res.counts).map(([k, n]) => `${n} ${LABELS[k] ?? k}`).join(', ')}.`;
}

function chooseFile(store, sectionId) {
  const input = h('input', { type: 'file', accept: 'application/json,.json', class: 'visually-hidden', 'aria-label': 'Choisir un fichier JSON' });
  input.addEventListener('change', async () => {
    const f = input.files[0]; input.remove();
    if (!f) return;
    let text;
    try { text = await f.text(); } catch { say('Fichier illisible.'); return; }
    const mode = select([['merge', 'Fusionner : ajoute et met à jour, garde le reste'], ['replace', sectionId ? 'Remplacer : efface les données de cet onglet' : 'Remplacer : efface les données des onglets concernés']], 'merge');
    openSheet(`Importer${sectionId ? ` — ${SECTIONS[sectionId].label}` : ' une sauvegarde'}`, h('div', { class: 'stack' }, h('p', { class: 'muted' }, f.name), field('Mode', mode)), {
      submitLabel: 'Importer',
      onSubmit: () => { try { say(runImport(store, sectionId, text, mode.value)); return ''; } catch (e) { return e.message; } },
    });
  });
  document.body.append(input);
  input.click();
}

const exportBtn = (store, id, label) => h('button', { class: 'btn', onclick: () => download(`student-hub-${id}-${stamp()}.json`, store.exportSection(id)) }, label);

// Panneau placé en bas de chaque onglet : les données de CET onglet.
export function dataPanel(ctx, id) {
  const { store } = ctx;
  return h('details', { class: 'tools', open, ontoggle: (e) => { open = e.target.open; } }, h('summary', null, `Données — ${SECTIONS[id].label}`),
    h('div', { class: 'row wrap' }, exportBtn(store, id, 'Exporter cet onglet'), h('button', { class: 'btn', onclick: () => chooseFile(store, id) }, 'Importer dans cet onglet')),
    h('p', { class: 'muted' }, HINTS[id] ?? 'Fichier .json exporté depuis cet onglet, ou sauvegarde complète (seules les données de cet onglet sont lues).'),
    h('p', { class: 'muted', role: 'status', id: 'data-msg' }, message));
}

// Carte de la page Home : toutes les données, plus verrou et réinitialisation (fournis par l'app).
export function backupPanel(ctx, extra) {
  const { store } = ctx;
  return h('section', { class: 'block' }, h('h2', null, 'Sauvegarde et données'),
    h('p', { class: 'muted' }, 'Exporte les données de tous les onglets dans un seul fichier, ou onglet par onglet. Les PDF ne sont pas inclus : ils restent sur chaque appareil.'),
    h('div', { class: 'row wrap' },
      h('button', { class: 'btn btn--primary', onclick: () => download(`student-hub-complet-${stamp()}.json`, store.exportJSON()) }, 'Tout exporter'),
      h('button', { class: 'btn', onclick: () => chooseFile(store, null) }, 'Tout importer')),
    h('details', { class: 'tools' }, h('summary', null, 'Un seul onglet'),
      h('ul', { class: 'plain' }, Object.entries(SECTIONS).map(([id, s]) => h('li', { class: 'row between' }, h('span', null, s.label),
        h('span', { class: 'row' }, exportBtn(store, id, 'Exporter'), h('button', { class: 'btn', onclick: () => chooseFile(store, id) }, 'Importer')))))),
    extra,
    h('p', { class: 'muted', role: 'status', id: 'data-msg' }, message));
}
