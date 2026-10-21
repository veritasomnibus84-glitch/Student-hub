import { h, field, empty, safeUrl } from '../dom.js';
import { newLink } from '../store.js';
import { openSheet } from '../ui/dialog.js';

export function render(ctx) {
  const { store } = ctx;
  const links = store.state.links;
  const groups = new Map();
  for (const l of links) {
    const key = l.category.trim() || 'Divers';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(l);
  }
  return h('div', { class: 'page' },
    h('h1', { class: 'page-title' }, 'Liens utiles'),
    h('div', { class: 'toolbar' }, h('button', { class: 'btn btn--primary', onclick: () => edit(store, null) }, '+ Lien')),
    links.length
      ? [...groups].map(([cat, items]) => h('section', { class: 'block' }, h('h2', null, cat),
        h('ul', { class: 'linkcards' }, items.map((l) => linkCard(store, l)))))
      : empty('Aucun lien pour l\'instant.', 'Ajoute le portail de l\'école, tes ressources de cours, tes outils.'));
}

function linkCard(store, l) {
  const href = safeUrl(l.url);
  return h('li', { class: 'linkcard' },
    href ? h('a', { class: 'linkcard__title', href, target: '_blank', rel: 'noopener noreferrer' }, l.title || l.url)
      : h('span', { class: 'linkcard__title' }, l.title || '(lien invalide)'),
    l.description && h('p', { class: 'muted' }, l.description),
    h('div', { class: 'row end' }, h('button', { class: 'btn btn--ghost', onclick: () => edit(store, l) }, 'Modifier')));
}

function edit(store, link) {
  const isNew = !link;
  const l = link ?? newLink();
  const title = h('input', { type: 'text', value: l.title, required: true, maxlength: 300 });
  const url = h('input', { type: 'url', value: l.url, required: true, placeholder: 'https://…' });
  const desc = h('textarea', { rows: 3, maxlength: 1000, value: l.description });
  const cat = h('input', { type: 'text', value: l.category, maxlength: 100, placeholder: 'Ex. École, Outils…' });
  const del = isNew ? null : h('button', {
    type: 'button', class: 'btn btn--danger', onclick: () => {
      if (!confirm('Supprimer ce lien ?')) return;
      store.commit((s) => { s.links = s.links.filter((x) => x.id !== l.id); });
      document.querySelector('dialog.sheet')?.close();
    },
  }, 'Supprimer');
  openSheet(isNew ? 'Nouveau lien' : 'Modifier le lien',
    h('div', { class: 'stack' }, field('Titre', title), field('Adresse', url), field('Description', desc), field('Catégorie', cat)), {
      extra: del,
      onSubmit: () => {
        const href = safeUrl(url.value);
        if (!title.value.trim()) return 'Le titre est obligatoire.';
        if (!href) return 'L\'adresse doit commencer par http:// ou https://';
        store.commit((s) => {
          const next = { ...l, title: title.value.trim(), url: href, description: desc.value.trim(), category: cat.value.trim() };
          if (isNew) s.links.push(next); else Object.assign(s.links.find((x) => x.id === l.id) ?? {}, next);
        });
        return '';
      },
    });
}
