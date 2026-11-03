import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { setupDOM, memory } from './helpers/dom.js';
const win = setupDOM();
const S = await import('../js/settings-logic.js');
const CL = await import('../js/calendar-logic.js');
const { applyAppearance } = await import('../js/appearance.js');
const { createStore, newEvent } = await import('../js/store.js');
const { review, newMemory, label } = await import('../js/fsrs.js');
const L = await import('../js/revision-logic.js');
const Study = await import('../js/study-logic.js');
const { startReminders } = await import('../js/reminders.js');
const { TABS } = await import('../js/app.js');
const cal = await import('../js/modules/calendar.js');

const change = (el, v) => { el.value = v; el.dispatchEvent(new win.Event('change', { bubbles: true })); };
const click = (el) => el.dispatchEvent(new win.Event('click', { bubbles: true }));
function mount(key, store, extra = {}) {
  const mod = TABS.find(([k]) => k === key)[2]; mod.resetView?.();
  const host = document.createElement('div'); document.body.append(host);
  const ctx = { store, data: {}, ...extra, rerender: () => host.replaceChildren(mod.render(ctx)) };
  store.subscribe(() => ctx.rerender()); ctx.rerender(); return { host, ctx };
}

test('réglages : valeurs par défaut, bornes, choix inconnus remplacés', () => {
  const d = S.defaultSettings();
  assert.deepEqual([d.appearance, d.agenda.firstDay, d.focus, d.memo, d.notify.reminders, d.sync.auto], [{ theme: 'auto', size: 'normal' }, 1, { minutes: 25, grace: 10 }, { retention: 0.9, newPerDay: 20 }, true, false]);
  const r = S.sanitizeSettings({ settings: { appearance: { theme: 'neon', size: 'large' }, lang: { cards: 'klingon', voice: 'en-GB' }, agenda: { firstDay: 3, duration: 5, calendarId: 'x'.repeat(99) }, focus: { minutes: 999, grace: 1 }, memo: { retention: 0.5, newPerDay: -4 }, notify: { reminders: false }, sync: { auto: true } } }).settings;
  assert.deepEqual([r.appearance.theme, r.appearance.size, r.lang.cards, r.lang.voice, r.agenda.firstDay, r.agenda.duration, r.agenda.calendarId.length], ['auto', 'large', 'français', 'en-GB', 1, 15, 40]);
  assert.deepEqual([r.focus.minutes, r.focus.grace, r.memo.retention, r.memo.newPerDay, r.notify.reminders, r.sync.auto], [180, 5, 0.9, 1, false, true]);
  assert.deepEqual(S.sanitizeSettings({ settings: { widgets: { home: ['tip'] } } }).settings.widgets.home, ['tip', 'ready', 'late', 'load']); // anciennes données : les widgets choisis, plus les nouveaux ajoutés une seule fois
  const seen = S.WIDGETS.map((w) => w.id);
  assert.deepEqual(S.sanitizeSettings({ settings: { widgetsSeen: seen, widgets: { home: ['tip'] } } }).settings.widgets.home, ['tip'], 'un widget retiré ne revient pas');
});

test('apparence : thème et taille posés sur la page ; « auto » les retire', () => {
  const root = document.createElement('html'); const s = S.defaultSettings();
  s.appearance = { theme: 'dark', size: 'xlarge' }; applyAppearance(s, root);
  assert.equal(root.getAttribute('data-theme'), 'dark'); assert.equal(root.getAttribute('data-size'), 'xlarge');
  s.appearance = { theme: 'auto', size: 'normal' }; applyAppearance(s, root);
  assert.equal(root.hasAttribute('data-theme'), false); assert.equal(root.hasAttribute('data-size'), false);
  const css = readFileSync(new URL('../css/base.css', import.meta.url), 'utf8');
  assert.match(css, /:root\[data-theme="dark"\]/); assert.match(css, /:root:not\(\[data-theme="light"\]\)/); assert.match(css, /data-size="large"/);
});

test('premier jour de la semaine : lundi, dimanche ou samedi', () => {
  const d = '2026-11-11'; // mercredi
  CL.setFirstDay(1); assert.equal(CL.weekDays(d)[0], '2026-11-09'); assert.deepEqual(CL.dayShort().slice(0, 2), ['lun.', 'mar.']);
  CL.setFirstDay(0); assert.equal(CL.weekDays(d)[0], '2026-11-08'); assert.equal(CL.weekDays(d)[6], '2026-11-14'); assert.deepEqual(CL.dayLetters().slice(0, 2), ['D', 'L']);
  assert.equal(CL.monthGrid(2026, 10)[0][0], '2026-11-01'); // le 1er novembre 2026 est un dimanche
  CL.setFirstDay(6); assert.equal(CL.weekDays(d)[0], '2026-11-07'); assert.equal(CL.dayShort()[0], 'sam.');
  CL.setFirstDay(9); assert.equal(CL.getFirstDay(), 1); // valeur absurde : retour au lundi
  assert.equal(CL.mondayOf(d), '2026-11-09'); // les statistiques Focus restent à base lundi
});

