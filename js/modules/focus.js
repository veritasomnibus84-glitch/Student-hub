import { h, field, select, formatDate } from '../dom.js';
import { CAL_COLORS } from '../constants.js';
import { uid } from '../store.js';
import { ymd, DAY_SHORT } from '../calendar-logic.js';
import {
  GRACE_MS, stageOf, formatClock, formatMinutes, slicesOf, slicesIn, total, periodRange, shiftPeriod, periodLabel, buckets,
  tagBreakdown, hourProfile, weekdayProfile, peakIndex, trend, counts, minutesBy, DURATIONS,
} from '../focus-logic.js';
import { barChart, lineChart, donut, treeSvg } from '../ui/charts.js';
import { openSheet } from '../ui/dialog.js';
import { endRun } from '../focus-runtime.js';

const ui = { section: 'timer', planned: 25, tagId: '', title: '', todoId: '', eventId: '', period: 'day', date: ymd(new Date()), result: null };
export function showResult(session) { ui.result = session; }
// Prépare une session liée à UNE tâche ou UN événement, puis ouvre l'onglet Focus (utilisé par les menus).
export function prepareSession({ todoId = '', eventId = '', title = '' } = {}) { Object.assign(ui, { section: 'timer', todoId, eventId, title }); location.hash = '#focus'; }

const WEEKDAYS = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];
const tagOf = (state, id) => state.focusTags.find((t) => t.id === id) ?? { id: '', name: 'Sans tag', color: 'blue' };
const clamp = (n) => Math.min(180, Math.max(1, Math.round(Number(n) || 25)));

export function render(ctx) {
  const run = ctx.store.state.focusRun;
  return h('div', { class: 'page' }, h('h1', { class: 'page-title' }, 'Focus'),
    run ? running(ctx, run) : [
      h('div', { class: 'seg', role: 'group', 'aria-label': 'Section' }, [['timer', 'Concentration'], ['stats', 'Statistiques']].map(([k, l]) => h('button', {
        class: `seg__btn ${ui.section === k ? 'is-on' : ''}`.trim(), 'aria-pressed': String(ui.section === k), onclick: () => { ui.section = k; ctx.rerender(); },
      }, l))),
      ui.section === 'stats' ? stats(ctx) : idle(ctx)]);
}

/* ---------- Minuteur ---------- */
function idle(ctx) {
  const { store } = ctx; const s = store.state;
  if (!s.focusTags.some((t) => t.id === ui.tagId)) ui.tagId = s.focusTags[0].id;
  const title = h('input', { type: 'text', value: ui.title, maxlength: 200, placeholder: 'Titre de la session…', 'aria-label': 'Titre de la session', oninput: (e) => { ui.title = e.target.value; } });
  const eventSel = select([['', '— Aucun —'], ...[...s.events].sort((a, b) => a.date.localeCompare(b.date)).slice(-80).map((e) => [e.id, `${e.title} · ${formatDate(e.date)}`])], ui.eventId, {
    'aria-label': 'Événement lié', onchange: (e) => { ui.eventId = e.target.value; },
  });
  const todoSel = select([['', '— Aucune —'], ...s.todos.filter((t) => t.status !== 'Terminés').map((t) => [t.id, t.name || 'Sans titre'])], ui.todoId, {
    'aria-label': 'Tâche liée',
    onchange: (e) => {
      ui.todoId = e.target.value;
      const t = s.todos.find((x) => x.id === ui.todoId);
      if (t?.eventId) { ui.eventId = t.eventId; eventSel.value = t.eventId; }
      if (t && !ui.title) { ui.title = t.name; title.value = t.name; }
    },
  });
  return h('div', { class: 'stack' }, resultCard(ctx),
    h('section', { class: 'block stack' },
      h('div', { class: 'row wrap' },
        select(s.focusTags.map((t) => [t.id, t.name]), ui.tagId, { 'aria-label': 'Tag', onchange: (e) => { ui.tagId = e.target.value; } }),
        h('button', { class: 'btn btn--ghost', onclick: () => manageTags(ctx) }, 'Gérer les tags')),
      title, field('Tâche', todoSel), field('Événement', eventSel)),
    h('section', { class: 'focus' },
      h('div', { class: 'focus__globe' }, treeSvg(ui.result ? 4 : 0, ui.result?.status === 'failed')),
      h('div', { class: 'focus__clock', role: 'timer' }, formatClock(ui.planned * 60000)),
      h('div', { class: 'row wrap' }, DURATIONS.map((m) => h('button', {
        class: `seg__btn chipbtn ${ui.planned === m ? 'is-on' : ''}`.trim(), 'aria-pressed': String(ui.planned === m), onclick: () => { ui.planned = m; ctx.rerender(); },
      }, `${m} min`)),
      h('input', { type: 'number', min: 1, max: 180, value: ui.planned, class: 'focus__num', 'aria-label': 'Durée en minutes', onchange: (e) => { ui.planned = clamp(e.target.value); ctx.rerender(); } })),
      h('button', {
        class: 'btn btn--primary focus__start', onclick: () => {
          const now = Date.now(); ui.result = null;
          store.commit((st) => { st.focusRun = { id: uid(), start: now, planned: clamp(ui.planned), tagId: ui.tagId, title: ui.title.trim(), todoId: ui.todoId, eventId: ui.eventId, lastSeen: now, hiddenAt: null }; });
        },
      }, 'Démarrer la concentration'),
      h('p', { class: 'muted' }, `Reste sur Student Hub pendant la session : si tu quittes l'app plus de ${GRACE_MS / 1000} secondes, l'arbre meurt.`)));
}

