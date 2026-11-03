// Tuteur IA (fds-tutor.md) : l'app prépare le prompt et le contexte, tu les colles dans ton IA, puis tu rapportes le session_log.
import PROMPT from './tutor-prompt.js';
import { award, XP } from './xp-logic.js';
import { norm } from './revision-logic.js';

export const MODES = [['micro', 15, 'Micro · 15 min'], ['standard', 30, 'Standard · 30 min'], ['deep', 60, 'Approfondi · 60 min']];
const FORMAT_FR = { mixed: 'mixte', mcq: 'QCM', essay: 'essai', oral: 'oral' };
const LAYER_FR = { core: 'noyau', pillar: 'pilier', detail: 'détail' };
export const MAX_SOURCE = 24000;

// Prompt système : le fichier sans l'en-tête, la section « vault » (inutile ici) et les notes pour le mainteneur.
export function systemPrompt(raw = PROMPT) {
  return raw.replace(/^---\n[\s\S]*?\n---\n/, '').replace(/\n## Notes de conception[\s\S]*$/, '').replace(/\n## 6\. Intégration avec le vault[\s\S]*?(?=\n## 7\.)/, '').trim();
}

const cut = (text, max) => {
  if (text.length <= max) return { text, truncated: false };
  const head = text.slice(0, max); const i = head.lastIndexOf('\n\n');
  return { text: (i > max * 0.6 ? head.slice(0, i) : head).trim(), truncated: true };
};

// Notions à travailler dans l'ordre : les faiblesses d'abord, puis noyaux, piliers, détails (couches de la leçon, sinon couches des cartes).
export function priorities(deck, cards) {
  const lay = deck.layers ?? { core: [], pillar: [], detail: [] };
  const has = lay.core.length + lay.pillar.length + lay.detail.length > 0;
  const layerOf = (t) => ['core', 'pillar', 'detail'].find((k) => lay[k].includes(t)) ?? 'pillar';
  const base = has ? ['core', 'pillar', 'detail'].flatMap((k) => lay[k].map((t) => ({ text: t, layer: k })))
    : ['core', 'pillar', 'detail'].flatMap((k) => cards.filter((c) => c.layer === k).map((c) => ({ text: c.front, layer: k })));
  const weak = deck.weak.map((t) => ({ text: t, layer: layerOf(t) }));
  const seen = new Set(); const out = [];
  for (const p of [...weak, ...base]) { const k = p.text.toLowerCase(); if (!seen.has(k)) { seen.add(k); out.push(p); } }
  return out.slice(0, 12);
}

export function buildContext({ deck, cards, gaps = [], logs = [], mode = 'standard', topic = '' }) {
  const minutes = MODES.find(([k]) => k === mode)?.[1] ?? 30;
  const last = [...logs].filter((l) => l.deckId === deck.id).sort((a, b) => b.date.localeCompare(a.date))[0];
  const src = cut(deck.source ?? '', MAX_SOURCE);
  const list = (xs) => (xs.length ? xs.join(' ; ') : 'aucun');
  const blocks = [
    `<profil_etudiant>\nmatiere: ${deck.name}\nniveau: ${deck.level || 'inconnu (à estimer)'}\nnotions_maitrisees: ${list(deck.mastered)}\nnotions_faibles: ${list(deck.weak)}\nblocages: ${list(gaps.filter((g) => g.deckId === deck.id).map((g) => g.topic))}\n</profil_etudiant>`,
    `<plan_session>\nmode: ${mode}\nminutes: ${minutes}\npriorites:\n${priorities(deck, cards).map((p, i) => `${i + 1}. [${LAYER_FR[p.layer]}] ${p.text}`).join('\n') || '(aucune : demande à l\'étudiant ce qui est le plus urgent)'}\nformat_examen: ${FORMAT_FR[deck.format] ?? 'mixte'}\nrappels:\n${(last?.recall ?? []).slice(0, 3).map((q) => `- ${q}`).join('\n') || '(aucun)'}\n</plan_session>`,
    src.text ? `<sources>\n${src.text}\n</sources>` : '',
    deck.solutions?.trim() ? `<solution_reference>\n${deck.solutions.trim()}\n</solution_reference>` : '',
    `mode_app: true${topic.trim() ? `\n\nPremier message de l'étudiant : ${topic.trim()}` : ''}`,
  ].filter(Boolean);
  return { text: blocks.join('\n\n'), truncated: src.truncated, sourceChars: (deck.source ?? '').length };
}

const strs = (x, n = 20, len = 300) => (Array.isArray(x) ? x : []).filter((s) => typeof s === 'string' && s.trim()).map((s) => s.trim().slice(0, len)).slice(0, n);

// Lit le bloc session_log d'une réponse du tuteur (avec ou sans clôture ```, avec le marqueur [DARACE] autour).
export function parseSessionLog(text) {
  const t = String(text);
  let raw = t.match(/```\s*session_log\s*([\s\S]*?)```/i)?.[1];
  if (!raw) { const i = t.search(/session_log/i); if (i >= 0) { const j = t.indexOf('{', i); const k = t.lastIndexOf('}'); if (j >= 0 && k > j) raw = t.slice(j, k + 1); } }
  if (!raw) throw new Error('Aucun bloc session_log trouvé : colle la toute dernière réponse du tuteur, celle de la clôture.');
  let o; try { o = JSON.parse(raw.trim()); } catch { throw new Error('Le bloc session_log est illisible (JSON invalide).'); }
  if (!o || typeof o !== 'object' || Array.isArray(o)) throw new Error('Le bloc session_log est illisible.');
  return {
    topic: String(o.topic ?? '').slice(0, 300), level: ['novice', 'intermediate', 'advanced'].includes(o.level) ? o.level : '',
    mastered: strs(o.mastered), weak: strs(o.weak), recall: strs(o.recall_questions, 5, 500),
    next: String(o.next_step ?? '').slice(0, 500), gap: String(o.confidence_gap ?? '').slice(0, 500),
  };
}

const merge = (a, b) => { const seen = new Set(a.map((x) => x.toLowerCase())); return [...a, ...b.filter((x) => !seen.has(x.toLowerCase()))]; };
const without = (a, b) => { const drop = new Set(b.map((x) => x.toLowerCase())); return a.filter((x) => !drop.has(x.toLowerCase())); };

// Met à jour la leçon (niveau, notions maîtrisées et faibles), le journal des blocages, l'historique et les XP. À appeler dans un commit.
export function applySessionLog(state, deckId, log, today) {
  const deck = state.decks.find((d) => d.id === deckId);
  if (!deck) throw new Error('Leçon introuvable.');
  if (log.level) deck.level = log.level;
  deck.weak = merge(without(deck.weak, log.mastered), log.weak).slice(0, 80);
  deck.mastered = merge(without(deck.mastered, log.weak), log.mastered).slice(0, 80);
  // Même bilan collé deux fois : rien n'est ajouté et aucun XP n'est donné.
  const sig = JSON.stringify([deckId, log.topic, log.level, log.mastered, log.weak, log.recall, log.next, log.gap]);
  if (state.tutorLogs.some((l) => JSON.stringify([l.deckId, l.topic, l.level, l.mastered, l.weak, l.recall, l.next, l.gap]) === sig)) return { added: 0, xp: 0, duplicate: true };
  const key = (t) => norm(t);
  const known = new Set(state.gaps.filter((g) => g.deckId === deckId).map((g) => key(g.topic)));
  let added = 0;
  for (const w of log.weak) if (!known.has(key(w))) { known.add(key(w)); state.gaps.push({ id: Math.random().toString(36).slice(2, 9), deckId, topic: w, note: 'Signalé par le tuteur', created: new Date().toISOString() }); added += 1; }
  state.tutorLogs.push({ id: Math.random().toString(36).slice(2, 9), deckId, date: new Date().toISOString(), topic: log.topic, level: log.level, mastered: log.mastered, weak: log.weak, recall: log.recall, next: log.next, gap: log.gap });
  state.tutorLogs = state.tutorLogs.slice(-200);
  const xp = award(state, XP.tutor, today);
  return { added, xp };
}
