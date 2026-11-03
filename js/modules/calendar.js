import { h, field, select, empty, formatDate } from '../dom.js';
import { newEvent, newCalendar, removeCalendar, removeEvent, newTodo, newNote, uid } from '../store.js';
import { attachMenu, copyItem, deleteItem } from '../ui/context-menu.js';
import { prepareSession } from './focus.js';
import { openSlotPlanner } from '../ui/slot-planner.js';
import { openFocusPlanSheet } from '../ui/focus-plan.js';
import { CAL_COLORS, REPEATS, REMINDERS } from '../constants.js';
import {
  MONTHS, dayLetters, dayShort, ymd, parseYMD, addDays, weekDays, monthGrid, isoWeek, shiftMonth, itemsOn, layoutDay, longDate, searchEvents,
  minutesOf, itemLabel,
} from '../calendar-logic.js';
import { openSheet } from '../ui/dialog.js';
import { openTodoDialog } from '../ui/todo-dialog.js';
import { changeStatus } from '../ui/todo-actions.js';
import { toICS, parseICS } from '../ics.js';
import { showCourse } from './workspace.js';
import { showToast } from '../reminders.js';

const HOUR_PX = 48;
const pad = (n) => String(n).padStart(2, '0');
const SLOT = 15; // minutes : pas de la création par glisser
const cal = { view: 'month', date: ymd(new Date()), query: '', message: '' };

export function openCalendarAt(date, view = 'month') { cal.date = date; cal.view = view; cal.query = ''; }

