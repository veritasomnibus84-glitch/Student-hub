// Planning optimal : calcul déterministe (l'IA ne fait que l'expliquer). Catalogue §8 et §17.3.
import { ymd, parseYMD, addDays } from './calendar-logic.js';
import { layerRank } from './revision-logic.js';

const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
// Écart conseillé entre révisions, en part du délai : 30 % à 7 j, 15 % à 30 j, 7,5 % à 1 an (interpolation log-linéaire : estimation, pas un résultat de l'article).
const PTS = [[7, 0.3], [30, 0.15], [365, 0.075]];
export function gapFraction(D) {
  if (D <= PTS[0][0]) return PTS[0][1];
  if (D >= PTS[2][0]) return PTS[2][1];
  const [[d0, f0], [d1, f1]] = D <= PTS[1][0] ? [PTS[0], PTS[1]] : [PTS[1], PTS[2]];
  return Math.exp(Math.log(f0) + ((Math.log(D) - Math.log(d0)) / (Math.log(d1) - Math.log(d0))) * (Math.log(f1) - Math.log(f0)));
}
export const coverage = (target) => clamp(0.5 + (0.5 * (target - 10)) / 10, 0.5, 1);
export const gauges = (target) => ({ timeSaved: clamp((1 - coverage(target)) * 2, 0, 1), mastery: clamp(0.55 + (0.4 * (target - 10)) / 10, 0, 1) });

export const MIN_PER_NEW = 1.5; export const MIN_PER_REVIEW = 0.5;
export const TASK_LABELS = { layer_scan: 'Cartographier le cours en couches', free_recall: 'Rappel libre sur page blanche', new: 'nouvelles cartes', due_review: 'révisions', mock_exam: 'Examen blanc' };

export function buildPlan({ cards, exam, target = 16, today, maxMin = 60, examMinutes = 30 }) {
  if (!exam) return null;
  const D = Math.round((parseYMD(exam) - parseYMD(today)) / 86400000);
  if (D < 0) return null;
  const fresh = cards.filter((c) => c.mem.state === 'new').sort((a, b) => layerRank(a) - layerRank(b));
  const introduced0 = cards.length - fresh.length;
  const cover = Math.ceil(cards.length * coverage(target));
  let remaining = clamp(cover - introduced0, 0, fresh.length);
  const introDays = Math.max(1, Math.floor(D * 0.6));
  const perDay = Math.ceil(remaining / introDays);
  const mocks = new Set((D >= 7 ? [D - 7, D - 2] : D >= 2 ? [D - 1] : []).filter((d) => d >= 0));
  let introduced = introduced0;
  const days = [];
  for (let i = 0; i <= D; i += 1) {
    const tasks = []; let minutes = 0;
    const add = (type, n, min) => { tasks.push({ type, n, minutes: Math.round(min) }); minutes += min; };
    if (i === 0) { add('layer_scan', 0, 25); add('free_recall', 0, 5); }
    const reviews = i === 0 ? cards.filter((c) => c.mem.state !== 'new' && Date.parse(c.mem.due) <= Date.parse(`${today}T23:59:59`)).length : Math.round(introduced * 0.3);
    if (reviews > 0) add('due_review', reviews, reviews * MIN_PER_REVIEW);
    if (mocks.has(i)) add('mock_exam', 0, examMinutes);
    else if (i < introDays && remaining > 0) {
      const room = Math.floor((maxMin - minutes) / MIN_PER_NEW);
      const n = clamp(Math.min(perDay, remaining, room), 0, remaining);
      if (n > 0) { add('new', n, n * MIN_PER_NEW); remaining -= n; introduced += n; }
    }
    days.push({ date: addDays(today, i), tasks, minutes: Math.round(minutes) });
  }
  return { D, gap: Math.max(1, Math.round(D * gapFraction(Math.max(D, 1)))), cover, uncovered: remaining, days, gauges: gauges(target) };
}

export const todayTasks = (plan, today) => plan?.days.find((d) => d.date === today)?.tasks ?? [];
export function describeTask(t) {
  if (t.type === 'new') return `${t.n} nouvelle${t.n > 1 ? 's' : ''} carte${t.n > 1 ? 's' : ''}`;
  if (t.type === 'due_review') return `${t.n} révision${t.n > 1 ? 's' : ''}`;
  return `${TASK_LABELS[t.type]} (${t.minutes} min)`;
}
export { ymd };
