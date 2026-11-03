// Chronomètre de l'app : tourne même quand on change d'onglet de l'app, et échoue si on quitte l'app.
import { reconcile, buildSession } from './focus-logic.js';
import { award, XP } from './xp-logic.js';
import { ymd } from './calendar-logic.js';

export function endRun(store, status, now = Date.now()) {
  const run = store.state.focusRun;
  if (!run) return null;
  const session = buildSession(run, now, status);
  store.commit((s) => { s.sessions.push(session); s.focusRun = null; if (status === 'done') { award(s, XP.focus, ymd(new Date(now))); const p = (s.focusPlans ?? []).find((x) => x.id === run.planId); if (p) p.done = true; } });
  return session;
}

export function startFocusRuntime(store, { onEnd = () => {}, isHidden = () => document.hidden, grace } = {}) {
  const check = () => {
    const run = store.state.focusRun;
    if (!run) return;
    const now = Date.now(); const hidden = isHidden();
    const action = reconcile(run, now, { hidden, grace: typeof grace === 'function' ? grace() : grace });
    if (action !== 'none') { onEnd(endRun(store, action === 'complete' ? 'done' : 'failed', now)); return; }
    if (!hidden) store.commit(() => { run.lastSeen = now; }, { silent: true });
  };
  document.addEventListener('visibilitychange', () => {
    const run = store.state.focusRun;
    if (!run) return;
    const now = Date.now();
    if (isHidden()) { store.commit(() => { run.hiddenAt = now; run.lastSeen = now; }, { silent: true }); return; }
    check();
    const still = store.state.focusRun;
    if (still) store.commit(() => { still.hiddenAt = null; still.lastSeen = now; }, { silent: true });
  });
  check();
  return setInterval(check, 1000);
}
