// Applique les réglages d'affichage : thème, taille du texte, premier jour de la semaine.
import { setFirstDay } from './calendar-logic.js';

export function applyAppearance(settings, root = document.documentElement) {
  const { theme, size } = settings.appearance;
  if (theme === 'auto') root.removeAttribute('data-theme'); else root.setAttribute('data-theme', theme);
  if (size === 'normal') root.removeAttribute('data-size'); else root.setAttribute('data-size', size);
  setFirstDay(settings.agenda.firstDay);
}
