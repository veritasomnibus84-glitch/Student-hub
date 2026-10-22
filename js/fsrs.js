// FSRS-6 (paramètres par défaut de py-fsrs, open-spaced-repetition). Notes : 1 à revoir, 2 moyen, 3 bien, 4 facile.
export const W = [0.212, 1.2931, 2.3065, 8.2956, 6.4133, 0.8334, 3.0194, 0.001, 1.8722, 0.1666, 0.796, 1.4835, 0.0614, 0.2629, 1.6483, 0.6014, 1.8729, 0.5425, 0.0912, 0.0658, 0.1542];
const DECAY = -W[20];
const FACTOR = 0.9 ** (1 / DECAY) - 1;
const DAY = 86400000;
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const d0 = (g) => W[4] - Math.exp(W[5] * (g - 1)) + 1;

export const retrievability = (days, s) => (1 + (FACTOR * Math.max(0, days)) / s) ** DECAY;
export const interval = (s, retention = 0.9) => clamp(Math.round((s / FACTOR) * (retention ** (1 / DECAY) - 1)), 1, 36500);
export const newMemory = () => ({ state: 'new', s: 0, d: 0, due: '', last: '', reps: 0, lapses: 0 });

// Retourne la nouvelle mémoire de la carte après une note (la carte d'origine n'est pas modifiée).
export function review(mem, grade, now = Date.now(), retention = 0.9) {
  const m = { ...mem }; m.reps += 1; m.last = new Date(now).toISOString();
  if (mem.state === 'new') {
    m.s = Math.max(0.001, W[grade - 1]); m.d = clamp(d0(grade), 1, 10);
  } else {
    const days = (now - Date.parse(mem.last)) / DAY;
    const r = retrievability(days, mem.s);
    const d1 = mem.d + ((10 - mem.d) * -(W[6] * (grade - 3))) / 9;
    m.d = clamp(W[7] * d0(4) + (1 - W[7]) * d1, 1, 10);
    if (days < 1) {
      let inc = Math.exp(W[17] * (grade - 3 + W[18])) * mem.s ** -W[19];
      if (grade >= 2) inc = Math.max(inc, 1);
      m.s = Math.max(0.001, mem.s * inc);
    } else if (grade === 1) {
      const long = W[11] * mem.d ** -W[12] * ((mem.s + 1) ** W[13] - 1) * Math.exp((1 - r) * W[14]);
      m.s = Math.max(0.001, Math.min(long, mem.s / Math.exp(W[17] * W[18])));
    } else {
      const bonus = (grade === 2 ? W[15] : 1) * (grade === 4 ? W[16] : 1);
      m.s = Math.max(0.001, mem.s * (1 + Math.exp(W[8]) * (11 - mem.d) * mem.s ** -W[9] * (Math.exp((1 - r) * W[10]) - 1) * bonus));
    }
  }
  if (grade === 1) m.lapses += mem.state === 'new' ? 0 : 1;
  const short = grade === 1 ? 1 / 1440 : grade === 2 && (mem.state === 'new' || mem.state === 'learning') ? 15 / 1440 : 0;
  m.state = grade === 1 || (grade === 2 && short) ? 'learning' : 'review';
  m.due = new Date(now + (short ? short * DAY : interval(m.s, retention) * DAY)).toISOString();
  return m;
}

// Texte affiché sous un bouton : « < 1 min », « 15 min », « 3 j ».
export function label(mem, grade, now = Date.now()) {
  const ms = Date.parse(review(mem, grade, now).due) - now;
  if (ms <= 60000) return '< 1 min';
  if (ms < 3600000) return `${Math.round(ms / 60000)} min`;
  return ms < 2 * DAY ? `${Math.round(ms / 3600000)} h` : `${Math.round(ms / DAY)} j`;
}

export const isDue = (mem, now = Date.now()) => mem.state === 'new' || Date.parse(mem.due) <= now;
export const level = (mem) => (mem.state === 'new' ? 'new' : mem.s >= 21 ? 'mastered' : 'learning');
