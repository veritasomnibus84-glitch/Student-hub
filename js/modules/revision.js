import { h, field, select, empty, formatDate } from '../dom.js';
import { openSheet } from '../ui/dialog.js';
import { review, label } from '../fsrs.js';
import { newDeck, newCard, parseCards, stats, queue, buildPrompt } from '../revision-logic.js';

// Vue courante : liste des leçons, une leçon, ou une session de révision.
const view = { deckId: '', session: null };
let keysBound = false;

export function render(ctx) {
  bindKeys(ctx);
  const { store } = ctx;
  if (view.session) return reviewView(ctx);
  const deck = store.state.decks.find((d) => d.id === view.deckId);
  return deck ? deckView(ctx, deck) : listView(ctx);
}

const plural = (n, w) => `${n} ${w}${n > 1 ? 's' : ''}`;
const startSession = (ctx, cards) => {
  const ids = queue(cards).map((c) => c.id);
  view.session = { ids, total: ids.length, done: 0, shown: false, picked: null };
  ctx.rerender();
};

function listView(ctx) {
  const { store } = ctx;
  const { decks, cards, courses } = store.state;
  const allDue = stats(cards).due;
  return h('div', { class: 'page' },
    h('h1', { class: 'page-title' }, 'Révision'),
    h('p', { class: 'muted' }, `${plural(allDue, 'carte')} à réviser aujourd'hui · répétition espacée (FSRS-6)`),
    h('div', { class: 'toolbar' },
      h('button', { class: 'btn btn--primary', onclick: () => deckSheet(ctx, courses) }, '+ Leçon'),
      allDue > 0 && h('button', { class: 'btn', onclick: () => startSession(ctx, cards) }, '▶ Tout réviser')),
    decks.length
      ? h('ul', { class: 'cards' }, decks.map((d) => {
        const st = stats(cards.filter((c) => c.deckId === d.id));
        return h('li', { class: 'card' },
          h('button', { class: 'card__main', onclick: () => { view.deckId = d.id; ctx.rerender(); } },
            h('span', { class: 'card__name' }, d.name),
            h('span', { class: 'muted' }, `${plural(st.total, 'carte')} · ${st.due} à réviser${d.exam ? ` · examen ${formatDate(d.exam)}` : ''}`)),
          h('div', { class: 'card__actions' }, st.due > 0 && h('button', {
            class: 'btn btn--ghost', 'aria-label': `Réviser ${d.name}`,
            onclick: () => startSession(ctx, cards.filter((c) => c.deckId === d.id)),
          }, '▶')));
      }))
      : empty('Aucune leçon.', 'Crée une leçon, puis ajoute des cartes à la main ou avec une IA (prompt à copier, JSON à coller).'));
}

function deckSheet(ctx, courses) {
  const name = h('input', { type: 'text', maxlength: 200, required: true, placeholder: 'ex. Cinématique' });
  const course = select([['', '— Aucun cours —'], ...courses.map((c) => [c.id, c.name])], '');
  const exam = h('input', { type: 'date' });
  openSheet('Nouvelle leçon', h('div', { class: 'sheet__body' }, field('Nom', name), field('Cours', course), field('Date d\'examen (facultatif)', exam)), {
    onSubmit: () => {
      if (!name.value.trim()) return 'Donne un nom à la leçon.';
      const d = newDeck({ name: name.value.trim(), courseId: course.value, exam: exam.value });
      ctx.store.commit((s) => s.decks.push(d)); view.deckId = d.id;
    },
  });
}

