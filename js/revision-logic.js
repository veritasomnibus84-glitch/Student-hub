// Mémorisation : leçons, cartes, examens (logique pure). Génération IA = prompt à copier + JSON à coller (aucune clé dans le navigateur).
import { newMemory, isDue, level } from './fsrs.js';

const str = (v, max = 5000) => (typeof v === 'string' ? v.slice(0, max) : '');
const id = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);
const num = (v, a, b, d = a) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(b, Math.max(a, v)) : d);
const iso = (v) => (typeof v === 'string' && !Number.isNaN(Date.parse(v)) ? v : '');
const objs = (x) => (Array.isArray(x) ? x.filter((i) => i && typeof i === 'object') : []);

export const CARD_TYPES = ['qa', 'def', 'word', 'mcq', 'tf', 'cloze'];
export const TYPE_LABELS = { qa: 'Question / réponse', def: 'Définition / signification', word: 'Mot / traduction', mcq: 'QCM', tf: 'Vrai / faux', cloze: 'À trous' };
export const LAYERS = [['core', 'Noyau'], ['pillar', 'Pilier'], ['detail', 'Détail']];
export const EXAM_FORMATS = [['mixed', 'Mixte'], ['mcq', 'QCM'], ['essay', 'Rédaction'], ['oral', 'Oral']];
export const isFree = (t) => t === 'qa' || t === 'def' || t === 'word';
export const isChoice = (t) => t === 'mcq' || t === 'tf';
const rank = (c) => ({ core: 0, pillar: 1, detail: 2 }[c.layer] ?? 1);

export const newDeck = (p = {}) => ({ id: id(), name: 'Nouvelle leçon', courseId: '', exam: '', target: 16, format: 'mixed', source: '', maxMin: 60, ...p });
export const newCard = (p = {}) => ({ id: id(), deckId: '', type: 'qa', front: '', back: '', choices: [], correct: 0, accepted: [], hint: '', layer: 'pillar', explanation: '', mem: newMemory(), ...p });

export function sanitizeRevision(r) {
  const decks = objs(r.decks).map((d) => ({
    id: str(d.id, 40) || id(), name: str(d.name, 200) || 'Leçon', courseId: str(d.courseId, 40),
    exam: /^\d{4}-\d{2}-\d{2}$/.test(d.exam) ? d.exam : '', target: Math.round(num(d.target, 10, 20, 16)),
    format: EXAM_FORMATS.some(([k]) => k === d.format) ? d.format : 'mixed', source: str(d.source, 50000), maxMin: Math.round(num(d.maxMin, 15, 240, 60)),
  }));
  const cards = objs(r.cards).map((c) => {
    let choices = (Array.isArray(c.choices) ? c.choices : []).filter((x) => typeof x === 'string').slice(0, 6).map((x) => x.slice(0, 500));
    let type = CARD_TYPES.includes(c.type) ? c.type : 'qa';
    if (type === 'mcq' && choices.length < 2) type = 'qa';
    if (type === 'tf') choices = ['Vrai', 'Faux'];
    if (!isChoice(type)) choices = [];
    const m = c.mem && typeof c.mem === 'object' ? c.mem : {};
    const state = ['new', 'learning', 'review'].includes(m.state) && m.s > 0 && iso(m.due) ? m.state : 'new';
    return {
      id: str(c.id, 40) || id(), deckId: str(c.deckId, 40), type, front: str(c.front, 2000), back: str(c.back, 2000), choices,
      correct: Math.round(num(c.correct, 0, Math.max(0, choices.length - 1))),
      accepted: (Array.isArray(c.accepted) ? c.accepted : []).filter((x) => typeof x === 'string').slice(0, 10).map((x) => x.slice(0, 200)),
      hint: str(c.hint, 500), layer: LAYERS.some(([k]) => k === c.layer) ? c.layer : 'pillar', explanation: str(c.explanation, 2000),
      mem: state === 'new' ? newMemory() : { state, s: num(m.s, 0.001, 36500), d: num(m.d, 1, 10), due: iso(m.due), last: iso(m.last), reps: Math.round(num(m.reps, 0, 1e6)), lapses: Math.round(num(m.lapses, 0, 1e6)) },
    };
  }).filter((c) => c.front.trim());
  const gaps = objs(r.gaps).map((g) => ({ id: str(g.id, 40) || id(), deckId: str(g.deckId, 40), topic: str(g.topic, 300), note: str(g.note, 2000), created: iso(g.created) })).filter((g) => g.topic.trim());
  const exams = objs(r.exams).map((e) => ({
    id: str(e.id, 40) || id(), deckId: str(e.deckId, 40), date: iso(e.date), n: Math.round(num(e.n, 0, 1000)),
    predicted: typeof e.predicted === 'number' && Number.isFinite(e.predicted) ? num(e.predicted, 0, 20) : null, score: num(e.score, 0, 20),
  }));
  const revDays = (Array.isArray(r.revDays) ? r.revDays : []).filter((x) => typeof x === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(x)).slice(-400);
  return { decks, cards, gaps, exams, revDays };
}

