import { h, field, select, empty, formatDate } from '../dom.js';
import { ymd } from '../calendar-logic.js';
import * as T from '../tutor-logic.js';
import { LEVELS } from '../revision-logic.js';

const ui = { mode: 'standard', topic: '', text: '', msg: '' };
export function resetTutor() { Object.assign(ui, { mode: 'standard', topic: '', text: '', msg: '' }); }
const lines = (el) => el.value.split('\n').map((x) => x.trim()).filter(Boolean);

async function copy(text, note, ok) {
  try { await navigator.clipboard.writeText(text); note.textContent = ok; } catch { note.textContent = 'Copie impossible ici : utilise un navigateur qui autorise le presse-papiers.'; }
}

export function tutorTab(ctx, deck, mine) {
  const { store } = ctx; const s = store.state;
  const ready = T.buildContext({ deck, cards: mine, gaps: s.gaps, logs: s.tutorLogs, mode: ui.mode, topic: ui.topic });
  const note = h('p', { class: 'muted', role: 'status' });
  const paste = h('textarea', { rows: 5, maxlength: 60000, value: ui.text, placeholder: 'Colle ici la dernière réponse du tuteur (celle de la clôture, avec le bloc session_log)', 'aria-label': 'Réponse du tuteur', oninput: (e) => { ui.text = e.target.value; } });
  const logs = s.tutorLogs.filter((l) => l.deckId === deck.id).sort((a, b) => b.date.localeCompare(a.date));
  const mastered = h('textarea', { rows: 3, maxlength: 6000, value: deck.mastered.join('\n'), 'aria-label': 'Notions maîtrisées', placeholder: 'Une notion par ligne', onchange: (e) => store.commit(() => { deck.mastered = [...new Set(lines(e.target))].slice(0, 80); }) });
  const weak = h('textarea', { rows: 3, maxlength: 6000, value: deck.weak.join('\n'), 'aria-label': 'Notions faibles', placeholder: 'Une notion par ligne', onchange: (e) => store.commit(() => { deck.weak = [...new Set(lines(e.target))].slice(0, 80); }) });
  return h('div', { class: 'stack' },
    h('section', { class: 'block stack' }, h('h2', null, 'Préparer une session'),
      h('p', { class: 'muted' }, 'Aucune clé dans l\'app : tu ouvres une conversation dans ton IA (Claude, ChatGPT…), tu y colles le prompt du tuteur puis le contexte de la leçon, tu travailles avec lui, et à la fin tu rapportes son bilan ici.'),
      h('ol', { class: 'steps' }, h('li', null, 'Copie le prompt du tuteur et colle-le en premier message (une seule fois par conversation).'), h('li', null, 'Copie le contexte de la session et colle-le en second message.'), h('li', null, 'Travaille avec le tuteur jusqu\'à sa clôture.'), h('li', null, 'Colle sa dernière réponse plus bas : l\'app enregistre le bilan.')),
      h('div', { class: 'row wrap' }, field('Durée de la session', select(T.MODES.map(([k, , name]) => [k, name]), ui.mode, { onchange: (e) => { ui.mode = e.target.value; ctx.rerender(); } }), 'field--inline'),
        field('Ton premier message (facultatif)', h('input', { type: 'text', maxlength: 300, value: ui.topic, placeholder: 'ex. Je bloque sur les moments de force', onchange: (e) => { ui.topic = e.target.value; ctx.rerender(); } }), 'field--inline')),
      !deck.source.trim() && h('p', { class: 'error' }, 'Colle d\'abord le texte de ton cours dans l\'onglet Apprendre : sans <sources>, le tuteur ne peut pas citer ton polycopié.'),
      ready.truncated && h('p', { class: 'error' }, `Ta source fait ${ready.sourceChars} caractères : seuls les ${T.MAX_SOURCE} premiers sont envoyés au tuteur.`),
      h('div', { class: 'row wrap' },
        h('button', { class: 'btn', onclick: () => copy(T.systemPrompt(), note, 'Prompt du tuteur copié : colle-le en premier message.') }, '1. Copier le prompt du tuteur'),
        h('button', { class: 'btn btn--primary', onclick: () => copy(ready.text, note, 'Contexte copié : colle-le en second message.') }, '2. Copier le contexte')), note),
    h('section', { class: 'block stack' }, h('h2', null, 'Après la session'),
      paste,
      h('button', {
        class: 'btn btn--primary', onclick: () => {
          try {
            const log = T.parseSessionLog(ui.text); let res;
            // le message est posé AVANT le commit : c'est le commit qui redessine la page
            ui.text = ''; ui.msg = 'Session enregistrée.';
            store.commit((st) => { res = T.applySessionLog(st, deck.id, log, ymd(new Date())); });
            ui.msg = res.duplicate ? 'Ce bilan est déjà enregistré : rien n\'a été ajouté et aucun XP n\'est donné.' : `Session enregistrée : ${log.mastered.length} maîtrisée(s), ${log.weak.length} à retravailler${res.added ? `, ${res.added} ajoutée(s) au journal des blocages` : ''}, +${res.xp} XP.`;
          } catch (e) { ui.msg = e.message; }
          ctx.rerender();
        },
      }, 'Enregistrer la session'), h('p', { class: 'muted', role: 'status', 'data-tutor-msg': 'true' }, ui.msg)),
    h('section', { class: 'block stack' }, h('h2', null, 'Mon profil dans cette leçon'),
      field('Niveau estimé', select(LEVELS, deck.level, { onchange: (e) => store.commit(() => { deck.level = e.target.value; }) })),
      field('Notions maîtrisées', mastered), field('Notions faibles', weak),
      h('p', { class: 'muted' }, 'Le tuteur met ce profil à jour à chaque session ; tu peux aussi le corriger à la main.')),
    h('section', { class: 'block stack' }, h('h2', null, 'Historique des sessions'),
      logs.length ? h('ul', { class: 'plain' }, logs.slice(0, 10).map((l) => h('li', { class: 'stack' },
        h('strong', null, `${formatDate(l.date.slice(0, 10))} · ${l.topic || 'Session'}`),
        h('span', { class: 'muted' }, `${l.mastered.length} maîtrisée(s) · ${l.weak.length} à retravailler${l.level ? ` · niveau ${l.level}` : ''}`),
        l.next && h('span', { class: 'muted' }, `Prochaine étape : ${l.next}`), l.gap && h('span', { class: 'muted' }, `Écart de confiance : ${l.gap}`))))
        : empty('Aucune session enregistrée.', 'Après ta première session, son bilan apparaît ici et alimente les rappels de la suivante.')));
}
