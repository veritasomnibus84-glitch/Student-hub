import { h, field, select, empty } from '../dom.js';
import * as S from '../study-logic.js';
import { newCard } from '../revision-logic.js';

const ui = { style: '', length: '', minutes: 8, play: 0, rate: 1 };
let token = 0; // identifiant de la lecture en cours : une nouvelle lecture ou « Arrêter » invalide l'ancienne
export function resetLearn() { token += 1; Object.assign(ui, { style: '', length: '', minutes: 8, play: 0, rate: 1 }); }

async function copy(text, note, ok) {
  try { await navigator.clipboard.writeText(text); note.textContent = ok; } catch { note.textContent = 'Copie impossible ici : utilise un navigateur qui autorise le presse-papiers.'; }
}
const canSpeak = () => typeof window !== 'undefined' && 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined';

// **gras** -> <strong>, sans innerHTML.
const inline = (text) => String(text).split('**').map((part, i) => (i % 2 ? h('strong', null, part) : part));
function sheetView(text) {
  const out = []; let list = null;
  for (const b of S.sheetBlocks(text)) {
    if (b.t === 'li') { if (!list) { list = h('ul', { class: 'sheet__list' }); out.push(list); } list.append(h('li', null, ...inline(b.text))); continue; }
    list = null;
    out.push(b.t === 'h' ? h(b.level <= 1 ? 'h3' : 'h4', null, ...inline(b.text)) : h('p', null, ...inline(b.text)));
  }
  return h('div', { class: 'sheet stack' }, out);
}

// Voix du navigateur dans la langue choisie dans Paramètres (« fr-FR » → toutes les voix « fr… »), pas le français seul.
export const pickVoices = (voices, lang) => voices.filter((v) => String(v.lang).toLowerCase().startsWith(String(lang).slice(0, 2).toLowerCase()));

function speak(segments, rate, myToken, onEnd, lang = 'fr-FR') {
  const voices = pickVoices(window.speechSynthesis.getVoices(), lang);
  let i = 0;
  const next = () => {
    if (myToken !== token) return;
    if (i >= segments.length) { onEnd(); return; }
    const seg = segments[i]; i += 1;
    if (seg.pause) { setTimeout(next, seg.pause); return; }
    const u = new SpeechSynthesisUtterance(seg.text);
    u.lang = lang; u.rate = rate; u.pitch = seg.who === 'expert' ? 0.85 : 1.05;
    if (voices.length) u.voice = voices[seg.who === 'expert' ? voices.length - 1 : 0];
    u.onend = next; u.onerror = next;
    window.speechSynthesis.speak(u);
  };
  window.speechSynthesis.cancel(); next();
}

