import { h, field } from '../dom.js';
import { loadSync, saveSync, createClient, cleanUrl, syncNow, replaceCloud, replaceDevice } from '../sync.js';
import { customizeSheet } from '../ui/widgets.js';

const ui = { msg: '', busy: false };
const fallback = (() => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) }; })();

export function resetView() { Object.assign(ui, { msg: '', busy: false }); }

export function render(ctx) {
  const storage = ctx.storage ?? (typeof localStorage !== 'undefined' ? localStorage : fallback);
  const cfg = loadSync(storage);
  const persist = (patch) => saveSync(storage, { ...loadSync(storage), ...patch });
  const say = (msg) => { ui.msg = msg; ui.busy = false; ctx.rerender(); };

  const url = h('input', { type: 'url', value: cfg.url, placeholder: 'https://abcd.supabase.co', autocomplete: 'off', 'aria-label': 'Adresse du projet', onchange: (e) => persist({ url: e.target.value.trim() }) });
  const key = h('input', { type: 'text', value: cfg.anonKey, placeholder: 'Clé « anon public »', autocomplete: 'off', spellcheck: 'false', 'aria-label': 'Clé anon public', onchange: (e) => persist({ anonKey: e.target.value.trim() }) });
  const email = h('input', { type: 'email', autocomplete: 'username', 'aria-label': 'E-mail' });
  const pass = h('input', { type: 'password', autocomplete: 'current-password', 'aria-label': 'Mot de passe' });

  // Chaque action : un client frais lu depuis le stockage, une seule opération à la fois, un message clair à la fin.
  const client = () => createClient({
    url: url.value, anonKey: key.value, getSession: () => loadSync(storage).session,
    setSession: (session) => persist({ session }),
  });
  const run = (label, fn) => async () => {
    if (ui.busy) return;
    ui.busy = true; ui.msg = `${label}…`; ctx.rerender();
    try { say(await fn()); } catch (e) { say(e.message); }
  };
  const credentials = () => {
    if (!email.value.trim() || pass.value.length < 6) throw new Error('Saisis ton e-mail et un mot de passe (6 caractères au minimum).');
    persist({ url: cleanUrl(url.value), anonKey: key.value.trim() });
    return [email.value.trim(), pass.value];
  };
  const touch = () => persist({ last: new Date().toISOString() });
  const off = ui.busy ? true : null;

  const signedOut = h('div', { class: 'stack' },
    field('Adresse du projet', url), field('Clé « anon public »', key), field('E-mail', email), field('Mot de passe', pass),
    h('div', { class: 'row wrap' },
      h('button', { class: 'btn btn--primary', disabled: off, onclick: run('Connexion', async () => { await client().signIn(...credentials()); return 'Connecté.'; }) }, 'Se connecter'),
      h('button', { class: 'btn', disabled: off, onclick: run('Création du compte', async () => { const r = await client().signUp(...credentials()); return r.needsConfirm ? 'Compte créé : confirme ton e-mail (lien reçu), puis connecte-toi.' : 'Compte créé et connecté.'; }) }, 'Créer un compte')));

  const signedIn = h('div', { class: 'stack' },
    h('p', null, `Connecté : ${cfg.session?.user?.email ?? ''}`),
    h('p', { class: 'muted' }, cfg.last ? `Dernière synchronisation : ${new Date(cfg.last).toLocaleString('fr-FR')}` : 'Pas encore synchronisé.'),
    h('div', { class: 'row wrap' },
      h('button', { class: 'btn btn--primary', disabled: off, onclick: run('Synchronisation', async () => { const r = await syncNow(client(), ctx.store); touch(); return r.hadCloud ? 'Synchronisé : données du cloud fusionnées, puis envoyées.' : 'Synchronisé : premier envoi vers le cloud.'; }) }, 'Synchroniser maintenant'),
      h('button', { class: 'btn', disabled: off, onclick: run('Envoi', async () => { if (!confirm('Le cloud deviendra une copie exacte de cet appareil. Continuer ?')) return 'Annulé.'; await replaceCloud(client(), ctx.store); touch(); return 'Le cloud est maintenant une copie de cet appareil.'; }) }, 'Remplacer le cloud'),
      h('button', { class: 'btn', disabled: off, onclick: run('Récupération', async () => { if (!confirm('Cet appareil deviendra une copie exacte du cloud : tes données locales seront écrasées. Continuer ?')) return 'Annulé.'; await replaceDevice(client(), ctx.store); touch(); return 'Cet appareil est maintenant une copie du cloud.'; }) }, 'Remplacer cet appareil'),
      h('button', { class: 'btn btn--danger', disabled: off, onclick: run('Déconnexion', async () => { await client().signOut(); return 'Déconnecté.'; }) }, 'Se déconnecter')));

  return h('div', { class: 'page' },
    h('h1', { class: 'page-title' }, 'Paramètres'),
    h('section', { class: 'block stack' }, h('h2', null, 'Compte et synchronisation'),
      h('p', { class: 'muted' }, 'Facultatif. Retrouve tes données sur tous tes appareils avec un compte Supabase que tu configures toi-même. Les PDF ne sont jamais envoyés. La fusion ne supprime rien : un élément supprimé sur un appareil peut revenir depuis l\'autre (voir le guide, onglet Objectifs).'),
      cfg.session ? signedIn : signedOut,
      h('p', { role: 'status', class: 'muted' }, ui.msg)),
    h('section', { class: 'block stack' }, h('h2', null, 'Widgets'),
      h('p', { class: 'muted' }, 'Choisis les blocs de Home et ceux qui s\'affichent en bas de chaque onglet.'),
      h('div', { class: 'row' }, h('button', { class: 'btn', onclick: () => customizeSheet(ctx, 'home') }, 'Personnaliser les widgets'))),
    h('section', { class: 'block stack' }, h('h2', null, 'À propos de Student Hub'),
      h('p', null, 'Application web sans serveur : tes données restent dans ce navigateur, sauf si tu actives la synchronisation. Le guide d\'utilisation complet est dans l\'onglet Objectifs, section Conseils.'),
      h('div', { class: 'row' }, h('button', { class: 'btn', onclick: () => { location.hash = '#goals'; } }, 'Ouvrir le guide'))));
}