// ---- Import de cartes (JSON d'une IA, ou CSV / Anki) ----
export function parseCards(text, deckId) {
  const clean = String(text).replace(/```(?:json)?/g, '').trim();
  let o; try { o = JSON.parse(clean); } catch { throw new Error('Réponse illisible : ce n\'est pas du JSON.'); }
  const arr = Array.isArray(o) ? o : Array.isArray(o?.cards) ? o.cards : null;
  if (!arr) throw new Error('Il faut un tableau JSON de cartes.');
  const out = arr.filter((x) => x && typeof x.front === 'string' && x.front.trim()).map((x) => {
    const type = CARD_TYPES.includes(x.type) ? x.type : 'qa';
    const choices = Array.isArray(x.choices) ? x.choices : [];
    const explanation = [x.explanation, x.example && `Exemple : ${x.example}`].filter(Boolean).join('\n');
    const base = { deckId, type, front: x.front, explanation, layer: x.layer, hint: String(x.mediator_hint ?? x.hint ?? '') };
    if (type === 'tf') return newCard({ ...base, back: x.answer === true ? 'Vrai' : 'Faux', correct: x.answer === true ? 0 : 1, explanation: [x.correction, explanation].filter(Boolean).join('\n') });
    if (type === 'mcq') return newCard({ ...base, choices, correct: Number.isInteger(x.correct_index) ? x.correct_index : 0, back: String(choices[x.correct_index] ?? x.back ?? '') });
    if (type === 'cloze') return newCard({ ...base, back: String(x.back ?? ''), accepted: Array.isArray(x.accepted) ? x.accepted : [] });
    return newCard({ ...base, back: String(x.back ?? '') });
  });
  if (!out.length) throw new Error('Aucune carte valide trouvée (champ « front » manquant).');
  return sanitizeRevision({ cards: out }).cards;
}

// CSV, TSV ou export texte d'Anki : une carte par ligne, « question ; réponse ».
export function parseCSV(text, deckId, type = 'qa') {
  const lines = String(text).split(/\r?\n/).filter((l) => l.trim());
  const first = lines[0] ?? '';
  const delim = ['\t', ';', ','].map((d) => [d, first.split(d).length]).sort((a, b) => b[1] - a[1])[0][0];
  const split = (line) => {
    const f = []; let cur = ''; let q = false;
    for (let i = 0; i < line.length; i += 1) {
      const ch = line[i];
      if (ch === '"') { if (q && line[i + 1] === '"') { cur += '"'; i += 1; } else q = !q; } else if (ch === delim && !q) { f.push(cur); cur = ''; } else cur += ch;
    }
    return [...f, cur].map((x) => x.trim());
  };
  const cards = lines.map(split).filter((f) => f.length >= 2 && f[0] && f[1]).map((f) => newCard({ deckId, type, front: f[0], back: f[1] }));
  if (!cards.length) throw new Error('Aucune ligne « question ; réponse » trouvée.');
  return sanitizeRevision({ cards }).cards;
}

// ---- Statistiques, file de session, série ----
export function stats(cards, now = Date.now()) {
  const s = { total: cards.length, due: 0, mastered: 0, learning: 0, fresh: 0 };
  for (const c of cards) {
    if (isDue(c.mem, now)) s.due += 1;
    const l = level(c.mem); s[l === 'new' ? 'fresh' : l] += 1;
  }
  return s;
}

// Cartes dues (les plus en retard d'abord), puis nouvelles cartes : noyaux avant piliers avant détails.
export function queue(cards, now = Date.now(), maxNew = 20) {
  const due = cards.filter((c) => c.mem.state !== 'new' && isDue(c.mem, now)).sort((a, b) => Date.parse(a.mem.due) - Date.parse(b.mem.due));
  const fresh = cards.filter((c) => c.mem.state === 'new').sort((a, b) => rank(a) - rank(b));
  return [...due, ...fresh.slice(0, maxNew)];
}
export const layerRank = rank;

export function streak(days, today) {
  const set = new Set(days); let d = new Date(`${today}T00:00:00`); let n = 0;
  const key = (x) => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
  if (!set.has(key(d))) d.setDate(d.getDate() - 1); // la série n'est pas perdue tant qu'aujourd'hui n'est pas fini
  while (set.has(key(d))) { n += 1; d.setDate(d.getDate() - 1); }
  return n;
}
export function markDay(state, today) {
  if (!state.revDays.includes(today)) state.revDays = [...state.revDays, today].slice(-400);
}

// ---- Réponses à trous et examen ----
export const norm = (s) => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
export const checkCloze = (card, answer) => !!norm(answer) && [card.back, ...card.accepted].some((a) => norm(a) === norm(answer));

export const EXAM_KINDS = [['free', 'Réponses libres'], ['mcq', 'QCM'], ['tf', 'V/F'], ['cloze', 'À trous']];
export const kindOf = (c) => (isFree(c.type) ? 'free' : c.type);

export function pickExam(cards, { kinds, n }, rng = Math.random) {
  const pool = cards.filter((c) => kinds.includes(kindOf(c)));
  for (let i = pool.length - 1; i > 0; i -= 1) { const j = Math.floor(rng() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
  return pool.slice(0, Math.max(1, n));
}

// Note automatique (QCM, V/F, trous) ; null pour une réponse libre (à corriger).
export function autoScore(card, item) {
  if (isChoice(card.type)) return item.picked === card.correct ? 1 : 0;
  if (card.type === 'cloze') return checkCloze(card, item.answer ?? '') ? 1 : 0;
  return null;
}
export const examNote = (scores) => (scores.length ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 200) / 10 : 0);

export function parseScores(text, n) {
  let o; try { o = JSON.parse(String(text).replace(/```(?:json)?/g, '').trim()); } catch { throw new Error('Réponse illisible : ce n\'est pas du JSON.'); }
  const arr = Array.isArray(o) ? o : Array.isArray(o?.scores) ? o.scores : null;
  const vals = arr?.map((x) => (typeof x === 'number' ? x : x?.score));
  if (!vals || vals.length !== n || vals.some((v) => typeof v !== 'number' || !Number.isFinite(v))) throw new Error(`Il faut exactement ${n} score(s) entre 0 et 1.`);
  return vals.map((v) => Math.min(1, Math.max(0, v)));
}

