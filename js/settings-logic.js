// Réglages (widgets). Les identifiants de connexion à la synchronisation ne sont PAS ici : ils restent hors des sauvegardes.
export const WIDGETS = [
  { id: 'today', title: 'Aujourd\'hui' }, { id: 'soon', title: 'À venir (7 jours)' }, { id: 'minical', title: 'Mini-calendrier' },
  { id: 'tasks', title: 'Tâches' }, { id: 'recent', title: 'Récents' }, { id: 'focus', title: 'Focus' },
  { id: 'memory', title: 'Mémorisation' }, { id: 'messages', title: 'Messages' }, { id: 'goal', title: 'Objectif en cours' }, { id: 'tip', title: 'Conseil du jour' }, { id: 'xp', title: 'Niveau et XP' },
  { id: 'ready', title: 'Prêtes à démarrer' }, { id: 'late', title: 'En retard' }, { id: 'load', title: 'Charge de la semaine' },
];
// Widgets qui existaient avant le suivi de projets : sert à ajouter une seule fois les nouveaux à Home chez ceux qui l'ont déjà personnalisé.
export const LEGACY_WIDGETS = ['today', 'soon', 'minical', 'tasks', 'recent', 'focus', 'memory', 'messages', 'goal', 'tip', 'xp'];
export const WIDGET_BY_ID = Object.fromEntries(WIDGETS.map((w) => [w.id, w]));
export const TARGETS = [
  ['home', 'Home'], ['workspace', 'Workspace'], ['calendar', 'Agenda'], ['focus', 'Focus'], ['revision', 'Mémorisation'], ['library', 'Biblio'],
  ['messages', 'Messages'], ['videos', 'Vidéos'], ['notes', 'Notes'], ['links', 'Liens'], ['goals', 'Objectifs'], ['settings', 'Paramètres'],
];
// Un widget n'apparaît jamais dans l'onglet dont il est déjà le contenu.
export const HIDE_ON = { today: 'calendar', soon: 'calendar', minical: 'calendar', tasks: 'workspace', focus: 'focus', memory: 'revision', messages: 'messages', goal: 'goals', tip: 'goals', ready: 'workspace', late: 'workspace', load: 'workspace' };

export const THEMES = [['auto', 'Automatique (comme ton appareil)'], ['light', 'Clair'], ['dark', 'Sombre']];
export const SIZES = [['normal', 'Normal'], ['large', 'Grand'], ['xlarge', 'Très grand']];
export const CARD_LANGS = [['français', 'Français'], ['English', 'English'], ['español', 'Español'], ['Deutsch', 'Deutsch'], ['italiano', 'Italiano'], ['العربية', 'العربية']];
export const VOICE_LANGS = [['fr-FR', 'Français'], ['en-US', 'English (US)'], ['en-GB', 'English (UK)'], ['es-ES', 'Español'], ['de-DE', 'Deutsch'], ['it-IT', 'Italiano'], ['ar-SA', 'العربية']];
export const FIRST_DAYS = [[1, 'Lundi'], [0, 'Dimanche'], [6, 'Samedi']];
export const RETENTIONS = [[0.8, '80 % (moins de révisions)'], [0.85, '85 %'], [0.9, '90 % (recommandé)'], [0.95, '95 % (plus de révisions)']];

export const defaultSettings = () => ({
  widgets: Object.fromEntries(TARGETS.map(([k]) => [k, k === 'home' ? WIDGETS.map((w) => w.id) : ['today', 'tasks'].filter((id) => HIDE_ON[id] !== k)])),
  appearance: { theme: 'auto', size: 'normal' },
  lang: { cards: 'français', voice: 'fr-FR' },
  agenda: { firstDay: 1, duration: 60, calendarId: '' },
  focus: { minutes: 25, grace: 10 },
  memo: { retention: 0.9, newPerDay: 20 },
  notify: { reminders: true },
  sync: { auto: false },
  work: { capacityMin: 240, strictDeps: false, autoCloseParent: true },
  widgetsSeen: WIDGETS.map((w) => w.id),
});

export function sanitizeSettings(r) {
  const base = defaultSettings();
  const given = r.settings?.widgets && typeof r.settings.widgets === 'object' ? r.settings.widgets : {};
  const widgets = {};
  for (const [k] of TARGETS) {
    widgets[k] = Array.isArray(given[k]) ? [...new Set(given[k].filter((id) => WIDGET_BY_ID[id] && HIDE_ON[id] !== k))] : base.widgets[k];
  }
  // Nouveaux widgets : ajoutés une seule fois à Home s'il a déjà été personnalisé ; un widget retiré ensuite ne revient pas.
  const seenRaw = r.settings && Array.isArray(r.settings.widgetsSeen) ? r.settings.widgetsSeen.filter((id) => WIDGET_BY_ID[id]) : LEGACY_WIDGETS;
  if (Array.isArray(given.home)) widgets.home = [...widgets.home, ...WIDGETS.map((w) => w.id).filter((id) => !seenRaw.includes(id) && !widgets.home.includes(id) && HIDE_ON[id] !== 'home')];
  const g = r.settings && typeof r.settings === 'object' ? r.settings : {};
  const num = (v, a, b, d) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(b, Math.max(a, Math.round(v))) : d);
  const pick = (v, list, d) => (list.some(([k]) => k === v) ? v : d);
  const sec = (k) => (g[k] && typeof g[k] === 'object' ? g[k] : {});
  return {
    settings: {
      widgets,
      appearance: { theme: pick(sec('appearance').theme, THEMES, 'auto'), size: pick(sec('appearance').size, SIZES, 'normal') },
      lang: { cards: pick(sec('lang').cards, CARD_LANGS, 'français'), voice: pick(sec('lang').voice, VOICE_LANGS, 'fr-FR') },
      agenda: { firstDay: pick(sec('agenda').firstDay, FIRST_DAYS, 1), duration: num(sec('agenda').duration, 15, 480, 60), calendarId: typeof sec('agenda').calendarId === 'string' ? sec('agenda').calendarId.slice(0, 40) : '' },
      focus: { minutes: num(sec('focus').minutes, 1, 180, 25), grace: num(sec('focus').grace, 5, 60, 10) },
      memo: { retention: pick(sec('memo').retention, RETENTIONS, 0.9), newPerDay: num(sec('memo').newPerDay, 1, 100, 20) },
      notify: { reminders: sec('notify').reminders !== false },
      sync: { auto: sec('sync').auto === true },
      widgetsSeen: WIDGETS.map((w) => w.id),
      work: { capacityMin: num(sec('work').capacityMin, 30, 960, 240), strictDeps: sec('work').strictDeps === true, autoCloseParent: sec('work').autoCloseParent !== false },
    },
  };
}

export const widgetsFor = (settings, target) => (settings.widgets[target] ?? []).filter((id) => HIDE_ON[id] !== target);
