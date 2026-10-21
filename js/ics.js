// Import / export iCalendar (.ics) : titre, lieu, description, heures, journée entière, répétition simple, rappel.
import { newEvent } from './store.js';
import { ymd, addDays } from './calendar-logic.js';

const esc = (s) => String(s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
const unesc = (s) => String(s).replace(/\\n/gi, '\n').replace(/\\([,;\\])/g, '$1');
const fold = (line) => { const out = []; let rest = line; while (rest.length > 74) { out.push(rest.slice(0, 74)); rest = ` ${rest.slice(74)}`; } out.push(rest); return out.join('\r\n'); };
const compactDate = (d) => d.replace(/-/g, '');
const compactTime = (t) => `${t.replace(':', '')}00`;
const FREQ = { daily: 'DAILY', weekly: 'WEEKLY', monthly: 'MONTHLY', yearly: 'YEARLY' };

export function toICS(state) {
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Student Hub//FR', 'CALSCALE:GREGORIAN'];
  for (const e of state.events) {
    lines.push('BEGIN:VEVENT', `UID:${e.id}@studenthub`, `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '')}`, `SUMMARY:${esc(e.title)}`);
    if (e.allDay) lines.push(`DTSTART;VALUE=DATE:${compactDate(e.date)}`, `DTEND;VALUE=DATE:${compactDate(addDays(e.date, 1))}`);
    else lines.push(`DTSTART:${compactDate(e.date)}T${compactTime(e.start)}`, `DTEND:${compactDate(e.date)}T${compactTime(e.end)}`);
    if (e.location) lines.push(`LOCATION:${esc(e.location)}`);
    if (e.description) lines.push(`DESCRIPTION:${esc(e.description)}`);
    if (FREQ[e.repeat]) lines.push(`RRULE:FREQ=${FREQ[e.repeat]}${e.until ? `;UNTIL=${compactDate(e.until)}` : ''}`);
    if (e.reminder != null) lines.push('BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:Rappel', `TRIGGER:-PT${e.reminder}M`, 'END:VALARM');
    lines.push('END:VEVENT');
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
  const events = []; let skipped = 0; let cur = null;
  for (const raw of unfolded.split(/\r?\n/)) {
    const line = raw.trim();
    if (line === 'BEGIN:VEVENT') { cur = { props: {}, alarm: null }; continue; }
    if (line === 'END:VEVENT' && cur) {
      const p = cur.props; cur = null;
      const start = p.DTSTART && parseStamp(p.DTSTART.value, p.DTSTART.params);
      if (!start) { skipped += 1; continue; }
      const end = p.DTEND && parseStamp(p.DTEND.value, p.DTEND.params);
      let endTime = end && !end.allDay && end.date === start.date ? end.time : '';
      if (!start.allDay && !endTime) endTime = end && end.date > start.date ? '23:59' : `${String(Math.min(23, Number(start.time.slice(0, 2)) + 1)).padStart(2, '0')}:${start.time.slice(3)}`;
      const rule = p.RRULE?.value ?? '';
      const freq = Object.entries(FREQ).find(([, v]) => rule.includes(`FREQ=${v}`))?.[0] ?? 'none';
      const until = rule.match(/UNTIL=(\d{4})(\d{2})(\d{2})/);
      if (/INTERVAL=([2-9]|\d{2,})/.test(rule) || (rule && freq === 'none')) skipped += 1;
      events.push(newEvent({
        calendarId, title: unesc(p.SUMMARY?.value ?? 'Sans titre'), location: unesc(p.LOCATION?.value ?? ''), description: unesc(p.DESCRIPTION?.value ?? ''),
        date: start.date, allDay: start.allDay, start: start.allDay ? '09:00' : start.time, end: start.allDay ? '10:00' : endTime,
        repeat: freq, until: until ? `${until[1]}-${until[2]}-${until[3]}` : '', reminder: p.__alarm ?? null,
      }));
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
    cur.props[name] = { value, params };
  }
  return { events, skipped };
}
