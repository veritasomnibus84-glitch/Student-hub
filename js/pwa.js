// Application installable : enregistrement du service worker (hors ligne), invite d'installation, état.
import { showToast } from './reminders.js';

let installEvent = null;
const listeners = new Set();
export const onInstallChange = (f) => { listeners.add(f); return () => listeners.delete(f); };
const fire = () => listeners.forEach((f) => f());

export function initInstall(win = window) {
  win.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); installEvent = e; fire(); });
  win.addEventListener('appinstalled', () => { installEvent = null; fire(); });
}
export const canInstall = () => !!installEvent;
export async function promptInstall() {
  if (!installEvent) return 'indisponible';
  const e = installEvent; installEvent = null;
  e.prompt();
  const choice = await e.userChoice.catch(() => ({ outcome: 'dismissed' }));
  fire();
  return choice.outcome; // 'accepted' | 'dismissed'
}

export const isStandalone = (win = window) => !!(win.matchMedia?.('(display-mode: standalone)').matches || win.navigator?.standalone === true);

// Enregistre sw.js ; prévient quand une nouvelle version prend la main (sans recharger : on ne perd pas ce que tu fais).
export function registerSW({ nav = typeof navigator === 'undefined' ? null : navigator, loc = typeof location === 'undefined' ? { protocol: '' } : location, onUpdate = showToast } = {}) {
  if (!nav?.serviceWorker || !/^https?:$/.test(loc.protocol)) return Promise.resolve(null);
  const hadController = !!nav.serviceWorker.controller;
  nav.serviceWorker.addEventListener('controllerchange', () => { if (hadController) onUpdate('Nouvelle version de Student Hub installée : recharge la page pour l\'utiliser.'); });
  return nav.serviceWorker.register('sw.js').catch(() => null);
}

export const offlineReady = (nav = typeof navigator === 'undefined' ? null : navigator) => !!nav?.serviceWorker?.controller;