function title() {
  const d = parseYMD(cal.date);
  if (cal.view === 'year') return String(d.getFullYear());
  if (cal.view === 'week') {
    const days = weekDays(cal.date); const a = parseYMD(days[0]); const b = parseYMD(days[6]);
    const mo = a.getMonth() === b.getMonth() ? MONTHS[a.getMonth()] : `${MONTHS[a.getMonth()]}–${MONTHS[b.getMonth()]}`;
    return `${mo} ${b.getFullYear()} · semaine ${isoWeek(cal.date)}`;
  }
  return `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}
const step = (n) => { cal.date = cal.view === 'year' ? shiftMonth(cal.date, 12 * n) : cal.view === 'week' ? addDays(cal.date, 7 * n) : shiftMonth(cal.date, n); };

export function render(ctx) {
  const host = h('div', { class: 'stack' });
  const draw = () => host.replaceChildren(bodyFor(ctx));
  draw();
  return h('div', { class: 'page' }, h('h1', { class: 'page-title' }, 'Agenda'), toolbar(ctx, draw), panel(ctx), host);
}

function bodyFor(ctx) {
  if (cal.query.trim()) return searchResults(ctx);
  return { week: weekView, year: yearView, month: monthView }[cal.view](ctx);
}

function toolbar(ctx, draw) {
  const go = (fn) => () => { fn(); ctx.rerender(); };
  return h('div', { class: 'stack' },
    h('div', { class: 'row wrap' },
      h('button', { class: 'btn', 'aria-label': 'Précédent', onclick: go(() => step(-1)) }, '‹'),
      h('button', { class: 'btn', onclick: go(() => { cal.date = ymd(new Date()); }) }, 'Aujourd\'hui'),
      h('button', { class: 'btn', 'aria-label': 'Suivant', onclick: go(() => step(1)) }, '›'),
      h('strong', { class: 'cal__title', 'aria-live': 'polite' }, title())),
    h('div', { class: 'toolbar' },
      h('div', { class: 'seg', role: 'group', 'aria-label': 'Vue' }, [['week', 'Semaine'], ['month', 'Mois'], ['year', 'Année']].map(([k, l]) => h('button', {
        class: `seg__btn ${cal.view === k ? 'is-on' : ''}`.trim(), 'aria-pressed': String(cal.view === k), onclick: go(() => { cal.view = k; cal.query = ''; }),
      }, l))),
      h('button', { class: 'btn btn--primary', onclick: () => openEventDialog(ctx, { date: cal.date }) }, '+ Événement'),
      h('input', {
        type: 'search', placeholder: 'Rechercher…', value: cal.query, 'aria-label': 'Rechercher dans l\'agenda',
        oninput: (e) => { cal.query = e.target.value; draw(); },
      })));
}

function openItem(ctx, item) {
  if (item.kind === 'event') { if (item.ref.repeat !== 'none') chooseScope(ctx, item.ref, item.origin); else openEventDialog(ctx, item.ref); }
  else if (item.kind === 'todo') openTodoDialog(ctx.store, item.ref);
  else if (item.kind === 'slot') openTodoDialog(ctx.store, item.ref);
  else if (item.kind === 'focus') prepareSession({ todoId: item.ref.todoId, eventId: item.ref.eventId, title: item.title.replace(/^Focus : /, ''), planId: item.ref.id, minutes: item.ref.minutes, tagId: item.ref.tagId });
  else if (item.kind === 'study') location.hash = '#revision';
  else { showCourse(item.ref.id); location.hash = '#workspace'; }
}

// Événement répété : modifier seulement cette occurrence, ou toute la série.
function chooseScope(ctx, ev, origin) {
  const dlg = openSheet('Événement répété', h('div', { class: 'stack' },
    h('p', null, `« ${ev.title} » se répète. Que veux-tu modifier ?`),
    h('button', { type: 'button', class: 'btn btn--primary', onclick: () => { dlg.close(); openOccurrenceDialog(ctx, ev, origin); } }, 'Cet événement seulement'),
    h('button', { type: 'button', class: 'btn', onclick: () => { dlg.close(); openEventDialog(ctx, ev); } }, 'Toute la série')), { submitLabel: 'Annuler', onSubmit: () => '' });
}

const setException = (store, ev, origin, value) => store.commit((st) => {
  const t = st.events.find((x) => x.id === ev.id); if (!t) return;
  const next = { ...(t.exceptions ?? {}) };
  if (value) next[origin] = value; else delete next[origin];
  t.exceptions = next;
});

// Une seule occurrence : titre, jour, heures, lieu, description ; ou la supprimer ; ou revenir à la série.
function openOccurrenceDialog(ctx, ev, origin) {
  const f = { ...ev, ...(ev.exceptions?.[origin] ?? {}) };
  const titleIn = h('input', { type: 'text', value: f.title, required: true, maxlength: 300 });
  const date = h('input', { type: 'date', value: f.date === ev.date && !ev.exceptions?.[origin]?.date ? origin : f.date, required: true });
  const start = h('input', { type: 'time', value: f.start }); const end = h('input', { type: 'time', value: f.end });
  const place = h('input', { type: 'text', value: f.location, maxlength: 300 });
  const desc = h('textarea', { rows: 3, maxlength: 5000, value: f.description });
  const had = !!ev.exceptions?.[origin];
  const extra = h('div', { class: 'row wrap' },
    h('button', { type: 'button', class: 'btn btn--danger', onclick: () => { if (confirm('Supprimer seulement cet événement de la série ?')) { setException(ctx.store, ev, origin, { deleted: true }); document.querySelector('dialog.sheet')?.close(); } } }, 'Supprimer cet événement seulement'),
    had && h('button', { type: 'button', class: 'btn', onclick: () => { setException(ctx.store, ev, origin, null); document.querySelector('dialog.sheet')?.close(); } }, 'Revenir à la série'));
  openSheet(`Cet événement seulement · ${formatDate(origin)}`, h('div', { class: 'stack' },
    field('Titre', titleIn), field('Date', date), ev.allDay ? null : h('div', { class: 'row' }, field('Début', start), field('Fin', end)), field('Lieu', place), field('Description', desc)), {
    extra,
    onSubmit: () => {
      if (!titleIn.value.trim()) return 'Le titre est obligatoire.';
      if (!date.value) return 'La date est obligatoire.';
      if (!ev.allDay && (!start.value || !end.value || end.value <= start.value)) return 'La fin doit être après le début.';
      setException(ctx.store, ev, origin, {
        date: date.value, title: titleIn.value.trim(), location: place.value.trim(), description: desc.value.trim(),
        ...(ev.allDay ? {} : { start: start.value, end: end.value }),
      });
      return '';
    },
  });
}

function itemMenu(ctx, item) {
    const { store } = ctx;
    if (item.kind === 'slot') {
      const t = item.ref;
      return [
        { label: item.slot.done ? 'Marquer non faite' : 'Marquer faite', onSelect: () => store.commit(() => { item.slot.done = !item.slot.done; }) },
        { label: 'Ouvrir la tâche', onSelect: () => openTodoDialog(store, t) },
        { label: 'Planifier mon travail…', onSelect: () => openSlotPlanner(store, t) },
        { label: 'Démarrer un Focus', onSelect: () => prepareSession({ todoId: t.id, title: t.name }) },
        { label: 'Supprimer cette plage', danger: true, onSelect: () => { if (confirm('Supprimer cette plage de travail ?')) store.commit(() => { t.slots = t.slots.filter((x) => x.id !== item.slot.id); }); } },
      ];
    }
    if (item.kind === 'focus') {
      const p = item.ref;
      return [
        { label: 'Lancer maintenant', onSelect: () => openItem(ctx, item) },
        { label: p.done ? 'Marquer non faite' : 'Marquer faite', onSelect: () => store.commit(() => { p.done = !p.done; }) },
        { label: 'Supprimer la session', danger: true, onSelect: () => { if (confirm('Supprimer cette session planifiée ?')) store.commit((st) => { st.focusPlans = st.focusPlans.filter((x) => x.id !== p.id); }); } },
      ];
    }
    if (item.kind === 'study') return [{ label: 'Ouvrir Mémorisation', onSelect: () => { location.hash = '#revision'; } }, copyItem(item.title)];
    if (item.kind === 'event') {
      const ev = item.ref; const series = ev.repeat !== 'none';
      return [
        { label: 'Modifier', onSelect: () => openItem(ctx, item) },
        { label: 'Ajouter une tâche', onSelect: () => openTodoDialog(store, null, { eventId: ev.id, deadline: ev.date }) },
        { label: 'Démarrer un Focus', onSelect: () => prepareSession({ eventId: ev.id, title: ev.title }) },
        { label: 'Planifier un Focus…', onSelect: () => openFocusPlanSheet(store, { eventId: ev.id, title: ev.title, date: item.date }) },
        { label: 'Dupliquer', onSelect: () => store.commit((st) => { st.events.push(newEvent({ ...ev, id: uid(), title: `${ev.title} (copie)` })); }) },
        copyItem(ev.title),
        series && { label: 'Supprimer cet événement seulement', danger: true, onSelect: () => { if (confirm('Supprimer seulement cet événement de la série ?')) setException(store, ev, item.origin, { deleted: true }); } },
        series ? { label: 'Supprimer la série', danger: true, onSelect: () => { if (confirm('Supprimer toute la série ?')) store.commit((st) => removeEvent(st, ev.id)); } }
          : deleteItem(`l'événement « ${ev.title} »`, () => store.commit((st) => removeEvent(st, ev.id))),
      ];
    }
    return item.kind === 'todo' ? [{ label: 'Modifier', onSelect: () => openTodoDialog(store, item.ref) }, { label: 'Planifier mon travail…', onSelect: () => openSlotPlanner(store, item.ref) }, copyItem(item.title)] : [copyItem(item.title)];
}