function deckView(ctx, deck) {
  const { store } = ctx;
  const mine = store.state.cards.filter((c) => c.deckId === deck.id);
  const st = stats(mine);
  return h('div', { class: 'page' },
    h('div', { class: 'row between' },
      h('button', { class: 'btn btn--ghost', onclick: () => { view.deckId = ''; ctx.rerender(); } }, '← Leçons'),
      h('button', {
        class: 'btn btn--danger', onclick: () => {
          if (confirm(`Supprimer « ${deck.name} » et ses ${mine.length} cartes ?`)) {
            store.commit((s) => { s.decks = s.decks.filter((d) => d.id !== deck.id); s.cards = s.cards.filter((c) => c.deckId !== deck.id); }); view.deckId = '';
          }
        },
      }, 'Supprimer la leçon')),
    h('h1', { class: 'page-title' }, deck.name),
    h('p', { class: 'muted' }, `${st.due} à réviser · maîtrisées ${st.mastered} · en cours ${st.learning} · à étudier ${st.fresh}`),
    h('progress', { max: Math.max(1, st.total), value: st.mastered, 'aria-label': 'Cartes maîtrisées' }),
    h('div', { class: 'toolbar' },
      h('button', { class: 'btn btn--primary', disabled: st.due ? null : true, onclick: () => startSession(ctx, mine) }, '▶ Réviser'),
      h('button', { class: 'btn', onclick: () => cardSheet(ctx, deck) }, '+ Carte'),
      h('button', { class: 'btn', onclick: () => aiSheet(ctx, deck) }, 'Générer avec une IA')),
    mine.length
      ? h('ul', { class: 'cards' }, mine.map((c) => h('li', { class: 'card' },
        h('button', { class: 'card__main', onclick: () => cardSheet(ctx, deck, c) },
          h('span', { class: 'card__name' }, c.front),
          h('span', { class: 'muted' }, `${c.type === 'mcq' ? 'QCM' : 'Question / réponse'} · ${c.mem.state === 'new' ? 'à étudier' : `prochaine : ${formatDate(c.mem.due.slice(0, 10))}`}`)))))
      : empty('Aucune carte.', 'Ajoute-en une, ou génère-les depuis ton cours.'));
}

function cardSheet(ctx, deck, card = null) {
  const c = card ?? newCard({ deckId: deck.id });
  const type = select([['qa', 'Question / réponse'], ['mcq', 'QCM']], c.type);
  const front = h('textarea', { rows: 2, maxlength: 2000, required: true, value: c.front });
  const back = h('textarea', { rows: 2, maxlength: 2000, value: c.back });
  const choices = h('textarea', { rows: 4, maxlength: 2000, value: c.choices.join('\n'), placeholder: 'Une option par ligne' });
  const correct = h('input', { type: 'number', min: 1, max: 6, value: String(c.correct + 1) });
  const expl = h('textarea', { rows: 2, maxlength: 2000, value: c.explanation });
  openSheet(card ? 'Modifier la carte' : 'Nouvelle carte', h('div', { class: 'sheet__body' },
    field('Type', type), field('Question', front), field('Réponse (question / réponse)', back),
    field('Options (QCM)', choices), field('Numéro de la bonne option (QCM)', correct), field('Explication (le pourquoi)', expl)), {
    onSubmit: () => {
      const opts = choices.value.split('\n').map((x) => x.trim()).filter(Boolean);
      if (!front.value.trim()) return 'Écris la question.';
      if (type.value === 'mcq' && (opts.length < 2 || correct.value < 1 || correct.value > opts.length)) return 'Un QCM a au moins 2 options et un numéro de bonne option valide.';
      if (type.value === 'qa' && !back.value.trim()) return 'Écris la réponse.';
      const idx = Math.max(0, Number(correct.value) - 1);
      ctx.store.commit((s) => {
        Object.assign(c, {
          type: type.value, front: front.value.trim(), choices: type.value === 'mcq' ? opts : [], correct: idx,
          back: type.value === 'mcq' ? opts[idx] : back.value.trim(), explanation: expl.value.trim(),
        });
        if (!card) s.cards.push(c);
      });
    },
  });
}

function aiSheet(ctx, deck) {
  const type = select([['qa', 'Question / réponse'], ['mcq', 'QCM']], 'qa');
  const n = h('input', { type: 'number', min: 3, max: 40, value: '10' });
  const course = h('textarea', { rows: 5, maxlength: 50000, placeholder: 'Colle ici le texte de ton cours' });
  const reply = h('textarea', { rows: 5, maxlength: 100000, placeholder: 'Colle ici le JSON renvoyé par l\'IA' });
  const note = h('p', { class: 'muted', role: 'status' });
  const copy = h('button', {
    type: 'button', class: 'btn', onclick: async () => {
      if (!course.value.trim()) { note.textContent = 'Colle d\'abord ton cours.'; return; }
      const text = buildPrompt({ type: type.value, n: Number(n.value) || 10, course: course.value.trim() });
      try { await navigator.clipboard.writeText(text); note.textContent = 'Prompt copié : colle-le dans ton IA, puis rapporte sa réponse ci-dessous.'; } catch { note.textContent = 'Copie impossible ici : utilise un navigateur qui autorise le presse-papiers.'; }
    },
  }, 'Copier le prompt');
  openSheet('Générer des cartes avec une IA', h('div', { class: 'sheet__body' },
    h('p', { class: 'muted' }, 'Aucune clé dans l\'app : tu copies le prompt, tu le donnes à ton IA, puis tu colles sa réponse (JSON).'),
    field('Type de cartes', type), field('Nombre de cartes', n), field('Cours (texte)', course), copy, note, field('Réponse JSON de l\'IA', reply)), {
    submitLabel: 'Importer les cartes',
    onSubmit: () => {
      try { const cards = parseCards(reply.value, deck.id); ctx.store.commit((s) => s.cards.push(...cards)); } catch (e) { return e.message; }
    },
  });
}