function resultCard(ctx) {
  const r = ui.result;
  if (!r) return null;
  const t = ctx.store.state.todos.find((x) => x.id === r.todoId);
  return h('section', { class: 'block stack', role: 'status' },
    h('h2', null, r.status === 'done' ? 'Arbre planté' : 'Arbre mort'),
    h('p', null, r.status === 'done' ? `${formatMinutes(r.actual)} de concentration.` : `Session interrompue après ${formatMinutes(r.actual)}.`),
    t && t.status !== 'Terminés' && h('button', { class: 'btn', onclick: () => ctx.store.commit(() => { t.status = 'Terminés'; }) }, `Marquer « ${t.name} » comme terminée`),
    h('button', { class: 'btn btn--ghost', onclick: () => { ui.result = null; ctx.rerender(); } }, 'OK'));
}

function running(ctx, run) {
  const s = ctx.store.state; const tag = tagOf(s, run.tagId);
  const clock = h('div', { class: 'focus__clock', role: 'timer' }, '');
  const globe = h('div', { class: 'focus__globe' });
  let stage = -1;
  const update = () => {
    const now = Date.now();
    clock.textContent = formatClock(run.start + run.planned * 60000 - now);
    const st = stageOf(now - run.start, run.planned);
    if (st !== stage) { stage = st; globe.replaceChildren(treeSvg(st)); }
  };
  update();
  const iv = setInterval(() => { if (!clock.isConnected) clearInterval(iv); else update(); }, 500);
  if (typeof iv === 'object') iv.unref?.();
  return h('section', { class: 'focus' },
    h('p', { class: 'muted' }, [tag.name, run.title].filter(Boolean).join(' · ')), globe, clock,
    h('p', { class: 'muted' }, `Reste sur Student Hub : si tu quittes l'app plus de ${GRACE_MS / 1000} secondes (autre application, écran verrouillé), l'arbre meurt.`),
    h('button', {
      class: 'btn btn--danger', onclick: () => {
        if (!confirm('Abandonner la session ? L\'arbre mourra.')) return;
        ui.result = endRun(ctx.store, 'failed'); ctx.rerender();
      },
    }, 'Abandonner'));
}

function manageTags(ctx) {
  const { store } = ctx;
  let rows = store.state.focusTags.map((t) => ({ ...t }));
  const host = h('div', { class: 'stack' });
  const draw = () => host.replaceChildren(...rows.map((r, i) => h('div', { class: 'row' },
    h('input', { type: 'text', value: r.name, maxlength: 40, 'aria-label': `Nom du tag ${i + 1}`, oninput: (e) => { r.name = e.target.value; } }),
    select(CAL_COLORS, r.color, { 'aria-label': `Couleur du tag ${i + 1}`, onchange: (e) => { r.color = e.target.value; } }),
    h('button', { type: 'button', class: 'btn btn--ghost', 'aria-label': `Supprimer le tag ${r.name}`, onclick: () => { rows = rows.filter((x) => x !== r); draw(); } }, '×'))),
  h('button', { type: 'button', class: 'btn', onclick: () => { rows.push({ id: uid(), name: '', color: 'blue' }); draw(); } }, '+ Ajouter un tag'));
  draw();
  openSheet('Tags de concentration', host, {
    onSubmit: () => {
      const clean = rows.map((r) => ({ ...r, name: r.name.trim() })).filter((r) => r.name);
      if (!clean.length) return 'Garde au moins un tag.';
      store.commit((st) => { st.focusTags = clean; });
      return '';
    },
  });
}

/* ---------- Statistiques ---------- */
const card = (title, ...kids) => h('section', { class: 'block stack' }, h('h2', null, title), ...kids);

function forest(list) {
  if (!list.length) return h('p', { class: 'muted' }, 'Aucun arbre sur cette période.');
  return h('ul', { class: 'forest' }, list.slice(-60).map((x) => h('li', { title: `${x.title || 'Session'} · ${formatMinutes(x.actual)}` }, treeSvg(4, x.status === 'failed'))));
}