function chip(ctx, item, long = false) {
  const label = itemLabel(item);
  const items = () => itemMenu(ctx, item);
  return attachMenu(h('button', {
    class: `ev c--${item.color} ${long ? 'ev--row' : ''} ${item.done ? 'is-done' : ''}`.replace(/\s+/g, ' ').trim(), onclick: (e) => { e.stopPropagation(); openItem(ctx, item); },
  }, long && h('span', { class: 'ev__t' }, label), h('span', { class: 'ev__n' }, item.title), long && item.kind === 'event' && relationBadge(ctx.store.state, item.id)), items);
}

function relationBadge(state, eventId) {
  const t = state.todos.filter((x) => x.eventId === eventId).length;
  const n = state.notes.filter((x) => x.eventId === eventId).length;
  if (!t && !n) return null;
  return h('span', { class: 'muted ev__rel' }, [t && `${t} tâche${t > 1 ? 's' : ''}`, n && `${n} note${n > 1 ? 's' : ''}`].filter(Boolean).join(' · '));
}

/* ---------- Mois ---------- */
function monthView(ctx) {
  const s = ctx.store.state; const d = parseYMD(cal.date); const today = ymd(new Date());
  const weeks = monthGrid(d.getFullYear(), d.getMonth());
  return h('div', { class: 'stack' },
    h('div', { class: 'mgrid mgrid--head', 'aria-hidden': 'true' }, dayLetters().map((l) => h('span', null, l))),
    h('div', { class: 'mgrid' }, weeks.flat().map((date) => {
      const items = itemsOn(s, date);
      const inMonth = parseYMD(date).getMonth() === d.getMonth();
      return h('button', {
        class: `mday ${inMonth ? '' : 'is-out'} ${date === today ? 'is-today' : ''} ${date === cal.date ? 'is-sel' : ''}`.replace(/\s+/g, ' ').trim(),
        'aria-label': `${longDate(date)}${items.length ? `, ${items.length} élément${items.length > 1 ? 's' : ''}` : ''}`,
        onclick: () => { cal.date = date; ctx.rerender(); },
        ondblclick: () => openEventDialog(ctx, { date }),
      },
      h('span', { class: 'mday__n' }, Number(date.slice(8))),
      h('span', { class: 'dots' }, items.slice(0, 4).map((i) => h('i', { class: `dot c--${i.color}` }))),
      h('span', { class: 'mday__ev' }, items.slice(0, 2).map((i) => h('span', { class: `ev c--${i.color}` }, h('span', { class: 'ev__n' }, i.title))),
        items.length > 2 && h('span', { class: 'muted' }, `+${items.length - 2}`)));
    })),
    dayPanel(ctx, cal.date));
}

function dayPanel(ctx, date) {
  const items = itemsOn(ctx.store.state, date);
  return h('section', { class: 'block' },
    h('div', { class: 'row between' }, h('h2', null, longDate(date)), h('button', { class: 'btn', onclick: () => openEventDialog(ctx, { date }) }, '+ Ajouter')),
    items.length ? h('ul', { class: 'plain' }, items.map((i) => h('li', null, chip(ctx, i, true)))) : h('p', { class: 'muted' }, 'Rien de prévu.'));
}