// ---- Session de révision ----
function grade(ctx, id, g) {
  const ses = view.session;
  ctx.store.commit((s) => {
    const c = s.cards.find((x) => x.id === id);
    c.mem = review(c.mem, g);
    ses.ids.shift();
    if (g === 1) ses.ids.splice(Math.min(3, ses.ids.length), 0, id); // à revoir : revient vite
    else if (g === 2 && c.mem.state === 'learning') ses.ids.splice(Math.min(6, ses.ids.length), 0, id); // moyen : revient plus tard
    ses.shown = false; ses.picked = null; ses.done += 1;
  });
}

function reviewView(ctx) {
  const ses = view.session;
  const quit = () => { view.session = null; ctx.rerender(); };
  const head = h('div', { class: 'row between' },
    h('button', { class: 'btn btn--ghost', 'aria-label': 'Quitter la session', onclick: quit }, '✕ Quitter'),
    h('span', { class: 'muted' }, ses.ids.length ? `${ses.ids.length} restante${ses.ids.length > 1 ? 's' : ''}` : 'Terminé'));
  const prog = h('progress', { max: Math.max(1, ses.done + ses.ids.length), value: ses.done, 'aria-label': 'Progression' });
  const c = ctx.store.state.cards.find((x) => x.id === ses.ids[0]);
  if (!c) return h('div', { class: 'page' }, head, h('h1', { class: 'page-title' }, 'Révision'), empty('Tu es à jour, reviens demain.'), h('button', { class: 'btn btn--primary', onclick: quit }, 'Terminer'));

  const body = [h('p', { class: 'review__q' }, c.front)];
  if (c.type === 'mcq') {
    body.push(h('div', { class: 'review__choices' }, c.choices.map((opt, i) => h('button', {
      class: 'btn', disabled: ses.picked !== null ? true : null,
      onclick: () => { ses.picked = i; ses.shown = true; ctx.rerender(); },
    }, ses.picked === null ? opt : `${opt}${i === c.correct ? ' ✓' : i === ses.picked ? ' ✗' : ''}`))));
    if (ses.picked !== null) {
      const ok = ses.picked === c.correct;
      body.push(h('p', { role: 'status' }, ok ? 'Bonne réponse.' : `Faux : la bonne réponse est « ${c.choices[c.correct]} ».`), c.explanation && h('p', { class: 'muted' }, c.explanation),
        h('button', { class: 'btn btn--primary', onclick: () => grade(ctx, c.id, ok ? 3 : 1) }, 'Suivant'));
    }
  } else if (!ses.shown) {
    body.push(h('button', { class: 'btn btn--primary', onclick: () => { ses.shown = true; ctx.rerender(); } }, 'Révéler la réponse'));
  } else {
    body.push(h('p', { class: 'review__a' }, c.back), c.explanation && h('p', { class: 'muted' }, c.explanation),
      h('div', { class: 'review__grades' }, [[1, 'À revoir'], [2, 'Moyen'], [3, 'Bien']].map(([g, name]) => h('button', {
        class: `btn btn--grade-${g}`, onclick: () => grade(ctx, c.id, g),
      }, h('span', null, name), h('span', { class: 'muted' }, label(c.mem, g))))));
  }
  return h('div', { class: 'page' }, head, prog, h('div', { class: 'review' }, body));
}

// Raccourcis : Espace = révéler ; 1 / 2 / 3 = à revoir / moyen / bien.
function bindKeys(ctx) {
  if (keysBound || typeof document === 'undefined') return;
  keysBound = true;
  document.addEventListener('keydown', (e) => {
    const ses = view.session;
    if (!ses || document.querySelector('dialog[open]') || /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
    const c = ctx.store.state.cards.find((x) => x.id === ses.ids[0]);
    if (!c || c.type === 'mcq') return;
    if (e.key === ' ' && !ses.shown) { e.preventDefault(); ses.shown = true; ctx.rerender(); }
    else if (ses.shown && ['1', '2', '3'].includes(e.key)) grade(ctx, c.id, Number(e.key));
  });
}
