import { h, field, select, empty, formatDate } from '../dom.js';
import { newEvent, newCalendar, removeCalendar } from '../store.js';
import { CAL_COLORS, REPEATS, REMINDERS } from '../constants.js';
import {
  MONTHS, DAY_LETTERS, DAY_SHORT, ymd, parseYMD, addDays, weekDays, monthGrid, isoWeek, shiftMonth, itemsOn, layoutDay, longDate, searchEvents,
} from '../calendar-logic.js';
import { openSheet } from '../ui/dialog.js';
import { openTodoDialog } from '../ui/todo-dialog.js';
import { toICS, parseICS } from '../ics.js';
import { showCourse } from './workspace.js';

const HOUR_PX = 48;
const pad = (n) => String(n).padStart(2, '0');
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
  if (item.kind === 'event') openEventDialog(ctx, item.ref);
  else if (item.kind === 'todo') openTodoDialog(ctx.store, item.ref);
  else { showCourse(item.ref.id); location.hash = '#workspace'; }
}

function chip(ctx, item, long = false) {
  const label = item.kind === 'event' ? (item.allDay ? 'Journée' : `${item.start}–${item.end}`) : item.kind === 'todo' ? 'À rendre' : 'Examen';
  return h('button', {
    class: `ev c--${item.color} ${long ? 'ev--row' : ''}`.trim(), onclick: (e) => { e.stopPropagation(); openItem(ctx, item); },
  }, long && h('span', { class: 'ev__t' }, label), h('span', { class: 'ev__n' }, item.title));
}

/* ---------- Mois ---------- */
function monthView(ctx) {
  const s = ctx.store.state; const d = parseYMD(cal.date); const today = ymd(new Date());
  const weeks = monthGrid(d.getFullYear(), d.getMonth());
  return h('div', { class: 'stack' },
    h('div', { class: 'mgrid mgrid--head', 'aria-hidden': 'true' }, DAY_LETTERS.map((l) => h('span', null, l))),
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
  const head = h('div', { class: 'wk__row' }, h('span', { class: 'wk__gutter' }), days.map((d, i) => h('span', { class: `wk__dayname ${d === today ? 'is-today' : ''}`.trim() }, `${DAY_SHORT[i]} `, h('b', null, Number(d.slice(8))))));
  const allday = h('div', { class: 'wk__row wk__allday' }, h('span', { class: 'wk__gutter' }, 'Jour'),
    per.map((items) => h('div', { class: 'wk__cell' }, items.filter((x) => x.allDay).map((x) => chip(ctx, x)))));
  const hours = h('div', { class: 'wk__gutter' }, Array.from({ length: 24 }, (_, hr) => h('span', { class: 'wk__h' }, `${pad(hr)}:00`)));
  const cols = days.map((d, i) => {
    const col = h('div', {
      class: `wk__col ${d === today ? 'is-today' : ''}`.trim(), role: 'group', 'aria-label': longDate(d),
      onclick: (e) => {
        if (e.target !== col) return;
        const hr = Math.min(23, Math.floor((e.clientY - col.getBoundingClientRect().top) / HOUR_PX));
        openEventDialog(ctx, { date: d, start: `${pad(hr)}:00`, end: hr < 23 ? `${pad(hr + 1)}:00` : '23:59' });
      },
    });
    for (const o of layoutDay(per[i].filter((x) => !x.allDay))) {
      const b = h('button', { class: `wk__ev c--${o.item.color}`, onclick: (e) => { e.stopPropagation(); openItem(ctx, o.item); } },
        h('b', null, o.item.title), h('span', null, `${o.item.start}–${o.item.end}`));
      b.style.top = `${(o.s * HOUR_PX) / 60}px`;
      b.style.height = `${Math.max(20, ((o.e - o.s) * HOUR_PX) / 60 - 2)}px`;
      b.style.left = `${(o.col / o.cols) * 100}%`;
      b.style.width = `calc(${100 / o.cols}% - 2px)`;
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

/* ---------- Année ---------- */
function yearView(ctx) {
  const s = ctx.store.state; const y = parseYMD(cal.date).getFullYear(); const today = ymd(new Date());
  const pick = (date) => { cal.date = date; cal.view = 'month'; ctx.rerender(); };
  return h('div', { class: 'yr' }, MONTHS.map((name, m) => h('section', { class: 'yr__m' },
    h('button', { class: 'linkish', onclick: () => pick(ymd(new Date(y, m, 1))) }, name),
    h('div', { class: 'yr__grid', 'aria-hidden': 'true' },
      DAY_LETTERS.map((l) => h('span', { class: 'muted' }, l)),
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
      h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: s.calPrefs.exams, onchange: (e) => store.commit(() => { s.calPrefs.exams = e.target.checked; }) }), 'Afficher les examens')),
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
  const e = existing ?? newEvent({ calendarId: s.calendars[0].id, date: ymd(new Date()), ...init });
  const titleIn = h('input', { type: 'text', value: e.title, required: true, maxlength: 300, placeholder: 'Titre' });
  const calSel = select(s.calendars.map((c) => [c.id, c.name]), e.calendarId);
  const date = h('input', { type: 'date', value: e.date, required: true });
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
      store.commit((st) => { st.events = st.events.filter((x) => x.id !== existing.id); });
      document.querySelector('dialog.sheet')?.close();
    },
  }, existing.repeat !== 'none' ? 'Supprimer la série' : 'Supprimer') : null;

  openSheet(existing ? 'Modifier l\'événement' : 'Nouvel événement', h('div', { class: 'stack' },
    field('Titre', titleIn), field('Agenda', calSel), field('Date', date),
    h('label', { class: 'check' }, allDay, 'Journée entière'), times,
    field('Lieu', place), field('Description', desc), field('Répétition', repeat), untilField, field('Rappel', reminder)), {
    extra: del,
    onSubmit: () => {
      if (!titleIn.value.trim()) return 'Le titre est obligatoire.';
      if (!date.value) return 'La date est obligatoire.';
      if (!allDay.checked && (!start.value || !end.value || end.value <= start.value)) return 'La fin doit être après le début.';
      const next = {
        ...e, title: titleIn.value.trim(), calendarId: calSel.value, date: date.value, allDay: allDay.checked,
        start: start.value || '09:00', end: end.value || '10:00', location: place.value.trim(), description: desc.value.trim(),
        repeat: repeat.value, until: repeat.value === 'none' ? '' : until.value, reminder: reminder.value === '' ? null : Number(reminder.value),
      };
      store.commit((st) => { if (existing) Object.assign(st.events.find((x) => x.id === existing.id) ?? {}, next); else st.events.push(next); });
      return '';
    },
  });
}