/* ---------- Semaine ---------- */
function weekView(ctx) {
  const s = ctx.store.state; const days = weekDays(cal.date); const today = ymd(new Date());
  const per = days.map((d) => itemsOn(s, d));
  const head = h('div', { class: 'wk__row' }, h('span', { class: 'wk__gutter' }), days.map((d, i) => h('span', { class: `wk__dayname ${d === today ? 'is-today' : ''}`.trim() }, `${dayShort()[i]} `, h('b', null, Number(d.slice(8))))));
  const allday = h('div', { class: 'wk__row wk__allday' }, h('span', { class: 'wk__gutter' }, 'Jour'),
    per.map((items) => h('div', { class: 'wk__cell' }, items.filter((x) => x.allDay).map((x) => chip(ctx, x)))));
  const hours = h('div', { class: 'wk__gutter' }, Array.from({ length: 24 }, (_, hr) => h('span', { class: 'wk__h' }, `${pad(hr)}:00`)));
  // Interactions partagées entre les colonnes : tracer (création, même sur plusieurs jours) et déplacer un événement.
  let drag = null; let moving = null; let swallow = false; let ghosts = []; const colEls = [];
  const clock = (m) => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
  const clearGhosts = () => { ghosts.forEach((g) => g.remove()); ghosts = []; };
  const colIndexAt = (x, fallback) => { const k = colEls.findIndex((c) => { const r = c.getBoundingClientRect(); return x >= r.left && x < r.right; }); return k < 0 ? fallback : k; };
  const minuteAtY = (y) => Math.max(0, Math.min(24 * 60 - SLOT, Math.floor((((y - colEls[0].getBoundingClientRect().top) / HOUR_PX) * 60) / SLOT) * SLOT));
  const ghost = (k, from, to, cls, text = '') => {
    const g = h('i', { class: cls, 'aria-hidden': 'true' }, text);
    g.style.top = `${(from * HOUR_PX) / 60}px`; g.style.height = `${Math.max(8, ((to - from) * HOUR_PX) / 60)}px`; colEls[k].append(g); ghosts.push(g);
  };
  const ordered = () => { const a = { idx: drag.idx0, min: drag.a }; const b2 = { idx: drag.idx1, min: drag.b }; return a.idx < b2.idx || (a.idx === b2.idx && a.min <= b2.min) ? [a, b2] : [b2, a]; };
  const paintCreate = () => { clearGhosts(); const [p1, p2] = ordered(); for (let k = p1.idx; k <= p2.idx; k += 1) ghost(k, k === p1.idx ? p1.min : 0, k === p2.idx ? p2.min + SLOT : 24 * 60, 'wk__drag'); };
  const swallowClick = () => { swallow = true; setTimeout(() => { swallow = false; }, 60); }; // le clic qui suit un tracé est ignoré ; sans clic, l'état ne reste pas bloqué
  const cols = days.map((d, i) => {
    const col = h('div', {
      class: `wk__col ${d === today ? 'is-today' : ''}`.trim(), role: 'group', 'aria-label': longDate(d),
      onclick: (e) => {
        if (swallow) { swallow = false; return; }
        if (e.target !== col) return;
        const hr = Math.min(23, Math.floor((e.clientY - col.getBoundingClientRect().top) / HOUR_PX));
        const dur = ctx.store.state.settings.agenda.duration; const endMin = Math.min(hr * 60 + dur, 24 * 60 - 1);
        openEventDialog(ctx, { date: d, start: `${pad(hr)}:00`, end: `${pad(Math.floor(endMin / 60))}:${pad(endMin % 60)}` });
      },
    });
    colEls.push(col);
    // Glisser pour créer : souris et stylet tout de suite, doigt après un appui long de 350 ms (sinon c'est un défilement).
    const arm = (id) => { drag.armed = true; col.setPointerCapture?.(id); paintCreate(); };
    col.addEventListener('pointerdown', (e) => {
      if (e.target !== col || (e.pointerType === 'mouse' && e.button !== 0)) return;
      const a = minuteAtY(e.clientY);
      drag = { idx0: i, a, idx1: i, b: a, armed: false, x: e.clientX, y: e.clientY, timer: 0 };
      if (e.pointerType === 'mouse') arm(e.pointerId); else drag.timer = setTimeout(() => arm(e.pointerId), 350);
    });
    col.addEventListener('pointermove', (e) => {
      if (!drag) return;
      if (!drag.armed) { if (Math.hypot(e.clientX - drag.x, e.clientY - drag.y) > 8) { clearTimeout(drag.timer); drag = null; } return; }
      drag.idx1 = colIndexAt(e.clientX, drag.idx1); drag.b = minuteAtY(e.clientY); paintCreate();
    });
    const finish = (e) => {
      if (!drag) return;
      clearTimeout(drag.timer);
      const done = drag; drag = null; clearGhosts();
      if (!done.armed || e.type === 'pointercancel') return;
      if (done.a === done.b && done.idx0 === done.idx1 && e.pointerType === 'mouse') return; // simple clic : le gestionnaire de clic crée l'événement
      swallowClick();
      drag = done; const [p1, p2] = ordered(); drag = null;
      const hi = p2.min + SLOT; const endClock = hi >= 24 * 60 ? '23:59' : clock(hi);
      openEventDialog(ctx, p1.idx === p2.idx
        ? { date: days[p1.idx], start: clock(p1.min), end: endClock }
        : { date: days[p1.idx], start: clock(p1.min), endDate: days[p2.idx], end: endClock }); // tracé sur plusieurs colonnes : événement sur plusieurs jours
    };
    col.addEventListener('pointerup', finish); col.addEventListener('pointercancel', finish);
    col.addEventListener('touchmove', (e) => { if (drag?.armed) e.preventDefault(); }, { passive: false });
    const timed = per[i].filter((x) => !x.allDay);
    const ownerOf = (sl) => (sl.kind === 'slot' && sl.eventId ? timed.find((x) => x.kind === 'event' && x.id === sl.eventId && x.start <= sl.start && x.end >= sl.end) : null);
    const nested = timed.filter((x) => ownerOf(x));
    for (const o of layoutDay(timed.filter((x) => !nested.includes(x)))) {
      const b = attachMenu(h('button', { class: `wk__ev c--${o.item.color}`, onclick: (e) => { e.stopPropagation(); if (swallow) { swallow = false; return; } openItem(ctx, o.item); } },
        h('b', null, o.item.title), h('span', null, `${o.item.start}–${o.item.end}`)), () => itemMenu(ctx, o.item));
      b.style.top = `${(o.s * HOUR_PX) / 60}px`;
      b.style.height = `${Math.max(20, ((o.e - o.s) * HOUR_PX) / 60 - 2)}px`;
      b.style.left = `${(o.col / o.cols) * 100}%`;
      b.style.width = `calc(${100 / o.cols}% - 2px)`;
      // Déplacer un événement d'un seul jour par glisser (souris et stylet) : même jour/heure ailleurs, par pas de 15 min.
      if (o.item.kind === 'event' && o.item.span === 0 && !o.item.allDay) {
        const item = o.item; const dur = minutesOf(item.end) - minutesOf(item.start);
        b.addEventListener('pointerdown', (e) => {
          if (e.pointerType === 'touch' || e.button !== 0) return;
          moving = { item, x: e.clientX, y: e.clientY, started: false, idx0: i, idx: i, min0: minutesOf(item.start), min: minutesOf(item.start) };
          b.setPointerCapture?.(e.pointerId);
        });
        b.addEventListener('pointermove', (e) => {
          if (!moving || moving.item !== item) return;
          if (!moving.started) { if (Math.hypot(e.clientX - moving.x, e.clientY - moving.y) < 6) return; moving.started = true; }
          moving.idx = colIndexAt(e.clientX, moving.idx0);
          moving.min = Math.max(0, Math.min(24 * 60 - dur, moving.min0 + Math.round(((e.clientY - moving.y) * 60) / HOUR_PX / SLOT) * SLOT));
          clearGhosts(); ghost(moving.idx, moving.min, moving.min + dur, 'wk__ghost', item.title);
        });
        const end = (e) => {
          if (!moving || moving.item !== item) return;
          const mv = moving; moving = null; clearGhosts();
          if (!mv.started || e.type === 'pointercancel') return;
          swallowClick();
          moveEvent(ctx, item, days[mv.idx], clock(mv.min), clock(mv.min + dur));
        };
        b.addEventListener('pointerup', end); b.addEventListener('pointercancel', end);
      }
      for (const sl of nested.filter((x) => ownerOf(x) === o.item)) {
        const kid = attachMenu(h('span', {
          class: `wk__slot ${sl.done ? 'is-done' : ''}`.trim(), role: 'button', tabindex: '0', 'aria-label': `Plage de travail : ${sl.title}, ${sl.start}–${sl.end}`,
          onclick: (e) => { e.stopPropagation(); openItem(ctx, sl); },
          onkeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); openItem(ctx, sl); } },
        }, `${sl.done ? '☑' : '☐'} ${sl.title}`), () => itemMenu(ctx, sl));
        const mins = (t) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3));
        kid.style.top = `${((mins(sl.start) - o.s) * HOUR_PX) / 60}px`;
        kid.style.height = `${Math.max(14, ((mins(sl.end) - mins(sl.start)) * HOUR_PX) / 60 - 1)}px`;
        b.append(kid);
      }
      col.append(b);
    }
    if (d === today) {
      const now = new Date(); const line = h('i', { class: 'wk__now', 'aria-hidden': 'true' });
      line.style.top = `${((now.getHours() * 60 + now.getMinutes()) * HOUR_PX) / 60}px`;
      col.append(line);
    }
    return col;
  });
  const scroll = h('div', { class: 'wk__scroll' }, h('div', { class: 'wk__row wk__body' }, hours, cols));
  if (typeof requestAnimationFrame === 'function') requestAnimationFrame(() => { scroll.scrollTop = 7 * HOUR_PX; });
  return h('div', { class: 'wk' }, head, allday, scroll);
}

