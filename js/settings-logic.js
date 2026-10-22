// Réglages (widgets). Les identifiants de connexion à la synchronisation ne sont PAS ici : ils restent hors des sauvegardes.
export const WIDGETS = [
  { id: 'today', title: 'Aujourd\'hui' }, { id: 'soon', title: 'À venir (7 jours)' }, { id: 'minical', title: 'Mini-calendrier' },
  { id: 'tasks', title: 'Tâches' }, { id: 'recent', title: 'Récents' }, { id: 'focus', title: 'Focus' },
  { id: 'memory', title: 'Mémorisation' }, { id: 'messages', title: 'Messages' }, { id: 'goal', title: 'Objectif en cours' }, { id: 'tip', title: 'Conseil du jour' },
];
export const WIDGET_BY_ID = Object.fromEntries(WIDGETS.map((w) => [w.id, w]));
export const TARGETS = [
  ['home', 'Home'], ['workspace', 'Workspace'], ['calendar', 'Agenda'], ['focus', 'Focus'], ['revision', 'Mémorisation'], ['library', 'Biblio'],
  ['messages', 'Messages'], ['videos', 'Vidéos'], ['notes', 'Notes'], ['links', 'Liens'], ['goals', 'Objectifs'], ['settings', 'Paramètres'],
];
// Un widget n'apparaît jamais dans l'onglet dont il est déjà le contenu.
export const HIDE_ON = { today: 'calendar', soon: 'calendar', minical: 'calendar', tasks: 'workspace', focus: 'focus', memory: 'revision', messages: 'messages', goal: 'goals', tip: 'goals' };

export const defaultSettings = () => ({
  widgets: Object.fromEntries(TARGETS.map(([k]) => [k, k === 'home' ? WIDGETS.map((w) => w.id) : ['today', 'tasks'].filter((id) => HIDE_ON[id] !== k)])),
});

export function sanitizeSettings(r) {
  const base = defaultSettings();
  const given = r.settings?.widgets && typeof r.settings.widgets === 'object' ? r.settings.widgets : {};
  const widgets = {};
  for (const [k] of TARGETS) {
    widgets[k] = Array.isArray(given[k]) ? [...new Set(given[k].filter((id) => WIDGET_BY_ID[id] && HIDE_ON[id] !== k))] : base.widgets[k];
  }
  return { settings: { widgets } };
}

export const widgetsFor = (settings, target) => (settings.widgets[target] ?? []).filter((id) => HIDE_ON[id] !== target);
