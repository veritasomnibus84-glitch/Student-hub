// Import / export iCalendar (.ics) : titre, lieu, description, heures, journée entière, répétition simple, rappel.
import { newEvent } from './store.js';
import { ymd, addDays, daysBetween } from './calendar-logic.js';

const esc = (s) => String(s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
const unesc = (s) => String(s).replace(/\\n/gi, '\n').replace(/\\([,;\\])/g, '$1');
const fold = (line) => { const out = []; let rest = line; while (rest.length > 74) { out.push(rest.slice(0, 74)); rest = ` ${rest.slice(74)}`; } out.push(rest); return out.join('\r\n'); };
const compactDate = (d) => d.replace(/-/g, '');
const compactTime = (t) => `${t.replace(':', '')}00`;
const FREQ = { daily: 'DAILY', weekly: 'WEEKLY', monthly: 'MONTHLY', yearly: 'YEARLY' };

const span = (e) => (e.endDate && e.endDate > e.date ? daysBetween(e.date, e.endDate) : 0);
const stampOf = (e, date) => (e.allDay ? [`;VALUE=DATE:${compactDate(date)}`] : [`:${compactDate(date)}T${compactTime(e.start)}`])[0];

// Un VEVENT : l'événement lui-même, ou (avec `recurrenceId`) une occurrence modifiée d'une série.
function vevent(lines, e, f, recurrenceId = '') {
  const L = span(e);
  lines.push('BEGIN:VEVENT', `UID:${e.id}@studenthub`, `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '')}`);
  if (recurrenceId) lines.push(`RECURRENCE-ID${recurrenceId}`);
  lines.push(`SUMMARY:${esc(f.title)}`);
  if (f.allDay) lines.push(`DTSTART;VALUE=DATE:${compactDate(f.date)}`, `DTEND;VALUE=DATE:${compactDate(addDays(f.date, L + 1))}`);
  else lines.push(`DTSTART:${compactDate(f.date)}T${compactTime(f.start)}`, `DTEND:${compactDate(addDays(f.date, L))}T${compactTime(f.end)}`);
  if (f.location) lines.push(`LOCATION:${esc(f.location)}`);
  if (f.description) lines.push(`DESCRIPTION:${esc(f.description)}`);
  if (!recurrenceId) {
    if (FREQ[e.repeat]) lines.push(`RRULE:FREQ=${FREQ[e.repeat]}${e.until ? `;UNTIL=${compactDate(e.until)}` : ''}`);
    for (const [origin, ex] of Object.entries(e.exceptions ?? {})) if (ex.deleted) lines.push(`EXDATE${stampOf(e, origin)}`);
  }
  if (e.reminder != null) lines.push('BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:Rappel', `TRIGGER:-PT${e.reminder}M`, 'END:VALARM');
  lines.push('END:VEVENT');
}

export function toICS(state) {
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Student Hub//FR', 'CALSCALE:GREGORIAN'];
  for (const e of state.events) {
    vevent(lines, e, e);
    // Occurrences modifiées ou déplacées : un VEVENT à part, rattaché à la série par RECURRENCE-ID.
    for (const [origin, ex] of Object.entries(e.exceptions ?? {})) if (!ex.deleted && FREQ[e.repeat]) vevent(lines, e, { ...e, ...ex, date: ex.date ?? origin }, stampOf(e, origin));
  }
  lines.push('END:VCALENDAR');
  return `${lines.map(fold).join('\r\n')}\r\n`;
}

function parseStamp(value, params) {
  const v = value.trim();
  const m = v.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?$/);
  if (!m) return null;
  const allDay = params.includes('VALUE=DATE') || m[4] === undefined;
  if (allDay) return { allDay: true, date: `${m[1]}-${m[2]}-${m[3]}`, time: '' };
  let d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5]));
  if (m[7]) d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5])));
  return { allDay: false, date: ymd(d), time: `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}` };
}

const triggerMinutes = (t) => {
  const m = String(t).match(/^-P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?)?$/);
  if (!m) return null;
  const mins = Number(m[1] ?? 0) * 1440 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0);
  return [0, 5, 15, 30, 60, 1440].includes(mins) ? mins : null;
};

