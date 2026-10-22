// Recherche globale (barre de la page Home).
export function searchAll(state, query, limit = 20) {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];
  const hit = (...xs) => xs.some((x) => String(x ?? '').toLowerCase().includes(q));
  const out = [];
  for (const c of state.courses) if (hit(c.name, c.code, c.prof)) out.push({ kind: 'Cours', title: c.name, sub: [c.semester, c.prof].filter(Boolean).join(' · '), ref: c, tab: 'workspace' });
  for (const t of state.todos) if (hit(t.name)) out.push({ kind: 'To-do', title: t.name || 'Sans titre', sub: t.deadline, ref: t, tab: 'workspace' });
  for (const e of state.events) if (hit(e.title, e.location, e.description)) out.push({ kind: 'Événement', title: e.title, sub: e.date, ref: e, date: e.date, tab: 'calendar' });
  for (const n of state.notes) if (hit(n.title, n.body)) out.push({ kind: 'Note', title: n.title || 'Sans titre', sub: '', ref: n, tab: 'notes' });
  for (const b of state.library) if (hit(b.title, b.author, b.name, ...b.tags)) out.push({ kind: 'Livre', title: b.title, sub: b.author, ref: b, tab: 'library' });
  for (const l of state.links) if (hit(l.title, l.url, l.description)) out.push({ kind: 'Lien', title: l.title || l.url, sub: l.description, ref: l, tab: 'links' });
  return out.slice(0, limit);
}
