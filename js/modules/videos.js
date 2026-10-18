import { h, empty } from '../dom.js';

const ID = /^[\w-]{11}$/;
const fmt = (iso) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
};

export function render(ctx) {
  const videos = (ctx.data.videos?.videos ?? []).filter((v) => ID.test(String(v.id)));
  const groups = new Map();
  for (const v of videos) {
    const key = String(v.channel || 'Autres');
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(v);
  }
  return h('div', { class: 'page' },
    h('h1', { class: 'page-title' }, 'Vidéos'),
    videos.length
      ? [...groups].map(([channel, items]) => h('section', { class: 'block' }, h('h2', null, channel),
        h('ul', { class: 'vgrid' }, items.map((v) => h('li', { class: 'vcard' },
          h('a', { href: `https://www.youtube.com/watch?v=${v.id}`, target: '_blank', rel: 'noopener noreferrer' },
            h('img', { src: `https://i.ytimg.com/vi/${v.id}/mqdefault.jpg`, alt: '', loading: 'lazy', width: 320, height: 180 }),
            h('span', { class: 'vcard__title' }, String(v.title ?? 'Sans titre'))),
          h('span', { class: 'muted' }, fmt(v.published)))))))
      : empty('Aucune vidéo pour l\'instant.', 'Ajoute tes chaînes dans data/channels.json : une Action GitHub récupère les dernières vidéos chaque jour.'));
}