test('rétention visée : plus haute = intervalles plus courts ; cartes nouvelles par session plafonnées', () => {
  const m = review(review(newMemory(), 3, 0), 3, 3 * 86400000);
  const long = label(m, 3, 3 * 86400000, 0.8); const short = label(m, 3, 3 * 86400000, 0.95);
  const days = (x) => Number(x.replace(/\D/g, ''));
  assert.ok(days(short) < days(long), `${short} < ${long}`);
  const cards = Array.from({ length: 30 }, () => L.newCard({ front: 'q' }));
  assert.equal(L.queue(cards, Date.now(), 5).length, 5);
});

test('langue des cartes : les prompts demandent la langue choisie', () => {
  assert.ok(L.buildPrompt({ type: 'qa', course: 'C', lang: 'English' }).includes('Langue : English'));
  assert.ok(Study.sheetPrompt({ style: 'full', length: 'short', source: 'C', lang: 'español' }).includes('Écris en español'));
  assert.ok(Study.podcastPrompt({ source: 'C', lang: 'Deutsch' }).includes('Langue du script : Deutsch'));
  assert.ok(Study.layersPrompt({ source: 'C', lang: 'italiano' }).includes('Rédige en italiano'));
  assert.ok(Study.sheetPrompt({ style: 'full', length: 'short', source: 'C' }).includes('Écris en français'));
});

test('rappels : désactivables dans les réglages', async () => {
  const store = createStore(memory()); const calId = store.state.calendars[0].id;
  const now = new Date(); const pad = (n) => String(n).padStart(2, '0');
  const date = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const soon = new Date(now.getTime() + 5 * 60000); const start = `${pad(soon.getHours())}:${pad(soon.getMinutes())}`;
  store.commit((s) => s.events.push(newEvent({ id: 'r', calendarId: calId, title: 'Bientôt', date, start, end: '23:59', reminder: 10 })));
  store.commit((s) => { s.settings.notify.reminders = false; });
  const timer = startReminders(store); clearInterval(timer);
  assert.equal(document.querySelectorAll('.toast').length, 0);
  store.commit((s) => { s.settings.notify.reminders = true; });
  const t2 = startReminders(store); clearInterval(t2);
  assert.equal(document.querySelectorAll('.toast').length, 1);
});

test('nouvel événement : durée et agenda par défaut des réglages', () => {
  const store = createStore(memory()); store.commit((s) => { s.calendars.push({ id: 'perso', name: 'Perso', color: 'red', visible: true }); s.settings.agenda = { firstDay: 1, duration: 90, calendarId: 'perso' }; });
  CL.setFirstDay(1); cal.openCalendarAt('2026-11-09', 'week');
  const { host } = mount('calendar', store);
  const col = host.querySelectorAll('.wk__col')[0];
  col.dispatchEvent(Object.assign(new win.Event('click', { bubbles: true }), { clientX: 5, clientY: 48 * 10 }));
  const dlg = [...document.querySelectorAll('dialog')].pop();
  assert.deepEqual([...dlg.querySelectorAll('input[type="time"]')].map((i) => i.value), ['10:00', '11:30']);
  assert.equal(dlg.querySelector('select').value, 'perso');
});

test('onglet Paramètres : chaque réglage s\'enregistre', () => {
  const store = createStore(memory());
  const { host } = mount('settings', store, { lockControls: () => document.createElement('div') });
  for (const title of ['Apparence', 'Langues', 'Compte et sécurité', 'Notifications', 'Agenda', 'Focus', 'Mémorisation', 'Synchronisation', 'Widgets']) assert.ok(host.querySelector(`[data-pref="${title}"]`) || host.textContent.includes(title), title);
  const find = (label) => host.querySelector(`[aria-label="${label}"]`);
  change(find('Thème'), 'dark'); assert.equal(store.state.settings.appearance.theme, 'dark');
  change(find('Taille du texte'), 'large'); assert.equal(store.state.settings.appearance.size, 'large');
  change(find('Langue des cartes, fiches et podcasts générés'), 'English'); assert.equal(store.state.settings.lang.cards, 'English');
  change(find('Voix de lecture à voix haute'), 'en-GB'); assert.equal(store.state.settings.lang.voice, 'en-GB');
  change(find('Premier jour de la semaine'), '0'); assert.equal(store.state.settings.agenda.firstDay, 0);
  change(find('Durée d\'un nouvel événement (minutes)'), '5000'); assert.equal(store.state.settings.agenda.duration, 480); // borné
  change(find('Durée par défaut d\'une session (minutes)'), '40'); assert.equal(store.state.settings.focus.minutes, 40);
  change(find('Délai avant que l\'arbre meure si tu quittes l\'app (secondes)'), '1'); assert.equal(store.state.settings.focus.grace, 5);
  change(find('Rétention visée'), '0.95'); assert.equal(store.state.settings.memo.retention, 0.95);
  change(find('Nouvelles cartes par session'), 'abc'); assert.equal(store.state.settings.memo.newPerDay, 20); // illisible : valeur conservée
  const box = host.querySelector('input[type="checkbox"]'); box.checked = false; box.dispatchEvent(new win.Event('change', { bubbles: true }));
  assert.equal(store.state.settings.notify.reminders, false);
  CL.setFirstDay(1);
});