// Déplacement par glisser : un événement simple change de jour/heures ; pour une série, seule cette occurrence est déplacée.
function moveEvent(ctx, item, date, start, end) {
  const ev = item.ref;
  if (end <= start || (date === item.date && start === item.start)) return;
  if (ev.repeat === 'none') ctx.store.commit(() => { Object.assign(ev, { date, start, end }); });
  else { setException(ctx.store, ev, item.origin, { ...(ev.exceptions?.[item.origin] ?? {}), date, start, end }); showToast('Seul cet événement a été déplacé : la série ne change pas.'); }
}

/* ---------- Année ---------- */
function yearView(ctx) {
  const s = ctx.store.state; const y = parseYMD(cal.date).getFullYear(); const today = ymd(new Date());
  const pick = (date) => { cal.date = date; cal.view = 'month'; ctx.rerender(); };
  return h('div', { class: 'yr' }, MONTHS.map((name, m) => h('section', { class: 'yr__m' },
    h('button', { class: 'linkish', onclick: () => pick(ymd(new Date(y, m, 1))) }, name),
    h('div', { class: 'yr__grid', 'aria-hidden': 'true' },
      dayLetters().map((l) => h('span', { class: 'muted' }, l)),
      monthGrid(y, m).flat().map((d) => {
        const inM = parseYMD(d).getMonth() === m;
        const has = inM && itemsOn(s, d).length > 0;
        return h('button', { class: `yr__d ${inM ? '' : 'is-out'} ${d === today ? 'is-today' : ''} ${has ? 'has' : ''}`.replace(/\s+/g, ' ').trim(), tabindex: '-1', onclick: () => pick(d) }, inM ? Number(d.slice(8)) : '');
      })))));
}