export function learnExtras(ctx, deck) {
  const { store } = ctx;
  const set = (patch) => store.commit(() => Object.assign(deck, patch));
  const noSource = !deck.source.trim();
  const style = ui.style || deck.sheet.style; const length = ui.length || deck.sheet.length;

  // ----- Couches -----
  const lNote = h('p', { class: 'muted', role: 'status' });
  const lPaste = h('textarea', { rows: 4, maxlength: 100000, placeholder: 'Colle ici le JSON renvoyé par l\'IA', 'aria-label': 'JSON des couches' });
  const lay = deck.layers; const hasLayers = lay.core.length + lay.pillar.length + lay.detail.length > 0;
  const layers = h('section', { class: 'block stack' }, h('h2', null, 'Cartographie en couches'),
    h('p', { class: 'muted' }, 'Noyaux (les idées sans lesquelles le reste n\'a pas de sens), piliers et détails. Le planning et le tuteur travaillent d\'abord les noyaux.'),
    h('div', { class: 'row wrap' }, h('button', { class: 'btn', disabled: noSource ? true : null, onclick: () => copy(S.layersPrompt({ source: deck.source, lang: store.state.settings.lang.cards }), lNote, 'Prompt copié : colle-le dans ton IA, puis rapporte le JSON ci-dessous.') }, 'Copier le prompt')),
    lPaste,
    h('button', { class: 'btn', onclick: () => { try { const r = S.parseLayers(lPaste.value); set({ layers: r.layers, summary: r.summary, recall: r.recall }); } catch (e) { lNote.textContent = e.message; } } }, 'Enregistrer la cartographie'), lNote,
    hasLayers ? h('div', { class: 'stack' },
      [['core', 'Noyaux'], ['pillar', 'Piliers'], ['detail', 'Détails']].map(([k, name]) => lay[k].length > 0 && h('details', { class: 'tip', open: k === 'core' }, h('summary', null, `${name} (${lay[k].length})`), h('ul', { class: 'sheet__list' }, lay[k].map((t, i) => { const up = k === 'pillar' ? lay.core[lay.parents?.pillar?.[i] ?? -1] : k === 'detail' ? lay.pillar[lay.parents?.detail?.[i] ?? -1] : ''; return h('li', null, t, up && h('span', { class: 'muted' }, ` — sous : ${up}`)); })))),
      deck.summary && h('details', { class: 'tip' }, h('summary', null, 'Résumé en 2 minutes'), h('p', { class: 'pre' }, deck.summary)),
      deck.recall.length > 0 && h('div', { class: 'row wrap' },
        h('span', { class: 'muted' }, `${deck.recall.length} question(s) de rappel`),
        h('button', {
          class: 'btn', onclick: () => {
            const known = new Set(store.state.cards.filter((c) => c.deckId === deck.id).map((c) => c.front));
            const fresh = deck.recall.filter((r) => !known.has(r.q)).map((r) => newCard({ deckId: deck.id, type: 'qa', front: r.q, back: r.a || '(à compléter)', layer: 'core' }));
            store.commit((s) => s.cards.push(...fresh)); lNote.textContent = `${fresh.length} carte(s) créée(s) dans Retenir.`;
          },
        }, 'En faire des cartes'))) : empty('Pas encore de cartographie.'));

  // ----- Fiche -----
  const fNote = h('p', { class: 'muted', role: 'status' });
  const fPaste = h('textarea', { rows: 5, maxlength: 60000, placeholder: 'Colle ici la fiche écrite par l\'IA', 'aria-label': 'Fiche' });
  const sheet = h('section', { class: 'block stack' }, h('h2', null, 'Fiche'),
    h('div', { class: 'row wrap' },
      field('Style', select(S.STYLES.map(([k, name]) => [k, name]), style, { onchange: (e) => { ui.style = e.target.value; ctx.rerender(); } }), 'field--inline'),
      field('Longueur', select(S.LENGTHS.map(([k, name]) => [k, name]), length, { onchange: (e) => { ui.length = e.target.value; ctx.rerender(); } }), 'field--inline')),
    h('p', { class: 'muted' }, S.STYLES.find(([k]) => k === style)[2]),
    h('button', { class: 'btn', disabled: noSource ? true : null, onclick: () => copy(S.sheetPrompt({ style, length, level: deck.level, source: deck.source, lang: store.state.settings.lang.cards }), fNote, 'Prompt copié : colle-le dans ton IA, puis rapporte la fiche ci-dessous.') }, 'Copier le prompt'),
    fPaste, h('button', { class: 'btn', onclick: () => { if (!fPaste.value.trim()) { fNote.textContent = 'Colle d\'abord la fiche.'; return; } set({ sheet: { style, length, text: fPaste.value.trim().slice(0, 50000) } }); } }, 'Enregistrer la fiche'), fNote,
    deck.sheet.text ? h('div', { class: 'stack' }, sheetView(deck.sheet.text),
      h('button', { class: 'btn btn--ghost btn--danger', onclick: () => { if (confirm('Supprimer la fiche ?')) set({ sheet: { ...deck.sheet, text: '' } }); } }, 'Supprimer la fiche')) : empty('Pas encore de fiche.'));

  // ----- Podcast -----
  const pNote = h('p', { class: 'muted', role: 'status' });
  const pPaste = h('textarea', { rows: 5, maxlength: 60000, placeholder: 'Colle ici le script (lignes HÔTE: et EXPERTE:)', 'aria-label': 'Script du podcast' });
  const segments = S.parsePodcast(deck.podcast);
  const status = h('span', { class: 'muted', role: 'status' }, ui.play ? 'Lecture en cours…' : '');
  const podcast = h('section', { class: 'block stack' }, h('h2', null, 'Podcast'),
    h('p', { class: 'muted' }, 'Un script à deux voix (Hôte et Experte) lu par la voix de ton navigateur.'),
    h('div', { class: 'row wrap' }, field('Durée visée (minutes)', h('input', { type: 'number', min: 3, max: 30, value: String(ui.minutes), onchange: (e) => { ui.minutes = Math.min(30, Math.max(3, Number(e.target.value) || 8)); } }), 'field--inline'),
      h('button', { class: 'btn', disabled: noSource ? true : null, onclick: () => copy(S.podcastPrompt({ minutes: ui.minutes, source: deck.source, lang: store.state.settings.lang.cards }), pNote, 'Prompt copié : colle-le dans ton IA, puis rapporte le script ci-dessous.') }, 'Copier le prompt')),
    pPaste, h('button', { class: 'btn', onclick: () => { if (!S.parsePodcast(pPaste.value).some((x) => x.text)) { pNote.textContent = 'Aucune réplique trouvée (lignes HÔTE: et EXPERTE:).'; return; } set({ podcast: pPaste.value.trim().slice(0, 50000) }); } }, 'Enregistrer le script'), pNote,
    segments.some((x) => x.text) ? h('div', { class: 'stack' },
      canSpeak() ? h('div', { class: 'row wrap' },
        h('button', { class: 'btn btn--primary', onclick: () => { token += 1; ui.play = token; speak(segments, ui.rate, token, () => { ui.play = 0; status.textContent = 'Terminé.'; }, store.state.settings.lang.voice); status.textContent = 'Lecture en cours…'; } }, '▶ Écouter'),
        h('button', { class: 'btn', onclick: () => { token += 1; ui.play = 0; window.speechSynthesis.cancel(); status.textContent = 'Arrêté.'; } }, '■ Arrêter'),
        select([['0.8', 'Lent'], ['1', 'Normal'], ['1.25', 'Rapide'], ['1.5', 'Très rapide']], String(ui.rate), { onchange: (e) => { ui.rate = Number(e.target.value); } }), status)
        : h('p', { class: 'muted' }, 'La lecture à voix haute n\'est pas disponible sur ce navigateur : le script reste lisible ci-dessous.'),
      h('details', { class: 'tip' }, h('summary', null, `Script (${segments.filter((x) => x.text).length} répliques)`), h('div', { class: 'stack' }, segments.filter((x) => x.text).map((x) => h('p', null, h('strong', null, x.who === 'expert' ? 'Experte : ' : 'Hôte : '), x.text)))),
      h('button', { class: 'btn btn--ghost btn--danger', onclick: () => { if (confirm('Supprimer le script ?')) { token += 1; if (canSpeak()) window.speechSynthesis.cancel(); set({ podcast: '' }); } } }, 'Supprimer le script')) : empty('Pas encore de podcast.'));

  return [layers, sheet, podcast];
}
