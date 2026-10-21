// Révision : leçons et cartes (logique pure). Génération IA = prompt à copier + JSON à coller (aucune clé dans le navigateur).
import { newMemory, isDue, level } from './fsrs.js';

const str = (v, max = 5000) => (typeof v === 'string' ? v.slice(0, max) : '');
const id = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);
const TYPES = ['qa', 'mcq'];

export const newDeck = (p = {}) => ({ id: id(), name: 'Nouvelle leçon', courseId: '', exam: '', ...p });
export const newCard = (p = {}) => ({ id: id(), deckId: '', type: 'qa', front: '', back: '', choices: [], correct: 0, explanation: '', mem: newMemory(), ...p });

export function sanitizeRevision(r) {
  const objs = (x) => (Array.isArray(x) ? x.filter((i) => i && typeof i === 'object') : []);
  const decks = objs(r.decks).map((d) => ({
    id: str(d.id, 40) || id(), name: str(d.name, 200) || 'Leçon', courseId: str(d.courseId, 40),
    exam: /^\d{4}-\d{2}-\d{2}$/.test(d.exam) ? d.exam : '',
  }));
  const num = (v, a, b) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(b, Math.max(a, v)) : a);
  const iso = (v) => (typeof v === 'string' && !Number.isNaN(Date.parse(v)) ? v : '');
  const cards = objs(r.cards).map((c) => {
    const choices = (Array.isArray(c.choices) ? c.choices : []).filter((x) => typeof x === 'string').slice(0, 6).map((x) => x.slice(0, 500));
    const type = TYPES.includes(c.type) && (c.type === 'qa' || choices.length >= 2) ? c.type : 'qa';
    const m = c.mem && typeof c.mem === 'object' ? c.mem : {};
    const state = ['new', 'learning', 'review'].includes(m.state) && m.s > 0 && iso(m.due) ? m.state : 'new';
    return {
      id: str(c.id, 40) || id(), deckId: str(c.deckId, 40), type, front: str(c.front, 2000), back: str(c.back, 2000), choices,
      correct: Math.round(num(c.correct, 0, Math.max(0, choices.length - 1))), explanation: str(c.explanation, 2000),
      mem: state === 'new' ? newMemory() : { state, s: num(m.s, 0.001, 36500), d: num(m.d, 1, 10), due: iso(m.due), last: iso(m.last), reps: Math.round(num(m.reps, 0, 1e6)), lapses: Math.round(num(m.lapses, 0, 1e6)) },
    };
  }).filter((c) => c.front.trim());
  return { decks, cards };
}

// Lit le JSON collé (tableau, ou {cards:[…]}, éventuellement entouré de ```). Types : qa, mcq, ou clés du catalogue (front/back, choices/correct_index, cloze/tf).
export function parseCards(text, deckId) {
  const clean = String(text).replace(/```(?:json)?/g, '').trim();
  let o; try { o = JSON.parse(clean); } catch { throw new Error('Réponse illisible : ce n\'est pas du JSON.'); }
  const arr = Array.isArray(o) ? o : Array.isArray(o?.cards) ? o.cards : null;
  if (!arr) throw new Error('Il faut un tableau JSON de cartes.');
  const out = arr.filter((x) => x && typeof x.front === 'string' && x.front.trim()).map((x) => {
    const choices = Array.isArray(x.choices) ? x.choices : [];
    const isTf = x.type === 'tf';
    return newCard({
      deckId, type: x.type === 'mcq' && choices.length >= 2 ? 'mcq' : 'qa', front: x.front,
      back: isTf ? `${x.answer ? 'Vrai' : 'Faux'}. ${x.correction ?? ''}`.trim() : String(x.back ?? (choices[x.correct_index] ?? '')),
      choices, correct: Number.isInteger(x.correct_index) ? x.correct_index : 0, explanation: String(x.explanation ?? ''),
    });
  });
  if (!out.length) throw new Error('Aucune carte valide trouvée (champ « front » manquant).');
  return sanitizeRevision({ decks: [], cards: out }).cards;
}

export function stats(cards, now = Date.now()) {
  const s = { total: cards.length, due: 0, mastered: 0, learning: 0, fresh: 0 };
  for (const c of cards) {
    if (isDue(c.mem, now)) s.due += 1;
    const l = level(c.mem); s[l === 'new' ? 'fresh' : l] += 1;
  }
  return s;
}

// File d'une session : cartes dues (les plus en retard d'abord) puis nouvelles cartes, plafonnées.
export function queue(cards, now = Date.now(), maxNew = 20) {
  const due = cards.filter((c) => c.mem.state !== 'new' && isDue(c.mem, now)).sort((a, b) => Date.parse(a.mem.due) - Date.parse(b.mem.due));
  return [...due, ...cards.filter((c) => c.mem.state === 'new').slice(0, maxNew)];
}

const SCHEMA = {
  qa: 'Sortie : tableau JSON d\'objets {type:"qa", front, back, explanation}.',
  mcq: 'Sortie : tableau JSON d\'objets {type:"mcq", front, choices[4], correct_index, explanation}. Chaque leurre est plausible et de longueur comparable ; `explanation` dit pourquoi chaque option est juste ou fausse.',
};
export function buildPrompt({ type = 'qa', n = 10, course = '', lang = 'français' }) {
  return [
    'Tu es un tuteur expert en sciences de l\'apprentissage. Tu travailles UNIQUEMENT à partir du contenu entre <source>. Si une information n\'y figure pas, ne l\'invente pas.',
    'Principes : rappel actif (l\'élève doit produire une réponse), une idée par carte, jamais de question dont la réponse est devinable sans le cours, toujours une explication courte du pourquoi. Vérifie chaque carte contre la source et supprime celles qui n\'y sont pas soutenues.',
    `Langue : ${lang}. Génère ${n} cartes ${type === 'mcq' ? 'QCM à 4 options (une seule correcte)' : 'Question/Réponse : questions ouvertes (Comment…, Pourquoi…, Quelle différence entre…), réponses de 1 à 2 phrases, environ 50 % faits clés, 30 % causes et effets, 20 % applications à un cas nouveau'}.`,
    `${SCHEMA[type] ?? SCHEMA.qa} Réponds uniquement avec le JSON, sans texte autour.`,
    `<source>${course}</source>`,
  ].join('\n\n');
}
