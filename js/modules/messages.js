import { h, empty } from '../dom.js';

const SOURCES = [['all', 'Tout'], ['gmail', 'Gmail'], ['whatsapp', 'WhatsApp']];
const view = { source: 'all', unreadOnly: false };

const fmt = (iso) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
};

export function render(ctx) {
  const { store, data } = ctx;
  const all = Array.isArray(data.summaries) ? data.summaries : [];
  const read = new Set(store.state.read);
  const shown = all
    .filter((m) => view.source === 'all' || m.source === view.source)
    .filter((m) => !view.unreadOnly || !read.has(String(m.id)))
    .sort((a, b) => String(b.date).localeCompare(String(a.date)));

  return h('div', { class: 'page' },
    h('h1', { class: 'page-title' }, 'Messages'),
    h('div', { class: 'toolbar' },
      h('div', { class: 'seg', role: 'group', 'aria-label': 'Source' }, SOURCES.map(([k, label]) => h('button', {
        class: `seg__btn ${view.source === k ? 'is-on' : ''}`.trim(), 'aria-pressed': String(view.source === k),
        onclick: () => { view.source = k; ctx.rerender(); },
      }, label))),
      h('label', { class: 'check' }, h('input', {
        type: 'checkbox', checked: view.unreadOnly, onchange: (e) => { view.unreadOnly = e.target.checked; ctx.rerender(); },
      }), 'Non lus')),
    shown.length
      ? h('ul', { class: 'msgs' }, shown.map((m) => {
        const id = String(m.id);
        const isRead = read.has(id);
        return h('li', { class: `msg ${isRead ? 'is-read' : ''}`.trim() },
          h('div', { class: 'row between' },
            h('span', { class: `chip chip--${m.source === 'gmail' ? 'gmail' : 'wa'}` }, m.source === 'gmail' ? 'Gmail' : 'WhatsApp'),
            h('span', { class: 'muted' }, fmt(m.date))),
          h('p', { class: 'msg__from' }, [m.from, m.subject].filter(Boolean).join(' — ')),
          h('p', null, String(m.summary ?? '')),
          h('div', { class: 'row end' }, h('button', {
            class: 'btn btn--ghost',
            onclick: () => store.commit((s) => { s.read = isRead ? s.read.filter((x) => x !== id) : [...s.read, id]; }),
          }, isRead ? 'Marquer non lu' : 'Marquer lu')));
      }))
      : empty('Aucun résumé.', 'Hermes dépose ses résumés dans data/summaries.json (voir README).'));
}