/* ---------- Recherche ---------- */
function searchResults(ctx) {
  const res = searchEvents(ctx.store.state, cal.query);
  if (!res.length) return empty('Aucun résultat.');
  return h('ul', { class: 'plain' }, res.map((r) => h('li', { class: 'block row between' },
    h('button', { class: 'linkish', onclick: () => { cal.date = r.date; cal.view = 'month'; cal.query = ''; ctx.rerender(); } }, r.title),
    h('span', { class: 'muted' }, [formatDate(r.date), r.repeat && r.repeat !== 'none' && 'répété', r.kind === 'todo' && 'to-do'].filter(Boolean).join(' · ')))));
}

/* ---------- Agendas, import/export, rappels ---------- */
function panel(ctx) {
  const { store } = ctx; const s = store.state;
  const say = (t) => { cal.message = t; const el = document.getElementById('cal-msg'); if (el) el.textContent = t; };
  const file = h('input', {
    type: 'file', accept: '.ics,text/calendar', class: 'visually-hidden', 'aria-label': 'Importer un fichier .ics',
    onchange: async (e) => {
      const f = e.target.files[0]; if (!f) return;
      try {
        const { events, skipped } = parseICS(await f.text(), s.calendars[0].id);
        store.commit((st) => { st.events.push(...events.slice(0, 2000)); });
        say(`${events.length} événement${events.length > 1 ? 's' : ''} importé${events.length > 1 ? 's' : ''}${skipped ? `, ${skipped} ignoré${skipped > 1 ? 's' : ''} (non géré)` : ''}.`);
      } catch { say('Fichier illisible : rien n\'a été importé.'); }
      e.target.value = '';
    },
  });
  const notifOk = typeof Notification !== 'undefined';
  return h('details', { class: 'block' }, h('summary', null, 'Agendas et réglages'),
    h('ul', { class: 'plain' }, s.calendars.map((c) => h('li', { class: 'row between' },
      h('label', { class: 'check' },
        h('input', { type: 'checkbox', checked: c.visible, onchange: (e) => store.commit(() => { c.visible = e.target.checked; }) }),
        h('i', { class: `dot c--${c.color}` }), c.name),
      h('button', { class: 'btn btn--ghost', onclick: () => editCalendar(ctx, c) }, 'Modifier')))),
    h('div', { class: 'row wrap' },
      h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: s.calPrefs.todos, onchange: (e) => store.commit(() => { s.calPrefs.todos = e.target.checked; }) }), 'Afficher les to-dos'),
      h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: s.calPrefs.exams, onchange: (e) => store.commit(() => { s.calPrefs.exams = e.target.checked; }) }), 'Afficher les examens'),
      h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: s.calPrefs.focus, onchange: (e) => store.commit(() => { s.calPrefs.focus = e.target.checked; }) }), 'Afficher les sessions Focus planifiées'),
      h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: s.calPrefs.study, onchange: (e) => store.commit(() => { s.calPrefs.study = e.target.checked; }) }), 'Afficher le planning de Mémorisation')),
    h('div', { class: 'row wrap' },
      h('button', { class: 'btn', onclick: () => editCalendar(ctx, null) }, '+ Nouvel agenda'),
      h('button', { class: 'btn', onclick: () => file.click() }, 'Importer .ics'), file,
      h('button', {
        class: 'btn', onclick: () => {
          const a = h('a', { href: URL.createObjectURL(new Blob([toICS(s)], { type: 'text/calendar' })), download: 'student-hub.ics' });
          a.click(); URL.revokeObjectURL(a.href);
        },
      }, 'Exporter .ics'),
      notifOk && Notification.permission === 'default' && h('button', { class: 'btn', onclick: () => Notification.requestPermission().then(() => ctx.rerender()) }, 'Activer les notifications')),
    h('p', { class: 'muted' }, 'Les rappels s\'affichent tant que l\'app est ouverte (notification du navigateur si autorisée). La synchronisation Google/Nextcloud/Exchange n\'est pas disponible : importe ou exporte un fichier .ics.'),
    h('p', { class: 'muted', role: 'status', id: 'cal-msg' }, cal.message));
}