export function parseICS(text, calendarId) {
  const unfolded = String(text).replace(/\r?\n[ \t]/g, '');
  const events = []; const overrides = []; const masters = new Map(); let skipped = 0; let cur = null;
  for (const raw of unfolded.split(/\r?\n/)) {
    const line = raw.trim();
    if (line === 'BEGIN:VEVENT') { cur = { props: {}, alarm: null, exdates: [] }; continue; }
    if (line === 'END:VEVENT' && cur) {
      const p = cur.props; const exdates = cur.exdates; cur = null;
      const start = p.DTSTART && parseStamp(p.DTSTART.value, p.DTSTART.params);
      if (!start) { skipped += 1; continue; }
      const end = p.DTEND && parseStamp(p.DTEND.value, p.DTEND.params);
      let endDate = ''; let endTime = end && !end.allDay && end.date === start.date ? end.time : '';
      if (end && end.date > start.date) { // événement sur plusieurs jours : DTEND de fin de journée (exclusif) ou à une heure précise
        const midnight = end.allDay || end.time === '00:00';
        const last = midnight ? addDays(end.date, -1) : end.date;
        if (last > start.date) endDate = last;
        if (!start.allDay) endTime = midnight ? '23:59' : end.time;
      }
      if (!start.allDay && !endTime) endTime = `${String(Math.min(23, Number(start.time.slice(0, 2)) + 1)).padStart(2, '0')}:${start.time.slice(3)}`;
      const rule = p.RRULE?.value ?? '';
      const freq = Object.entries(FREQ).find(([, v]) => rule.includes(`FREQ=${v}`))?.[0] ?? 'none';
      const until = rule.match(/UNTIL=(\d{4})(\d{2})(\d{2})/);
      if (/INTERVAL=([2-9]|\d{2,})/.test(rule) || (rule && freq === 'none')) skipped += 1;
      const ev = newEvent({
        calendarId, title: unesc(p.SUMMARY?.value ?? 'Sans titre'), location: unesc(p.LOCATION?.value ?? ''), description: unesc(p.DESCRIPTION?.value ?? ''),
        date: start.date, allDay: start.allDay, start: start.allDay ? '09:00' : start.time, end: start.allDay ? '10:00' : endTime, endDate,
        repeat: freq, until: until ? `${until[1]}-${until[2]}-${until[3]}` : '', reminder: p.__alarm ?? null,
      });
      const uid = p.UID?.value ?? '';
      const recurrence = p['RECURRENCE-ID'] && parseStamp(p['RECURRENCE-ID'].value, p['RECURRENCE-ID'].params);
      if (recurrence) { overrides.push({ uid, origin: recurrence.date, ev }); continue; } // rattaché à sa série après lecture complète
      for (const d of exdates) { const x = parseStamp(d.value, d.params); if (x && ev.repeat !== 'none') ev.exceptions[x.date] = { deleted: true }; }
      if (uid) masters.set(uid, ev);
      events.push(ev);
      continue;
    }
    if (!cur) continue;
    if (line === 'BEGIN:VALARM') { cur.alarm = true; continue; }
    if (line === 'END:VALARM') { cur.alarm = null; continue; }
    const i = line.indexOf(':');
    if (i < 0) continue;
    const [name, ...params] = line.slice(0, i).toUpperCase().split(';');
    const value = line.slice(i + 1);
    if (cur.alarm) { if (name === 'TRIGGER') cur.props.__alarm = triggerMinutes(value); continue; }
    if (name === 'EXDATE') { for (const v of value.split(',')) cur.exdates.push({ value: v, params }); continue; }
    cur.props[name] = { value, params };
  }
  for (const { uid, origin, ev } of overrides) { // occurrences modifiées : attachées à leur série, sinon importées telles quelles
    const master = uid ? masters.get(uid) : null;
    if (master && master.repeat !== 'none') master.exceptions[origin] = { date: ev.date, title: ev.title, location: ev.location, description: ev.description, ...(master.allDay ? {} : { start: ev.start, end: ev.end }) };
    else events.push(ev);
  }
  return { events, skipped };
}