// ---- Prompts (catalogue de prompts fondés sur la recherche) ----
const SYS = 'Tu es un tuteur expert en sciences de l\'apprentissage. Tu travailles UNIQUEMENT à partir du contenu entre <source>. Si une information n\'y figure pas, ne l\'invente pas. Principes : rappel actif (l\'élève doit produire une réponse), une idée par item, jamais de question dont la réponse est devinable sans le cours, toujours une explication courte du pourquoi. Vérifie chaque item contre la source et supprime ceux qui n\'y sont pas soutenus. Ajoute à chaque item "layer" : "core" (idée sans laquelle le reste n\'a pas de sens), "pillar" ou "detail".';
const TASKS = {
  qa: ['Question/Réponse : questions ouvertes (Comment…, Pourquoi…, Quelle différence entre…, Que se passe-t-il si…), jamais oui/non, réponse de 25 mots maximum, environ 50 % faits clés, 30 % causes et effets, 20 % applications à un cas nouveau', '{type:"qa", front, back, explanation, layer}'],
  def: ['Définition/Signification : face avant = le terme seul ; face arrière = définition de 20 mots maximum sans mot de la même famille que le terme ; ajoute une phrase d\'exemple', '{type:"def", front, back, example, layer}'],
  word: ['Mot/Traduction : ajoute pour chaque mot un médiateur (mot-clé de la langue maternelle qui ressemble au son du mot + image mentale) et une phrase d\'exemple ; génère aussi la carte inverse', '{type:"word", front, back, example, mediator_hint, layer}'],
  mcq: ['QCM à 4 options (une seule correcte) : chaque leurre est une idée plausible et proche du concept, de longueur comparable ; interdit « toutes/aucune des réponses » ; position de la bonne réponse aléatoire ; `explanation` dit pourquoi CHAQUE option est juste ou fausse', '{type:"mcq", front, choices[4], correct_index, explanation, layer}'],
  tf: ['Vrai/Faux, 50 % vraies et 50 % fausses : une affirmation fausse est une déformation réaliste d\'un fait du cours (jamais une absurdité) ; évite « toujours/jamais » ; pour une fausse, `correction` = la version juste de l\'énoncé', '{type:"tf", front, answer(boolean), correction, explanation, layer}'],
  cloze: ['Phrases à trous : reprends une phrase de la source et masque UN seul élément essentiel (1 à 3 mots) avec ____ ; jamais un mot grammatical ; liste les variantes acceptées', '{type:"cloze", front (avec ____), back, accepted[], explanation, layer}'],
};
export function buildPrompt({ type = 'qa', n = 10, course = '', lang = 'français' }) {
  const [task, schema] = TASKS[type] ?? TASKS.qa;
  return [SYS, `Langue : ${lang}. Génère ${n} cartes ${task}.`, `Sortie : tableau JSON d'objets ${schema}. Réponds uniquement avec le JSON, sans texte autour.`, `<source>${course}</source>`].join('\n\n');
}

