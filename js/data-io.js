// Import / export des données, par onglet ou en totalité (logique pure, sans navigateur).
export const SECTIONS = {
  workspace: { label: 'Workspace', keys: ['courses', 'todos'] },
  calendar: { label: 'Agenda', keys: ['calendars', 'events', 'calPrefs'] },
  focus: { label: 'Focus', keys: ['focusTags', 'sessions'] },
  revision: { label: 'Mémorisation', keys: ['decks', 'cards', 'gaps', 'exams', 'revDays'] },
  goals: { label: 'Objectifs et conseils', keys: ['goals', 'tips', 'tipsSeeded'] },
  library: { label: 'Bibliothèque (catalogue)', keys: ['library'] },
  messages: { label: 'Messages', keys: ['localSummaries', 'read'] },
  videos: { label: 'Vidéos', keys: ['localVideos'] },
  notes: { label: 'Notes', keys: ['notes'] },
  links: { label: 'Liens', keys: ['links'] },
};
export const ALL_KEYS = [...new Set(Object.values(SECTIONS).flatMap((s) => s.keys))];

const pick = (state, keys) => Object.fromEntries(keys.map((k) => [k, state[k]]));
const wrap = (kind, extra, data) => JSON.stringify({ app: 'student-hub', kind, ...extra, version: 1, exportedAt: new Date().toISOString(), data }, null, 2);

export const exportSection = (state, id) => wrap('section', { section: id }, pick(state, SECTIONS[id].keys));
export const exportAll = (state) => wrap('all', {}, pick(state, ALL_KEYS));

// Fusion : les éléments de même id sont remplacés par ceux du fichier, les autres sont ajoutés.
export function mergeList(a = [], b = []) {
  if (typeof (a[0] ?? b[0]) === 'string') return [...new Set([...a, ...b])];
  const m = new Map(a.map((x) => [x.id, x]));
  b.forEach((x) => m.set(x.id, x));
  return [...m.values()];
}

export function parseImport(text) {
  let obj;
  try { obj = JSON.parse(text); } catch { throw new Error('Fichier illisible : ce n\'est pas du JSON.'); }
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) throw new Error('Fichier non reconnu.');
  if (obj.app === 'student-hub' && obj.data && typeof obj.data === 'object') {
    if (obj.kind === 'section' && SECTIONS[obj.section]) return { kind: 'section', section: obj.section, data: obj.data };
    if (obj.kind === 'all') return { kind: 'all', data: obj.data };
    throw new Error('Fichier Student Hub non reconnu.');
  }
  if (ALL_KEYS.some((k) => k in obj)) return { kind: 'all', data: obj }; // ancien format
  throw new Error('Fichier non reconnu : ce n\'est pas une sauvegarde Student Hub.');
}

export function applyImport(state, parsed, { mode = 'merge', only = null, sanitize }) {
  const allowed = only ? SECTIONS[only].keys : ALL_KEYS;
  const base = parsed.kind === 'section' ? SECTIONS[parsed.section].keys : ALL_KEYS;
  const keys = base.filter((k) => allowed.includes(k) && k in parsed.data);
  if (!keys.length) {
    throw new Error(parsed.kind === 'section'
      ? `Ce fichier contient les données « ${SECTIONS[parsed.section].label} », pas celles de cet onglet.`
      : 'Ce fichier ne contient rien pour cet onglet.');
  }
  const next = { ...state }; const counts = {};
  for (const k of keys) {
    const inc = parsed.data[k];
    next[k] = mode === 'merge' && Array.isArray(inc) && Array.isArray(state[k]) ? mergeList(state[k], inc) : inc;
    counts[k] = Array.isArray(inc) ? inc.length : 1;
  }
  return { state: sanitize(next), counts };
}

const asList = (text, key) => {
  let o; try { o = JSON.parse(text); } catch { return null; }
  const arr = Array.isArray(o) ? o : Array.isArray(o?.[key]) ? o[key] : null;
  return arr && arr.every((x) => x && typeof x === 'object') ? arr : null;
};
export const parseSummaries = (text) => asList(text, 'summaries');
export const parseVideos = (text) => asList(text, 'videos');