function editCalendar(ctx, c) {
  const { store } = ctx; const isNew = !c; const cur = c ?? newCalendar();
  const name = h('input', { type: 'text', value: cur.name, required: true, maxlength: 100 });
  const color = select(CAL_COLORS, cur.color);
  const del = isNew || store.state.calendars.length <= 1 ? null : h('button', {
    type: 'button', class: 'btn btn--danger', onclick: () => {
      if (!confirm(`Supprimer l'agenda « ${cur.name} » et tous ses événements ?`)) return;
      store.commit((s) => removeCalendar(s, cur.id));
      document.querySelector('dialog.sheet')?.close();
    },
  }, 'Supprimer');
  openSheet(isNew ? 'Nouvel agenda' : 'Modifier l\'agenda', h('div', { class: 'stack' }, field('Nom', name), field('Couleur', color)), {
    extra: del,
    onSubmit: () => {
      if (!name.value.trim()) return 'Le nom est obligatoire.';
      store.commit((s) => { if (isNew) s.calendars.push({ ...cur, name: name.value.trim(), color: color.value }); else Object.assign(s.calendars.find((x) => x.id === cur.id) ?? {}, { name: name.value.trim(), color: color.value }); });
      return '';
    },
  });
}

/* ---------- Création / modification d'un événement ---------- */
export function openEventDialog(ctx, init = {}) {
  const { store } = ctx; const s = store.state;
  const existing = init.id ? s.events.find((x) => x.id === init.id) : null;
  const defCal = s.calendars.find((c) => c.id === s.settings.agenda.calendarId)?.id ?? s.calendars[0].id;
  const e = existing ?? newEvent({ calendarId: defCal, date: ymd(new Date()), ...init });
  const titleIn = h('input', { type: 'text', value: e.title, required: true, maxlength: 300, placeholder: 'Titre' });
  const calSel = select(s.calendars.map((c) => [c.id, c.name]), e.calendarId);
  const date = h('input', { type: 'date', value: e.date, required: true });
  const endDate = h('input', { type: 'date', value: e.endDate ?? '' });
  const allDay = h('input', { type: 'checkbox', checked: e.allDay });
  const start = h('input', { type: 'time', value: e.start });
  const end = h('input', { type: 'time', value: e.end });
  const times = h('div', { class: 'row' }, field('Début', start), field('Fin', end));
  const repeat = select(REPEATS, e.repeat);
  const until = h('input', { type: 'date', value: e.until });
  const untilField = field('Répéter jusqu\'au (facultatif)', until);
  const reminder = select(REMINDERS, e.reminder == null ? '' : String(e.reminder));
  const place = h('input', { type: 'text', value: e.location, maxlength: 300 });
  const desc = h('textarea', { rows: 3, maxlength: 5000, value: e.description });
  const sync = () => { times.hidden = allDay.checked; untilField.hidden = repeat.value === 'none'; };
  allDay.addEventListener('change', sync); repeat.addEventListener('change', sync); sync();

  const del = existing ? h('button', {
    type: 'button', class: 'btn btn--danger', onclick: () => {
      if (!confirm(existing.repeat !== 'none' ? 'Supprimer toute la série ?' : 'Supprimer cet événement ?')) return;
      store.commit((st) => removeEvent(st, existing.id));
      document.querySelector('dialog.sheet')?.close();
    },
  }, existing.repeat !== 'none' ? 'Supprimer la série' : 'Supprimer') : null;

  const dlg = openSheet(existing ? 'Modifier l\'événement' : 'Nouvel événement', h('div', { class: 'stack' },
    field('Titre', titleIn), field('Agenda', calSel), field('Date', date), field('Se termine le (événement sur plusieurs jours, facultatif)', endDate),
    h('label', { class: 'check' }, allDay, 'Journée entière'), times,
    field('Lieu', place), field('Description', desc), field('Répétition', repeat), untilField, field('Rappel', reminder),
    existing ? relations(ctx, existing) : h('p', { class: 'muted' }, 'Enregistre l\'événement pour lui lier des tâches et des notes.')), {
    extra: del,
    onSubmit: () => {
      if (!titleIn.value.trim()) return 'Le titre est obligatoire.';
      if (!date.value) return 'La date est obligatoire.';
      const multi = !!endDate.value && endDate.value > date.value;
      if (endDate.value && endDate.value < date.value) return 'La date de fin ne peut pas précéder le début.';
      if (multi && (new Date(`${endDate.value}T00:00:00`) - new Date(`${date.value}T00:00:00`)) / 86400000 > 366) return 'Un événement dure 366 jours au plus.';
      if (!allDay.checked && (!start.value || !end.value || (!multi && end.value <= start.value))) return 'La fin doit être après le début.';
      const next = {
        ...e, title: titleIn.value.trim(), calendarId: calSel.value, date: date.value, allDay: allDay.checked,
        start: start.value || '09:00', end: end.value || '10:00', location: place.value.trim(), description: desc.value.trim(),
        endDate: multi ? endDate.value : '', repeat: repeat.value, until: repeat.value === 'none' ? '' : until.value, reminder: reminder.value === '' ? null : Number(reminder.value),
      };
      store.commit((st) => { if (existing) Object.assign(st.events.find((x) => x.id === existing.id) ?? {}, next); else st.events.push(next); });
      return '';
    },
  });
  dlg.addEventListener('close', () => store.commit(() => {}));
}