function stats(ctx) {
  const s = ctx.store.state; const all = slicesOf(s.sessions); const range = periodRange(ui.period, ui.date);
  const inRange = slicesIn(all, range); const c = counts(s.sessions, range);
  const bk = buckets(ui.period, all, ui.date); const tr = trend(s.sessions, ui.period, ui.date);
  const hours = hourProfile(all); const days = weekdayProfile(all); const hp = peakIndex(hours); const dp = peakIndex(days);
  const tags = tagBreakdown(inRange);
  const sessionsHere = s.sessions.filter((x) => { const d = ymd(new Date(x.start)); return d >= range[0] && d <= range[1]; });
  const go = (fn) => () => { fn(); ctx.rerender(); };
  const max = Math.max(tr.cur, tr.prev, 1);
  const named = (rows, find) => (rows.length
    ? h('ul', { class: 'plain' }, rows.slice(0, 5).map((r) => h('li', { class: 'row between' }, h('span', null, find(r.id)), h('b', null, formatMinutes(r.minutes)))))
    : h('p', { class: 'muted' }, 'Rien pour l\'instant.'));
  return h('div', { class: 'stack' },
    h('div', { class: 'seg seg--wrap', role: 'group', 'aria-label': 'Période' }, [['day', 'Jour'], ['week', 'Semaine'], ['month', 'Mois'], ['year', 'Année']].map(([k, l]) => h('button', {
      class: `seg__btn ${ui.period === k ? 'is-on' : ''}`.trim(), 'aria-pressed': String(ui.period === k), onclick: go(() => { ui.period = k; }),
    }, l))),
    h('div', { class: 'row between' },
      h('button', { class: 'btn', 'aria-label': 'Période précédente', onclick: go(() => { ui.date = shiftPeriod(ui.period, ui.date, -1); }) }, '‹'),
      h('strong', { class: 'cal__title' }, periodLabel(ui.period, ui.date)),
      h('button', { class: 'btn', 'aria-label': 'Période suivante', onclick: go(() => { ui.date = shiftPeriod(ui.period, ui.date, 1); }) }, '›')),
    h('section', { class: 'block stack' },
      h('div', { class: 'row between' }, h('strong', null, `Arbres plantés : ${c.done}`), h('strong', null, `Arbres morts : ${c.failed}`)), forest(sessionsHere)),
    card('Répartition du temps de concentration',
      h('p', null, 'Temps de concentration total : ', h('b', null, formatMinutes(total(inRange)))),
      barChart(bk.values, bk.labels, { label: 'Temps de concentration en minutes', every: ui.period === 'day' ? 3 : ui.period === 'month' ? 5 : 1 })),
    card('Jour de concentration maximale',
      h('p', null, dp < 0 ? 'Pas encore de données.' : ['Plus concentré le ', h('b', null, WEEKDAYS[dp]), ' en général']),
      barChart(days, DAY_SHORT.map((x) => x.replace('.', '')), { label: 'Minutes par jour de la semaine' })),
    card('Période de concentration maximale de la journée',
      h('p', null, hp < 0 ? 'Pas encore de données.' : ['Concentration maximale moyenne vers ', h('b', null, `${String(hp).padStart(2, '0')}:00`)]),
      lineChart(hours, hours.map((_, i) => String(i).padStart(2, '0')), { label: 'Minutes par heure de la journée', every: 6, peak: hp })),
    card('Tendance de concentration',
      h('p', null, tr.delta === 0 ? 'Autant que la période précédente.' : `Par rapport à la période précédente : ${formatMinutes(Math.abs(tr.delta))} ${tr.delta > 0 ? 'de plus' : 'de moins'}.`),
      h('label', { class: 'bar' }, h('span', null, 'Cette période'), h('progress', { max, value: tr.cur }), h('b', null, formatMinutes(tr.cur))),
      h('label', { class: 'bar' }, h('span', null, 'Précédente'), h('progress', { max, value: tr.prev }), h('b', null, formatMinutes(tr.prev)))),
    card('Distribution des tags',
      h('div', { class: 'donutwrap' }, donut(tags.map((t) => ({ value: t.minutes, color: tagOf(s, t.tagId).color, label: tagOf(s, t.tagId).name })), formatMinutes(total(inRange)))),
      tags.length ? h('ul', { class: 'plain' }, tags.map((t) => h('li', { class: 'row between' },
        h('span', { class: 'row' }, h('i', { class: `dot c--${tagOf(s, t.tagId).color}` }), tagOf(s, t.tagId).name), h('span', null, `${t.pct} % · ${formatMinutes(t.minutes)}`)))) : h('p', { class: 'muted' }, 'Pas de données.')),
    card('Temps par tâche', named(minutesBy(s.sessions, 'todoId', range), (id) => s.todos.find((t) => t.id === id)?.name || 'Tâche supprimée')),
    card('Temps par événement', named(minutesBy(s.sessions, 'eventId', range), (id) => s.events.find((e) => e.id === id)?.title || 'Événement supprimé')));
}
