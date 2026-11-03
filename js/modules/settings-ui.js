import { h, field, select } from '../dom.js';
import * as S from '../settings-logic.js';
import { canInstall, promptInstall, isStandalone, offlineReady, onInstallChange } from '../pwa.js';

const clamp = (v, a, b, d) => { const n = v === '' || v == null ? NaN : Math.round(Number(v)); return Number.isFinite(n) ? Math.min(b, Math.max(a, n)) : d; }; // champ vidé ou illisible : on garde l'ancienne valeur

// Sections de réglages « simples » : chaque contrôle écrit dans state.settings et l'app se redessine.
export function prefsSections(ctx) {
  const { store } = ctx; const g = store.state.settings;
  const set = (group, key, value) => store.commit(() => { g[group][key] = value; });
  const num = (group, key, min, max, label, unit) => field(label, h('input', {
    type: 'number', min, max, value: String(g[group][key]), 'aria-label': label,
    onchange: (e) => { set(group, key, clamp(e.target.value, min, max, g[group][key])); }, title: unit,
  }));
  const sel = (group, key, list, label, parse = (x) => x) => field(label, select(list.map(([k, name]) => [String(k), name]), String(g[group][key]), { 'aria-label': label, onchange: (e) => set(group, key, parse(e.target.value)) }));
  const section = (title, ...kids) => h('section', { class: 'block stack', 'data-pref': title }, h('h2', null, title), ...kids);
  const perm = typeof Notification === 'undefined' ? 'indisponible' : Notification.permission === 'granted' ? 'autorisées' : Notification.permission === 'denied' ? 'bloquées' : 'pas encore autorisées';

  return [
    section('Apparence',
      sel('appearance', 'theme', S.THEMES, 'Thème'), sel('appearance', 'size', S.SIZES, 'Taille du texte')),
    section('Langues',
      h('p', null, 'Langue de l\'interface : français (la seule disponible pour l\'instant).'),
      sel('lang', 'cards', S.CARD_LANGS, 'Langue des cartes, fiches et podcasts générés'),
      sel('lang', 'voice', S.VOICE_LANGS, 'Voix de lecture à voix haute'),
      h('p', { class: 'muted' }, 'La voix dépend de celles installées sur ton appareil.')),
    section('Compte et sécurité',
      h('p', { class: 'muted' }, 'Le verrou est un écran de connexion local : il ne chiffre pas tes données.'),
      ctx.lockControls ? ctx.lockControls() : h('p', { class: 'muted' }, 'Le verrou se règle depuis Home.')),
    section('Notifications',
      h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: g.notify.reminders, onchange: (e) => set('notify', 'reminders', e.target.checked) }), 'Rappels d\'événements (quand l\'app est ouverte)'),
      h('p', null, `Notifications du navigateur : ${perm}.`),
      typeof Notification !== 'undefined' && Notification.permission === 'default' && h('button', {
        class: 'btn', onclick: async () => { try { await Notification.requestPermission(); } catch { /* refusé */ } ctx.rerender(); },
      }, 'Autoriser les notifications'),
      h('p', { class: 'muted' }, 'Les rappels ne sonnent que si Student Hub est ouvert : un site sans serveur ne peut pas te réveiller application fermée.')),
    section('Application',
      h('p', null, isStandalone() ? 'Student Hub est installée sur cet appareil.' : 'Student Hub n\'est pas installée : tu l\'utilises dans le navigateur.'),
      h('p', null, offlineReady() ? 'Le mode hors ligne est prêt : l\'app s\'ouvre sans réseau.' : 'Le mode hors ligne s\'active après le premier chargement complet (ou n\'est pas disponible sur ce navigateur).'),
      canInstall() ? h('button', { class: 'btn btn--primary', onclick: async () => { await promptInstall(); ctx.rerender(); } }, 'Installer l\'application')
        : !isStandalone() && h('p', { class: 'muted' }, 'Pour l\'installer : menu du navigateur → « Installer l\'application » ou « Ajouter à l\'écran d\'accueil » (iPhone : Partager → Sur l\'écran d\'accueil).'),
      h('p', { class: 'muted' }, 'Hors ligne, tes données restent consultables et modifiables ; la synchronisation reprend au retour du réseau.')),
    section('Agenda',
      sel('agenda', 'firstDay', S.FIRST_DAYS, 'Premier jour de la semaine', Number),
      num('agenda', 'duration', 15, 480, 'Durée d\'un nouvel événement (minutes)'),
      field('Agenda par défaut', select([['', 'Le premier agenda'], ...store.state.calendars.map((c) => [c.id, c.name])], g.agenda.calendarId, { 'aria-label': 'Agenda par défaut', onchange: (e) => set('agenda', 'calendarId', e.target.value) })),
      h('p', { class: 'muted' }, 'Les heures s\'affichent au format 24 h.')),
    section('Focus',
      num('focus', 'minutes', 1, 180, 'Durée par défaut d\'une session (minutes)'),
      num('focus', 'grace', 5, 60, 'Délai avant que l\'arbre meure si tu quittes l\'app (secondes)')),
    section('Travail',
      h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: g.work.autoCloseParent, onchange: (e) => set('work', 'autoCloseParent', e.target.checked) }), 'Terminer une tâche quand sa dernière sous-tâche est terminée'),
      h('p', { class: 'muted' }, 'Si tu rouvres une sous-tâche, la tâche repasse « En cours ».'),
      h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: g.work.strictDeps, onchange: (e) => set('work', 'strictDeps', e.target.checked) }), 'Dépendances strictes : interdire de démarrer ou terminer une tâche bloquée'),
      h('p', { class: 'muted' }, 'Sinon (par défaut), l\'app te prévient et tu peux continuer en confirmant.'),
      num('work', 'capacityMin', 30, 960, 'Capacité de travail par jour (minutes)'),
      h('p', { class: 'muted' }, 'Sert à repérer les jours trop chargés dans les rapports.')),
    section('Mémorisation',
      sel('memo', 'retention', S.RETENTIONS, 'Rétention visée', Number),
      num('memo', 'newPerDay', 1, 100, 'Nouvelles cartes par session'),
      h('p', { class: 'muted' }, 'Plus la rétention visée est haute, plus les cartes reviennent souvent.')),
  ];
}