// Un événement peut avoir plusieurs tâches et plusieurs notes ; on peut en créer ou en lier d'existantes.
function relations(ctx, ev) {
  const { store } = ctx;
  const host = h('div', { class: 'stack rel' });
  const quiet = (fn) => { store.commit(fn, { silent: true }); draw(); };
  function draw() {
    const s = store.state;
    const todos = s.todos.filter((t) => t.eventId === ev.id);
    const notes = s.notes.filter((n) => n.eventId === ev.id);
    const newTask = h('input', { type: 'text', placeholder: 'Nouvelle tâche pour cet événement', maxlength: 300, 'aria-label': 'Nouvelle tâche' });
    const addTask = () => { if (newTask.value.trim()) quiet((st) => { st.todos.push(newTodo({ name: newTask.value.trim(), eventId: ev.id, deadline: ev.date })); }); };
    newTask.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); addTask(); } });
    const link = (items, label, key) => (items.length ? select([['', label], ...items.map((x) => [x.id, x.name ?? (x.title || 'Sans titre')])], '', {
      'aria-label': label, onchange: (e) => { if (e.target.value) quiet((st) => { st[key].find((x) => x.id === e.target.value).eventId = ev.id; }); },
    }) : null);
    host.replaceChildren(
      h('h3', null, `Tâches liées (${todos.length})`),
      todos.length ? h('ul', { class: 'plain' }, todos.map((t) => h('li', { class: 'row between' },
        h('label', { class: 'check' }, h('input', {
          type: 'checkbox', checked: t.status === 'Terminés',
          onchange: (e) => { changeStatus(store, t, e.target.checked ? 'Terminés' : 'A faire', { silent: true }); },
        }), t.name || 'Sans titre'),
        h('button', { type: 'button', class: 'btn btn--ghost', onclick: () => quiet((st) => { st.todos.find((x) => x.id === t.id).eventId = ''; }) }, 'Délier')))) : h('p', { class: 'muted' }, 'Aucune tâche liée.'),
      h('div', { class: 'row wrap' }, newTask, h('button', { type: 'button', class: 'btn', onclick: addTask }, 'Ajouter')),
      link(s.todos.filter((t) => !t.eventId && t.status !== 'Terminés'), 'Lier une tâche existante…', 'todos'),
      h('h3', null, `Notes liées (${notes.length})`),
      notes.length ? h('ul', { class: 'plain' }, notes.map((n) => h('li', { class: 'row between' }, h('span', null, n.title || 'Sans titre'),
        h('button', { type: 'button', class: 'btn btn--ghost', onclick: () => quiet((st) => { st.notes.find((x) => x.id === n.id).eventId = ''; }) }, 'Délier')))) : h('p', { class: 'muted' }, 'Aucune note liée.'),
      h('button', { type: 'button', class: 'btn', onclick: () => quiet((st) => { st.notes.unshift(newNote({ title: `Note · ${ev.title}`, eventId: ev.id })); }) }, '+ Nouvelle note pour cet événement'),
      link(s.notes.filter((n) => !n.eventId), 'Lier une note existante…', 'notes'));
  }
  draw();
  return host;
}