export function correctionPrompt(items) {
  const list = items.map((it, i) => `${i + 1}. Question : ${it.front}\nRéponse attendue : ${it.back}\nRéponse de l'élève : ${it.answer || '(vide)'}`).join('\n\n');
  return `Tu corriges des réponses d'élève. Pour chaque réponse : 1) liste les points clés présents, absents ou erronés par rapport à la réponse attendue ; 2) score = (points présents + 0,5 x partiels) / total ; 3) aucun point pour une réponse vague qui contourne la question ; 4) ne pénalise ni l'orthographe ni la formulation si le sens est correct.\nRéponds uniquement avec un tableau JSON de ${items.length} objets {score (0 à 1), feedback (2 phrases max)}, dans le même ordre.\n\n${list}`;
}

export function gapPrompt(gaps, source) {
  return `Entrées : blocages notés par l'élève après un examen blanc ou un défi :\n${gaps.map((g) => `- ${g.topic}${g.note ? ` : ${g.note}` : ''}`).join('\n')}\nTâche : pour chaque faille, 1) reformule en une phrase la notion manquante, 2) rattache-la à sa couche (noyau, pilier ou détail), 3) génère 2 cartes de rappel avec feedback explicatif, 4) propose une mini-explication orale que l'élève doit formuler lui-même avant de voir la réponse. Travaille uniquement à partir de la source.\nSortie : tableau JSON de cartes {type:"qa", front, back, explanation, layer} (les 2 cartes de chaque faille, à la suite). Réponds uniquement avec le JSON.\n\n<source>${source}</source>`;
}
