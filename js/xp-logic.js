// XP et niveaux : une récompense de régularité, pas un classement. Plafond quotidien pour ne pas encourager à « farmer ».
export const DAILY_CAP = 300;
export const XP = {
  card: { 1: 1, 2: 2, 3: 3 }, // revoir / moyen / bien
  exam: (note) => 10 + Math.round(note / 2),
  focus: 10, // un arbre planté
  tutor: 20, // une session de tuteur enregistrée
};
export const levelOf = (xp) => Math.floor(Math.sqrt(Math.max(0, xp) / 50)) + 1;
export const xpForLevel = (l) => 50 * (l - 1) ** 2;
export function progressOf(xp) {
  const level = levelOf(xp); const a = xpForLevel(level); const b = xpForLevel(level + 1);
  return { level, into: xp - a, need: b - a, ratio: (xp - a) / (b - a) };
}
export const defaultXp = () => ({ total: 0, days: {} });

export function sanitizeXp(r) {
  const x = r.xp && typeof r.xp === 'object' ? r.xp : {};
  const total = typeof x.total === 'number' && Number.isFinite(x.total) ? Math.min(1e7, Math.max(0, Math.round(x.total))) : 0;
  const days = {};
  for (const [d, n] of Object.entries(x.days && typeof x.days === 'object' ? x.days : {}).sort().slice(-400)) {
    if (/^\d{4}-\d{2}-\d{2}$/.test(d) && typeof n === 'number' && Number.isFinite(n)) days[d] = Math.min(DAILY_CAP, Math.max(0, Math.round(n)));
  }
  return { xp: { total, days } };
}

// Ajoute des XP à l'état (dans un commit) ; retourne les XP réellement gagnés après plafond du jour.
export function award(state, n, today) {
  const day = state.xp.days[today] ?? 0;
  const gain = Math.max(0, Math.min(Math.round(n), DAILY_CAP - day));
  state.xp.total += gain; state.xp.days[today] = day + gain;
  const keys = Object.keys(state.xp.days).sort();
  for (const k of keys.slice(0, Math.max(0, keys.length - 400))) delete state.xp.days[k];
  return gain;
}
