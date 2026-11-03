// Marqueurs de suppression : ce qu'on supprime ne doit pas revenir quand on fusionne avec un autre appareil.
export const TRACKED = ['todos', 'projects', 'events', 'notes', 'links', 'courses', 'library', 'decks', 'cards', 'gaps', 'goals', 'tips', 'sessions', 'calendars', 'focusTags', 'focusPlans', 'exams', 'tutorLogs'];
export const MAX_PER_COLLECTION = 2000;
const KEEP_DAYS = 400;

export const idSets = (state) => Object.fromEntries(TRACKED.map((k) => [k, new Set((Array.isArray(state[k]) ? state[k] : []).map((x) => x?.id))]));

// À appeler après une modification : les identifiants qui ont disparu deviennent des marqueurs datés.
export function recordDeletions(state, before, now = new Date().toISOString()) {
  state.tombstones ??= {};
  for (const k of TRACKED) {
    const current = new Set((Array.isArray(state[k]) ? state[k] : []).map((x) => x?.id));
    for (const id of before[k]) if (id && !current.has(id)) { state.tombstones[k] ??= {}; state.tombstones[k][id] = now; }
    const entries = Object.entries(state.tombstones[k] ?? {});
    if (entries.length > MAX_PER_COLLECTION) state.tombstones[k] = Object.fromEntries(entries.sort((a, b) => b[1].localeCompare(a[1])).slice(0, MAX_PER_COLLECTION));
  }
}

// Retire des collections tout ce qui porte un marqueur de suppression.
export function applyTombstones(state) {
  const t = state.tombstones ?? {}; let removed = 0;
  for (const k of TRACKED) {
    const dead = t[k]; if (!dead || !Array.isArray(state[k])) continue;
    const kept = state[k].filter((x) => !(x?.id in dead));
    removed += state[k].length - kept.length; state[k] = kept;
  }
  return removed;
}

// Union de deux ensembles de marqueurs (le plus récent des deux pour un même identifiant).
export function mergeTombstones(a = {}, b = {}) {
  const out = {};
  for (const k of TRACKED) {
    const m = { ...(a[k] ?? {}) };
    for (const [id, ts] of Object.entries(b[k] ?? {})) if (!m[id] || ts > m[id]) m[id] = ts;
    if (Object.keys(m).length) out[k] = m;
  }
  return out;
}

export function sanitizeTombstones(r, now = Date.now()) {
  const t = r.tombstones && typeof r.tombstones === 'object' ? r.tombstones : {};
  const out = {}; const limit = new Date(now - KEEP_DAYS * 86400000).toISOString();
  for (const k of TRACKED) {
    const src = t[k] && typeof t[k] === 'object' ? t[k] : {};
    const m = Object.fromEntries(Object.entries(src).filter(([id, ts]) => id.length > 0 && id.length <= 40 && typeof ts === 'string' && !Number.isNaN(Date.parse(ts)) && ts >= limit)
      .sort((x, y) => y[1].localeCompare(x[1])).slice(0, MAX_PER_COLLECTION));
    if (Object.keys(m).length) out[k] = m;
  }
  return { tombstones: out };
}
