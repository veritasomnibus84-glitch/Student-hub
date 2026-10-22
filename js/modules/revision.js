import { h, field, select, empty, formatDate } from '../dom.js';
import { openSheet } from '../ui/dialog.js';
import { review, label, newMemory } from '../fsrs.js';
import { ymd } from '../calendar-logic.js';
import { buildPlan, describeTask } from '../planning.js';
import * as L from '../revision-logic.js';
import { attachMenu, menuButton, copyItem, deleteItem } from '../ui/context-menu.js';

// Vue courante : liste des leçons, une leçon (3 sous-onglets), une session de révision, ou un examen.
const view = { deckId: '', tab: 'keep', grid: false, session: null, exam: null };
let keysBound = false;
const TABS = [['learn', 'Apprendre'], ['keep', 'Retenir'], ['practice', 'S\'exercer']];
const plural = (n, w) => `${n} ${w}${n > 1 ? 's' : ''}`;
const today = () => ymd(new Date());
const lines = (el) => el.value.split('\n').map((x) => x.trim()).filter(Boolean);
const mmss = (ms) => { const s = Math.max(0, Math.ceil(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };

async function copyText(text, note, okMsg) {
  try { await navigator.clipboard.writeText(text); note.textContent = okMsg; } catch { note.textContent = 'Copie impossible ici : utilise un navigateur qui autorise le presse-papiers.'; }
}
const speakable = () => typeof window !== 'undefined' && 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined';
function speakBtn(text) {
  if (!speakable()) return null;
  return h('button', { class: 'btn btn--ghost', 'aria-label': 'Lire à voix haute', onclick: () => { window.speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(text); u.lang = 'fr-FR'; window.speechSynthesis.speak(u); } }, '🔊');
}

// Remet la vue à zéro (tests, ou changement de compte).
export function resetView() { Object.assign(view, { deckId: '', tab: 'keep', grid: false, session: null, exam: null }); }

export function render(ctx) {
  bindKeys(ctx);
  if (view.exam) return examView(ctx);
  if (view.session) return reviewView(ctx);
  const deck = ctx.store.state.decks.find((d) => d.id === view.deckId);
  return deck ? deckView(ctx, deck) : listView(ctx);
}

const startSession = (ctx, cards) => {
  const ids = L.queue(cards).map((c) => c.id);
  view.session = { ids, done: 0, shown: false, picked: null };
  ctx.rerender();
};

// ---------- Liste des leçons ----------
function listView(ctx) {
  const { decks, cards, courses, revDays } = ctx.store.state;
  const allDue = L.stats(cards).due; const run = L.streak(revDays, today());
  return h('div', { class: 'page' },
    h('h1', { class: 'page-title' }, 'Mémorisation'),
    h('p', { class: 'muted' }, `${plural(allDue, 'carte')} à réviser · série : ${plural(run, 'jour')} · répétition espacée (FSRS-6)`),
    h('div', { class: 'toolbar' },
      h('button', { class: 'btn btn--primary', onclick: () => deckSheet(ctx, courses) }, '+ Leçon'),
      allDue > 0 && h('button', { class: 'btn', onclick: () => startSession(ctx, cards) }, '▶ Tout réviser')),
    decks.length
      ? h('ul', { class: 'cards' }, decks.map((d) => {
        const st = L.stats(cards.filter((c) => c.deckId === d.id));
        const items = () => [
          { label: 'Ouvrir', onSelect: () => { view.deckId = d.id; view.tab = 'keep'; ctx.rerender(); } },
          st.due > 0 && { label: 'Réviser', onSelect: () => startSession(ctx, cards.filter((c) => c.deckId === d.id)) },
          st.total > 0 && { label: 'Lancer un examen', onSelect: () => { view.deckId = d.id; view.tab = 'practice'; ctx.rerender(); examSheet(ctx, d, cards.filter((c) => c.deckId === d.id)); } },
          copyItem(d.name, 'Copier le nom'),
          deleteItem(`la leçon « ${d.name} » et ses cartes`, () => ctx.store.commit((s) => { s.decks = s.decks.filter((x) => x.id !== d.id); s.cards = s.cards.filter((x) => x.deckId !== d.id); s.gaps = s.gaps.filter((x) => x.deckId !== d.id); s.exams = s.exams.filter((x) => x.deckId !== d.id); })),
        ];
        return attachMenu(h('li', { class: 'card' },
          h('button', { class: 'card__main', onclick: () => { view.deckId = d.id; view.tab = 'keep'; ctx.rerender(); } },
            h('span', { class: 'card__name' }, d.name),
            h('span', { class: 'muted' }, `${plural(st.total, 'carte')} · ${st.due} à réviser${d.exam ? ` · examen ${formatDate(d.exam)}` : ''}`)),
          h('div', { class: 'card__actions' }, st.due > 0 && h('button', {
            class: 'btn btn--ghost', 'aria-label': `Réviser ${d.name}`, onclick: () => startSession(ctx, cards.filter((c) => c.deckId === d.id)),
          }, '▶'), menuButton(items, `Actions pour ${d.name}`))), items);
      }))
      : empty('Aucune leçon.', 'Crée une leçon, colle ton cours, puis ajoute des cartes à la main, par fichier ou avec une IA.'));
}

function deckSheet(ctx, courses) {
  const name = h('input', { type: 'text', maxlength: 200, required: true, placeholder: 'ex. Cinématique' });
  const course = select([['', '— Aucun cours —'], ...courses.map((c) => [c.id, c.name])], '');
  const exam = h('input', { type: 'date' });
  openSheet('Nouvelle leçon', h('div', { class: 'sheet__body' }, field('Nom', name), field('Cours', course), field('Date d\'examen (facultatif)', exam)), {
    onSubmit: () => {
      if (!name.value.trim()) return 'Donne un nom à la leçon.';
      const d = L.newDeck({ name: name.value.trim(), courseId: course.value, exam: exam.value });
      view.deckId = d.id; view.tab = 'learn'; // avant le commit : c'est lui qui redessine
      ctx.store.commit((s) => s.decks.push(d));
    },
  });
}

// ---------- Une leçon ----------
function deckView(ctx, deck) {
  const { store } = ctx;
  const mine = store.state.cards.filter((c) => c.deckId === deck.id);
  const body = view.tab === 'learn' ? learnTab(ctx, deck, mine) : view.tab === 'practice' ? practiceTab(ctx, deck, mine) : keepTab(ctx, deck, mine);
  return h('div', { class: 'page' },
    h('div', { class: 'row between' },
      h('button', { class: 'btn btn--ghost', onclick: () => { view.deckId = ''; ctx.rerender(); } }, '← Leçons'),
      h('button', {
        class: 'btn btn--danger', onclick: () => {
          if (confirm(`Supprimer « ${deck.name} » et ses ${mine.length} cartes ?`)) {
            store.commit((s) => { s.decks = s.decks.filter((d) => d.id !== deck.id); s.cards = s.cards.filter((c) => c.deckId !== deck.id); s.gaps = s.gaps.filter((g) => g.deckId !== deck.id); s.exams = s.exams.filter((e) => e.deckId !== deck.id); }); view.deckId = '';
          }
        },
      }, 'Supprimer la leçon')),
    h('h1', { class: 'page-title' }, deck.name),
    h('div', { class: 'tabs', role: 'group', 'aria-label': 'Sections de la leçon' }, TABS.map(([k, name]) => h('button', {
      class: 'btn', 'aria-pressed': String(view.tab === k), onclick: () => { view.tab = k; ctx.rerender(); },
    }, name))),
    body);
}

// ----- Apprendre : source, objectifs d'examen, planning -----
function learnTab(ctx, deck, mine) {
  const { store } = ctx;
  const set = (patch) => store.commit(() => Object.assign(deck, patch));
  const targetLab = h('span', { class: 'muted' }, `${deck.target}/20`);
  const plan = buildPlan({ cards: mine, exam: deck.exam, target: deck.target, today: today(), maxMin: deck.maxMin });
  const layers = L.LAYERS.map(([k, name]) => `${name} ${mine.filter((c) => c.layer === k).length}`).join(' · ');
  const planBox = !deck.exam ? h('p', { class: 'muted' }, 'Choisis une date d\'examen pour obtenir ton planning optimal.')
    : !plan ? h('p', { class: 'muted' }, 'La date d\'examen est passée : choisis-en une nouvelle.')
      : h('div', { class: 'stack' },
        h('p', null, `${plural(plan.D, 'jour')} avant l'examen. Écart conseillé entre deux révisions d'une même carte : environ ${plan.gap} j.`),
        h('label', { class: 'field' }, h('span', { class: 'field__label' }, `Temps gagné (estimation) : ${Math.round(plan.gauges.timeSaved * 100)} %`), h('progress', { max: 1, value: plan.gauges.timeSaved })),
        h('label', { class: 'field' }, h('span', { class: 'field__label' }, `Maîtrise à l'examen (estimation) : ${Math.round(plan.gauges.mastery * 100)} %`), h('progress', { max: 1, value: plan.gauges.mastery })),
        plan.uncovered > 0 && h('p', { class: 'error' }, `${plural(plan.uncovered, 'carte')} ne tiennent pas dans ${deck.maxMin} min par jour : augmente le temps, baisse la note visée ou repousse l'examen.`),
        mine.length === 0 && h('p', { class: 'muted' }, 'Ajoute des cartes dans Retenir pour un planning complet.'),
        h('ul', { class: 'plain' }, plan.days.slice(0, 14).map((d) => h('li', { class: 'row between plan__day' },
          h('span', null, formatDate(d.date)), h('span', { class: 'muted plan__tasks' }, `${d.tasks.map(describeTask).join(' · ')} (≈ ${d.minutes} min)`)))),
        plan.days.length > 14 && h('p', { class: 'muted' }, `… et ${plan.days.length - 14} jours de plus jusqu'à l'examen.`));
  return h('div', { class: 'stack' },
    h('section', { class: 'block stack' }, h('h2', null, 'Source du cours'),
      h('p', { class: 'muted' }, 'Colle ici le texte de ton cours : il sert à générer des cartes avec une IA.'),
      h('textarea', { rows: 8, maxlength: 50000, value: deck.source, placeholder: 'Texte du cours…', 'aria-label': 'Source du cours', onchange: (e) => set({ source: e.target.value }) })),
    h('section', { class: 'block stack' }, h('h2', null, 'Examen et planning'),
      h('div', { class: 'row wrap' },
        field('Date d\'examen', h('input', { type: 'date', value: deck.exam, onchange: (e) => set({ exam: e.target.value }) }), 'field--inline'),
        field('Format', select(L.EXAM_FORMATS, deck.format, { onchange: (e) => set({ format: e.target.value }) }), 'field--inline'),
        field('Temps max par jour', select([['30', '30 min'], ['45', '45 min'], ['60', '1 h'], ['90', '1 h 30'], ['120', '2 h']], String(deck.maxMin), { onchange: (e) => set({ maxMin: Number(e.target.value) }) }), 'field--inline')),
      h('label', { class: 'field' }, h('span', { class: 'field__label' }, 'Note visée : ', targetLab),
        h('input', { type: 'range', min: 10, max: 20, step: 1, value: String(deck.target), 'aria-label': 'Note visée sur 20', oninput: (e) => { targetLab.textContent = `${e.target.value}/20`; }, onchange: (e) => set({ target: Number(e.target.value) }) })),
      h('p', { class: 'muted' }, `Couches : ${layers}`), planBox));
}

// ----- Retenir : cartes -----
function keepTab(ctx, deck, mine) {
  const st = L.stats(mine);
  const item = (c) => attachMenu(h('li', { class: 'card' },
    h('button', { class: 'card__main', onclick: () => cardSheet(ctx, deck, c) },
      h('span', { class: 'card__name' }, c.front),
      h('span', { class: 'muted' }, `${L.TYPE_LABELS[c.type]} · ${L.LAYERS.find(([k]) => k === c.layer)[1]} · ${c.mem.state === 'new' ? 'à étudier' : `prochaine : ${formatDate(c.mem.due.slice(0, 10))}`}`)),
    h('div', { class: 'card__actions' }, h('button', {
      class: 'btn btn--ghost btn--danger', 'aria-label': 'Supprimer la carte', onclick: () => { if (confirm('Supprimer cette carte ?')) ctx.store.commit((s) => { s.cards = s.cards.filter((x) => x.id !== c.id); }); },
    }, '✕'), menuButton(() => cardItems(ctx, deck, c), 'Actions de la carte'))), () => cardItems(ctx, deck, c));
  return h('div', { class: 'stack' },
    h('p', { class: 'muted' }, `${st.due} à réviser · maîtrisées ${st.mastered} · en cours ${st.learning} · à étudier ${st.fresh}`),
    h('progress', { max: Math.max(1, st.total), value: st.mastered, 'aria-label': 'Cartes maîtrisées' }),
    h('div', { class: 'toolbar' },
      h('button', { class: 'btn btn--primary', disabled: st.due ? null : true, onclick: () => startSession(ctx, mine) }, '▶ Réviser'),
      h('button', { class: 'btn', onclick: () => cardSheet(ctx, deck) }, '+ Carte'),
      h('button', { class: 'btn', onclick: () => aiSheet(ctx, deck) }, 'Générer avec une IA'),
      h('button', { class: 'btn', onclick: () => importSheet(ctx, deck) }, 'Importer'),
      h('button', { class: 'btn btn--ghost', 'aria-pressed': String(view.grid), onclick: () => { view.grid = !view.grid; ctx.rerender(); } }, view.grid ? 'Vue liste' : 'Vue grille')),
    mine.length ? h('ul', { class: `cards ${view.grid ? 'cards--grid' : ''}`.trim() }, mine.map(item))
      : empty('Aucune carte.', 'Ajoute-en une, importe un fichier, ou génère-les depuis ton cours.'));
}

const NEXT_LAYER = { core: 'pillar', pillar: 'detail', detail: 'core' };
function cardItems(ctx, deck, c) {
  return [
    { label: 'Modifier', onSelect: () => cardSheet(ctx, deck, c) },
    { label: `Couche : ${L.LAYERS.find(([k]) => k === NEXT_LAYER[c.layer])[1]}`, onSelect: () => ctx.store.commit(() => { c.layer = NEXT_LAYER[c.layer]; }) },
    c.mem.state !== 'new' && { label: 'Remettre « à étudier »', onSelect: () => ctx.store.commit(() => { c.mem = newMemory(); }) },
    speakable() && { label: 'Lire à voix haute', onSelect: () => { window.speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(c.front); u.lang = 'fr-FR'; window.speechSynthesis.speak(u); } },
    { label: 'Dupliquer', onSelect: () => ctx.store.commit((s) => { s.cards.push(L.newCard({ ...c, id: Math.random().toString(36).slice(2, 9), mem: newMemory() })); }) },
    copyItem(`${c.front}\n${c.back}`),
    deleteItem('cette carte', () => ctx.store.commit((s) => { s.cards = s.cards.filter((x) => x.id !== c.id); })),
  ];
}

function cardSheet(ctx, deck, card = null) {
  const c = card ?? L.newCard({ deckId: deck.id });
  const type = select(L.CARD_TYPES.map((k) => [k, L.TYPE_LABELS[k]]), c.type);
  const front = h('textarea', { rows: 2, maxlength: 2000, required: true, value: c.front });
  const back = h('textarea', { rows: 2, maxlength: 2000, value: L.isChoice(c.type) ? '' : c.back });
  const choices = h('textarea', { rows: 4, maxlength: 2000, value: c.type === 'mcq' ? c.choices.join('\n') : '', placeholder: 'Une option par ligne' });
  const correct = h('input', { type: 'number', min: 1, max: 6, value: String(c.correct + 1) });
  const tf = select([['true', 'Vrai'], ['false', 'Faux']], c.type === 'tf' && c.correct === 1 ? 'false' : 'true');
  const accepted = h('textarea', { rows: 2, maxlength: 1000, value: c.accepted.join('\n'), placeholder: 'Variantes acceptées, une par ligne' });
  const hint = h('input', { type: 'text', maxlength: 500, value: c.hint, placeholder: 'ex. mot-clé qui ressemble au son + image mentale' });
  const layer = select(L.LAYERS, c.layer);
  const expl = h('textarea', { rows: 2, maxlength: 2000, value: c.explanation });
  openSheet(card ? 'Modifier la carte' : 'Nouvelle carte', h('div', { class: 'sheet__body' },
    field('Type', type), field('Question (à trous : écris ____ à la place du mot caché)', front),
    field('Réponse (question/réponse, définition, mot, à trous)', back),
    field('Options (QCM)', choices), field('Numéro de la bonne option (QCM)', correct), field('Vrai ou faux ? (V/F)', tf),
    field('Variantes acceptées (à trous)', accepted), field('Médiateur / indice (mot/traduction)', hint),
    field('Couche', layer), field('Explication (le pourquoi)', expl)), {
    onSubmit: () => {
      const t = type.value; const opts = lines(choices);
      if (!front.value.trim()) return 'Écris la question.';
      if (t === 'mcq' && (opts.length < 2 || correct.value < 1 || correct.value > opts.length)) return 'Un QCM a au moins 2 options et un numéro de bonne option valide.';
      if (t === 'cloze' && !front.value.includes('____')) return 'Une carte à trous contient ____ à l\'endroit du mot caché.';
      if ((L.isFree(t) || t === 'cloze') && !back.value.trim()) return 'Écris la réponse.';
      const idx = t === 'tf' ? (tf.value === 'true' ? 0 : 1) : Math.max(0, Number(correct.value) - 1);
      ctx.store.commit((s) => {
        Object.assign(c, {
          type: t, front: front.value.trim(), choices: t === 'mcq' ? opts : t === 'tf' ? ['Vrai', 'Faux'] : [], correct: L.isChoice(t) ? idx : 0,
          back: t === 'mcq' ? opts[idx] : t === 'tf' ? (idx === 0 ? 'Vrai' : 'Faux') : back.value.trim(),
          accepted: t === 'cloze' ? lines(accepted) : [], hint: t === 'word' ? hint.value.trim() : '', layer: layer.value, explanation: expl.value.trim(),
        });
        if (!card) s.cards.push(c);
      });
    },
  });
}

function aiSheet(ctx, deck) {
  const type = select(L.CARD_TYPES.map((k) => [k, L.TYPE_LABELS[k]]), 'qa');
  const n = h('input', { type: 'number', min: 3, max: 40, value: '10' });
  const course = h('textarea', { rows: 5, maxlength: 50000, value: deck.source, placeholder: 'Colle ici le texte de ton cours' });
  const reply = h('textarea', { rows: 5, maxlength: 100000, placeholder: 'Colle ici le JSON renvoyé par l\'IA' });
  const note = h('p', { class: 'muted', role: 'status' });
  const copy = h('button', {
    type: 'button', class: 'btn', onclick: () => {
      if (!course.value.trim()) { note.textContent = 'Colle d\'abord ton cours.'; return; }
      copyText(L.buildPrompt({ type: type.value, n: Number(n.value) || 10, course: course.value.trim() }), note, 'Prompt copié : colle-le dans ton IA, puis rapporte sa réponse ci-dessous.');
    },
  }, 'Copier le prompt');
  openSheet('Générer des cartes avec une IA', h('div', { class: 'sheet__body' },
    h('p', { class: 'muted' }, 'Aucune clé dans l\'app : tu copies le prompt, tu le donnes à ton IA, puis tu colles sa réponse (JSON). Relis les cartes avant de les garder.'),
    field('Type de cartes', type), field('Nombre de cartes', n), field('Cours (texte)', course), copy, note, field('Réponse JSON de l\'IA', reply)), {
    submitLabel: 'Importer les cartes',
    onSubmit: () => { try { const cards = L.parseCards(reply.value, deck.id); ctx.store.commit((s) => s.cards.push(...cards)); } catch (e) { return e.message; } },
  });
}

function importSheet(ctx, deck) {
  const type = select(['qa', 'def', 'word'].map((k) => [k, L.TYPE_LABELS[k]]), 'qa');
  const area = h('textarea', { rows: 7, maxlength: 200000, placeholder: 'question ; réponse (une carte par ligne)' });
  const file = h('input', { type: 'file', accept: '.csv,.tsv,.txt,text/plain,text/csv', onchange: async (e) => { const f = e.target.files?.[0]; if (f) area.value = (await f.text()).slice(0, 200000); } });
  openSheet('Importer des cartes (CSV, TSV, Anki)', h('div', { class: 'sheet__body' },
    h('p', { class: 'muted' }, 'Un fichier texte avec une carte par ligne, séparée par une tabulation, un point-virgule ou une virgule. L\'export texte d\'Anki convient.'),
    field('Type des cartes', type), field('Fichier', file), field('Ou colle le contenu', area)), {
    submitLabel: 'Importer',
    onSubmit: () => { try { const cards = L.parseCSV(area.value, deck.id, type.value); ctx.store.commit((s) => s.cards.push(...cards)); } catch (e) { return e.message; } },
  });
}

// ----- S'exercer : examens et blocages -----
function practiceTab(ctx, deck, mine) {
  const { store } = ctx; const { exams, gaps } = store.state;
  const myExams = exams.filter((e) => e.deckId === deck.id).sort((a, b) => b.date.localeCompare(a.date));
  const myGaps = gaps.filter((g) => g.deckId === deck.id);
  const topic = h('input', { type: 'text', maxlength: 300, placeholder: 'Notion qui a bloqué', 'aria-label': 'Notion qui a bloqué' });
  const note = h('input', { type: 'text', maxlength: 2000, placeholder: 'Pourquoi (facultatif)', 'aria-label': 'Précision' });
  const msg = h('p', { class: 'muted', role: 'status' });
  return h('div', { class: 'stack' },
    mine.length ? h('div', { class: 'toolbar' }, h('button', { class: 'btn btn--primary', onclick: () => examSheet(ctx, deck, mine) }, 'Commencer un examen'))
      : empty('Passe ton premier examen', 'Crée d\'abord des cartes dans l\'onglet Retenir, puis lance un examen chronométré.'),
    myExams.length > 0 && h('section', { class: 'block stack' }, h('h2', null, 'Mes examens'),
      h('ul', { class: 'plain' }, myExams.slice(0, 10).map((e) => h('li', { class: 'row between' }, h('span', null, formatDate(e.date.slice(0, 10))),
        h('span', { class: 'muted' }, `${e.score}/20${e.predicted != null ? ` (prédit ${e.predicted}, écart ${Math.round((e.score - e.predicted) * 10) / 10})` : ''}`))))),
    h('section', { class: 'block stack' }, h('h2', null, 'Journal des blocages'),
      h('p', { class: 'muted' }, 'Note ce qui t\'a bloqué pendant un examen ou un exercice. Une IA peut en faire des cartes ciblées.'),
      h('div', { class: 'row wrap' }, topic, note, h('button', {
        class: 'btn', onclick: () => { if (!topic.value.trim()) return; store.commit((s) => s.gaps.push({ id: Math.random().toString(36).slice(2, 9), deckId: deck.id, topic: topic.value.trim(), note: note.value.trim(), created: new Date().toISOString() })); },
      }, 'Ajouter')),
      myGaps.length ? h('ul', { class: 'plain' }, myGaps.map((g) => h('li', { class: 'row between' }, h('span', null, g.topic, g.note && h('span', { class: 'muted' }, ` : ${g.note}`)),
        h('button', { class: 'btn btn--ghost btn--danger', 'aria-label': `Supprimer « ${g.topic} »`, onclick: () => store.commit((s) => { s.gaps = s.gaps.filter((x) => x.id !== g.id); }) }, '✕')))) : h('p', { class: 'muted' }, 'Aucun blocage noté.'),
      myGaps.length > 0 && h('button', { class: 'btn', onclick: () => copyText(L.gapPrompt(myGaps, deck.source), msg, 'Prompt copié : colle-le dans ton IA, puis colle sa réponse dans Retenir → Générer avec une IA.') }, 'Copier le prompt de rattrapage'), msg));
}

function examSheet(ctx, deck, mine) {
  const display = select([['all', 'Toutes d\'un coup'], ['one', 'Une par une']], 'all');
  const duration = select([['5', '5 min'], ['10', '10 min'], ['15', '15 min'], ['30', '30 min'], ['60', '1 h']], '15');
  const boxes = L.EXAM_KINDS.map(([k, name]) => { const count = mine.filter((c) => L.kindOf(c) === k).length; return [k, name, count, h('input', { type: 'checkbox', checked: count > 0, disabled: count === 0 ? true : null })]; });
  const n = h('input', { type: 'number', min: 1, max: 200, placeholder: 'Maximum' });
  const predicted = h('input', { type: 'number', min: 0, max: 20, step: 0.5, placeholder: 'ex. 14' });
  openSheet('Configurer l\'examen', h('div', { class: 'sheet__body' },
    field('Affichage des questions', display), field('Durée', duration),
    h('div', { class: 'field' }, h('span', { class: 'field__label' }, 'Types de cartes'), boxes.map(([, name, count, box]) => h('label', { class: 'row' }, box, `${name} (${count})`))),
    field('Nombre de questions (vide = maximum)', n), field('Ta note prédite sur 20 (facultatif)', predicted)), {
    submitLabel: 'Lancer l\'examen',
    onSubmit: () => {
      const kinds = boxes.filter(([, , , box]) => box.checked).map(([k]) => k);
      const items = L.pickExam(mine, { kinds, n: n.value ? Math.round(Number(n.value)) : 1e9 });
      if (!items.length) return 'Choisis au moins un type de carte.';
      const ms = Number(duration.value) * 60000;
      view.exam = {
        deckId: deck.id, display: display.value, end: Date.now() + ms, idx: 0, phase: 'run', note: 0,
        predicted: predicted.value === '' ? null : Math.min(20, Math.max(0, Number(predicted.value))),
        items: items.map((c) => ({ id: c.id, answer: '', picked: null, score: null })),
      };
      ctx.rerender();
    },
  });
}

function finishRun(ctx) {
  const ex = view.exam; if (!ex || ex.phase !== 'run') return;
  ex.items.forEach((it) => { const c = ctx.store.state.cards.find((x) => x.id === it.id); it.score = c ? L.autoScore(c, it) : 0; });
  ex.phase = ex.items.some((it) => it.score === null) ? 'correct' : 'result';
  if (ex.phase === 'result') finalize(ctx); else ctx.rerender();
}

function finalize(ctx) {
  const ex = view.exam; const scores = ex.items.map((it) => it.score ?? 0);
  ex.note = L.examNote(scores); ex.phase = 'result';
  ctx.store.commit((s) => {
    s.exams.push({ id: Math.random().toString(36).slice(2, 9), deckId: ex.deckId, date: new Date().toISOString(), n: scores.length, predicted: ex.predicted, score: ex.note });
    ex.items.forEach((it) => { if ((it.score ?? 0) < 0.5) { const c = s.cards.find((x) => x.id === it.id); if (c) c.mem = newMemory(); } }); // les erreurs repassent « à étudier »
    L.markDay(s, today());
  });
}

function examView(ctx) {
  const ex = view.exam; const cards = ctx.store.state.cards;
  const cardOf = (it) => cards.find((x) => x.id === it.id) ?? L.newCard({ front: '(carte supprimée)' });
  const leave = () => { view.exam = null; ctx.rerender(); };
  if (ex.phase === 'correct') return correctView(ctx, ex, cardOf, leave);
  if (ex.phase === 'result') return resultView(ctx, ex, cardOf, leave);

  const timer = h('span', { class: 'exam__timer', role: 'timer' }, mmss(ex.end - Date.now()));
  const iv = setInterval(() => {
    if (!timer.isConnected) { clearInterval(iv); return; }
    const left = ex.end - Date.now(); timer.textContent = mmss(left);
    if (left <= 0) { clearInterval(iv); finishRun(ctx); }
  }, 1000);
  iv.unref?.();
  const block = (it, i) => {
    const c = cardOf(it);
    let control;
    if (L.isChoice(c.type)) control = h('div', { class: 'review__choices' }, c.choices.map((opt, k) => h('button', { class: 'btn', 'aria-pressed': String(it.picked === k), onclick: () => { it.picked = k; ctx.rerender(); } }, opt)));
    else if (c.type === 'cloze') control = h('input', { type: 'text', value: it.answer, maxlength: 200, 'aria-label': 'Ta réponse', oninput: (e) => { it.answer = e.target.value; } });
    else control = h('textarea', { rows: 3, maxlength: 2000, value: it.answer, 'aria-label': 'Ta réponse', oninput: (e) => { it.answer = e.target.value; } });
    return h('section', { class: 'review stack' }, h('p', { class: 'muted' }, `Question ${i + 1} sur ${ex.items.length}`), h('p', { class: 'review__q' }, c.front), control);
  };
  const one = ex.display === 'one';
  return h('div', { class: 'page' },
    h('div', { class: 'row between' },
      h('button', { class: 'btn btn--ghost', onclick: () => { if (confirm('Abandonner l\'examen ? Rien ne sera enregistré.')) leave(); } }, '✕ Abandonner'), timer),
    h('h1', { class: 'page-title' }, 'Examen'),
    one ? block(ex.items[ex.idx], ex.idx) : ex.items.map(block),
    h('div', { class: 'row between' },
      one ? h('button', { class: 'btn', disabled: ex.idx === 0 ? true : null, onclick: () => { ex.idx -= 1; ctx.rerender(); } }, '← Précédente') : h('span'),
      one && ex.idx < ex.items.length - 1 ? h('button', { class: 'btn', onclick: () => { ex.idx += 1; ctx.rerender(); } }, 'Suivante →')
        : h('button', { class: 'btn btn--primary', onclick: () => finishRun(ctx) }, 'Terminer l\'examen')));
}

function correctView(ctx, ex, cardOf, leave) {
  const free = ex.items.filter((it) => it.score === null);
  const msg = h('p', { class: 'muted', role: 'status' });
  const paste = h('textarea', { rows: 4, maxlength: 50000, placeholder: 'Colle ici le JSON de correction de l\'IA' });
  const data = free.map((it) => ({ front: cardOf(it).front, back: cardOf(it).back, answer: it.answer }));
  return h('div', { class: 'page' },
    h('div', { class: 'row between' }, h('button', { class: 'btn btn--ghost', onclick: leave }, '✕ Abandonner')),
    h('h1', { class: 'page-title' }, 'Correction'),
    h('p', { class: 'muted' }, 'Compare ta réponse à la réponse attendue, puis note-toi honnêtement : faux, partiel ou juste. Une IA peut aussi corriger à ta place.'),
    free.map((it) => { const c = cardOf(it); return h('section', { class: 'review stack' },
      h('p', { class: 'review__q' }, c.front), h('p', null, h('strong', null, 'Ta réponse : '), it.answer || '(vide)'), h('p', null, h('strong', null, 'Attendu : '), c.back), c.explanation && h('p', { class: 'muted' }, c.explanation),
      h('div', { class: 'review__grades' }, [[0, 'Faux'], [0.5, 'Partiel'], [1, 'Juste']].map(([v, name]) => h('button', { class: 'btn', 'aria-pressed': String(it.score === v), onclick: () => { it.score = v; ctx.rerender(); } }, name)))); }),
    h('section', { class: 'block stack' }, h('h2', null, 'Correction par une IA (facultatif)'),
      h('button', { class: 'btn', onclick: () => copyText(L.correctionPrompt(data), msg, 'Prompt copié : colle-le dans ton IA, puis colle sa réponse ci-dessous.') }, 'Copier le prompt de correction'), paste,
      h('button', { class: 'btn', onclick: () => { try { L.parseScores(paste.value, free.length).forEach((v, i) => { free[i].score = v; }); ctx.rerender(); } catch (e) { msg.textContent = e.message; } } }, 'Appliquer les scores'), msg),
    h('button', { class: 'btn btn--primary', disabled: free.every((it) => it.score !== null) ? null : true, onclick: () => finalize(ctx) }, 'Voir le résultat'));
}

function resultView(ctx, ex, cardOf, leave) {
  const weak = ex.items.filter((it) => (it.score ?? 0) < 0.5).slice(0, 3);
  const diff = ex.predicted == null ? null : Math.round((ex.note - ex.predicted) * 10) / 10;
  return h('div', { class: 'page' },
    h('h1', { class: 'page-title' }, 'Résultat'),
    h('p', { class: 'big-note' }, `${ex.note}/20`),
    diff !== null && h('p', null, `Tu avais prédit ${ex.predicted}/20 : écart de ${diff > 0 ? '+' : ''}${diff}. ${diff < -2 ? 'Tu as surestimé ton niveau : c\'est courant, relire donne l\'impression de savoir.' : diff > 2 ? 'Tu as sous-estimé ton niveau.' : 'Ton estimation est juste.'}`),
    weak.length > 0 && h('section', { class: 'block stack' }, h('h2', null, 'Notions à retravailler'), h('ul', { class: 'plain' }, weak.map((it) => h('li', null, cardOf(it).front))),
      h('p', { class: 'muted' }, 'Les cartes ratées repassent « à étudier ». Note ce qui t\'a bloqué dans le journal des blocages.')),
    h('section', { class: 'block stack' }, h('h2', null, 'Détail'), h('ul', { class: 'plain' }, ex.items.map((it) => { const c = cardOf(it); const ok = (it.score ?? 0) >= 0.5;
      return h('li', { class: 'stack' }, h('span', null, `${ok ? '✓' : '✗'} ${c.front}`), !ok && h('span', { class: 'muted' }, `Bonne réponse : ${c.back}`), c.explanation && h('span', { class: 'muted' }, c.explanation)); }))),
    h('button', { class: 'btn btn--primary', onclick: () => { view.tab = 'practice'; leave(); } }, 'Terminer'));
}

// ---------- Session de révision ----------
function grade(ctx, id, g) {
  const ses = view.session;
  ctx.store.commit((s) => {
    const c = s.cards.find((x) => x.id === id);
    c.mem = review(c.mem, g);
    ses.ids.shift();
    if (g === 1) ses.ids.splice(Math.min(3, ses.ids.length), 0, id); // à revoir : revient vite
    else if (g === 2 && c.mem.state === 'learning') ses.ids.splice(Math.min(6, ses.ids.length), 0, id); // moyen : revient plus tard
    ses.shown = false; ses.picked = null; ses.done += 1;
    L.markDay(s, today());
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
  if (!c) return h('div', { class: 'page' }, head, h('h1', { class: 'page-title' }, 'Mémorisation'), empty('Tu es à jour, reviens demain.'), h('button', { class: 'btn btn--primary', onclick: quit }, 'Terminer'));

  const body = [h('div', { class: 'row between' }, h('p', { class: 'review__q' }, c.front), speakBtn(c.front))];
  const next = (ok) => h('button', { class: 'btn btn--primary', onclick: () => grade(ctx, c.id, ok ? 3 : 1) }, 'Suivant');
  if (L.isChoice(c.type)) {
    body.push(h('div', { class: 'review__choices' }, c.choices.map((opt, i) => h('button', {
      class: 'btn', disabled: ses.picked !== null ? true : null, onclick: () => { ses.picked = i; ses.shown = true; ctx.rerender(); },
    }, ses.picked === null ? opt : `${opt}${i === c.correct ? ' ✓' : i === ses.picked ? ' ✗' : ''}`))));
    if (ses.picked !== null) { const ok = ses.picked === c.correct; body.push(h('p', { role: 'status' }, ok ? 'Bonne réponse.' : `Faux : la bonne réponse est « ${c.choices[c.correct]} ».`), c.explanation && h('p', { class: 'muted' }, c.explanation), next(ok)); }
  } else if (c.type === 'cloze') {
    if (ses.picked === null) {
      const input = h('input', { type: 'text', maxlength: 200, 'aria-label': 'Mot manquant', autocomplete: 'off', required: true });
      body.push(h('form', { class: 'row', onsubmit: (e) => { e.preventDefault(); ses.picked = L.checkCloze(c, input.value) ? 1 : 0; ses.shown = true; ctx.rerender(); } }, input, h('button', { class: 'btn btn--primary', type: 'submit' }, 'Vérifier')));
    } else body.push(h('p', { role: 'status' }, ses.picked ? 'Bonne réponse.' : `Faux : la réponse est « ${c.back} ».`), c.explanation && h('p', { class: 'muted' }, c.explanation), next(ses.picked === 1));
  } else if (!ses.shown) {
    body.push(h('button', { class: 'btn btn--primary', onclick: () => { ses.shown = true; ctx.rerender(); } }, 'Révéler la réponse'));
  } else {
    body.push(h('div', { class: 'row between' }, h('p', { class: 'review__a' }, c.back), speakBtn(c.back)), c.hint && h('p', { class: 'muted' }, `Indice : ${c.hint}`), c.explanation && h('p', { class: 'muted' }, c.explanation),
      h('div', { class: 'review__grades' }, [[1, 'À revoir'], [2, 'Moyen'], [3, 'Bien']].map(([g, name]) => h('button', {
        class: `btn btn--grade-${g}`, onclick: () => grade(ctx, c.id, g),
      }, h('span', null, name), h('span', { class: 'muted' }, label(c.mem, g))))));
  }
  return h('div', { class: 'page' }, head, prog, h('div', { class: 'review' }, body));
}

// Raccourcis : Espace = révéler ; 1 / 2 / 3 = à revoir / moyen / bien (cartes à réponse libre).
function bindKeys(ctx) {
  if (keysBound || typeof document === 'undefined') return;
  keysBound = true;
  document.addEventListener('keydown', (e) => {
    const ses = view.session;
    if (!ses || document.querySelector('dialog[open]') || /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
    const c = ctx.store.state.cards.find((x) => x.id === ses.ids[0]);
    if (!c || !L.isFree(c.type)) return;
    if (e.key === ' ' && !ses.shown) { e.preventDefault(); ses.shown = true; ctx.rerender(); }
    else if (ses.shown && ['1', '2', '3'].includes(e.key)) grade(ctx, c.id, Number(e.key));
  });
}
