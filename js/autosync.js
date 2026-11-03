// Synchronisation automatique : à l'ouverture, au retour sur l'app et toutes les 5 minutes (si activée dans Paramètres).
import { loadSync, saveSync, createClient, syncNow } from './sync.js';
import { showToast } from './reminders.js';

export const MIN_GAP = 5 * 60000;
let running = false; let lastError = 0;

export async function autoSyncOnce(ctx, { force = false, now = () => Date.now(), fetchFn, notify = showToast } = {}) {
  const { store, storage } = ctx;
  if (!force && !store.state.settings.sync.auto) return 'off';
  const cfg = loadSync(storage);
  if (!cfg.session || !cfg.url || !cfg.anonKey) return 'no-account';
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return 'offline';
  if (!force && cfg.last && now() - Date.parse(cfg.last) < MIN_GAP) return 'recent';
  // Une fenêtre d'édition ouverte garde des références aux données : on ne les remplace pas sous les doigts de l'utilisateur.
  if (typeof document !== 'undefined' && document.querySelector('dialog[open]')) return 'busy-ui';
  if (running) return 'busy';
  running = true;
  try {
    const client = createClient({ url: cfg.url, anonKey: cfg.anonKey, getSession: () => loadSync(storage).session, setSession: (session) => saveSync(storage, { ...loadSync(storage), session }), fetchFn });
    await syncNow(client, store);
    saveSync(storage, { ...loadSync(storage), last: new Date(now()).toISOString() });
    return 'ok';
  } catch (e) {
    if (now() - lastError > 10 * 60000) { lastError = now(); notify(`Synchronisation impossible : ${e.message}`); } // un seul message toutes les 10 minutes
    return 'error';
  } finally { running = false; }
}
export const resetAutoSync = () => { running = false; lastError = 0; };

export function startAutoSync(ctx) {
  autoSyncOnce(ctx);
  if (typeof document !== 'undefined') document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') autoSyncOnce(ctx); });
  const timer = setInterval(() => autoSyncOnce(ctx), MIN_GAP); timer.unref?.();
  return timer;
}
