import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setupDOM, memory } from './helpers/dom.js';
const win = setupDOM();
const { review, newMemory, label, interval, W } = await import('../js/fsrs.js');
const L = await import('../js/revision-logic.js');
const { gapFraction, buildPlan, coverage, gauges, describeTask } = await import('../js/planning.js');
const G = await import('../js/goals-logic.js');
const { createStore } = await import('../js/store.js');
const { TABS } = await import('../js/app.js');
const { newCard, parseCards } = L;

const click = (el) => el.dispatchEvent(new win.Event('click', { bubbles: true }));
const mount = (key, store) => {
  const mod = TABS.find(([k]) => k === key)[2];
  mod.resetView?.();
  const host = document.createElement('div');
  const ctx = { store, data: {}, rerender: () => host.replaceChildren(mod.render(ctx)) };
  store.subscribe(() => ctx.rerender()); ctx.rerender();
  return { host, ctx };
};
const btn = (root, text) => [...root.querySelectorAll('button')].find((b) => b.textContent.includes(text));
const tick = () => new Promise((r) => setTimeout(r, 0));

test('FSRS : stabilité initiale, intervalles croissants, « à revoir » baisse la stabilité', () => {
  const m1 = review(newMemory(), 3, 0);
  assert.equal(m1.s, W[2]); assert.equal(m1.state, 'review');
  let m = m1; let last = 0;
  for (let i = 0; i < 4; i += 1) { m = review(m, 3, Date.parse(m.due)); const iv = interval(m.s); assert.ok(iv > last); last = iv; }
  const f = review(m, 1, Date.parse(m.due));
  assert.ok(f.s < m.s); assert.equal(f.state, 'learning'); assert.equal(f.lapses, 1);
  assert.equal(label(newMemory(), 1), '< 1 min'); assert.equal(label(newMemory(), 2), '15 min');
});

test('parseCards : tous les types du catalogue, JSON entouré de ```', () => {
  const cards = parseCards('```json\n[{"type":"qa","front":"Q ?","back":"R"},{"type":"mcq","front":"QCM ?","choices":["a","b","c","d"],"correct_index":2},{"type":"tf","front":"Vrai ?","answer":false,"correction":"Non."},{"type":"cloze","front":"La ____ est un vecteur","back":"vitesse","accepted":["vitesse instantanée"],"layer":"core"},{"type":"word","front":"Butterfly","back":"Papillon","mediator_hint":"but + fly"},{"front":""}]\n```', 'd1');
  assert.equal(cards.length, 5);
  assert.equal(cards[1].back, 'c'); assert.equal(cards[2].type, 'tf'); assert.equal(cards[2].correct, 1); assert.equal(cards[2].back, 'Faux');
  assert.equal(cards[3].layer, 'core'); assert.deepEqual(cards[3].accepted, ['vitesse instantanée']); assert.equal(cards[4].hint, 'but + fly');
  assert.throws(() => parseCards('pas du json', 'd1'), /JSON/);
  assert.throws(() => parseCards('[{"back":"x"}]', 'd1'), /Aucune carte/);
});

test('import CSV / TSV / Anki : séparateur détecté, guillemets gérés', () => {
  assert.equal(L.parseCSV('Q1;R1\nQ2;R2', 'd', 'def').length, 2);
  assert.equal(L.parseCSV('Q1\tR1\nQ2\tR2', 'd')[1].back, 'R2');
  const c = L.parseCSV('"Pourquoi, alors ?","Parce que ""oui"""', 'd');
  assert.equal(c[0].front, 'Pourquoi, alors ?'); assert.equal(c[0].back, 'Parce que "oui"');
  assert.throws(() => L.parseCSV('seule ligne sans séparateur', 'd'), /Aucune ligne/);
});

test('file de session : dues d\'abord, noyaux avant détails, nouvelles plafonnées ; stats ; série', () => {
  const fresh = Array.from({ length: 25 }, (_, i) => newCard({ front: `n${i}`, layer: i === 24 ? 'core' : 'detail' }));
  const due = newCard({ front: 'd', mem: review(newMemory(), 3, 0) });
  const q = L.queue([...fresh, due], Date.now());
  assert.equal(q.length, 21); assert.equal(q[0].id, due.id); assert.equal(q[1].front, 'n24');
  assert.equal(L.stats([...fresh, due]).fresh, 25);
  assert.equal(L.streak(['2026-10-19', '2026-10-20'], '2026-10-21'), 2); // aujourd'hui pas encore fait : la série tient
  assert.equal(L.streak(['2026-10-18', '2026-10-20'], '2026-10-21'), 1);
  assert.equal(L.streak([], '2026-10-21'), 0);
});

test('à trous : accents, casse et variantes acceptées', () => {
  const c = newCard({ type: 'cloze', front: 'La ____ est un vecteur', back: 'vitesse', accepted: ['vitesse instantanée'] });
  assert.ok(L.checkCloze(c, ' VITESSE ')); assert.ok(L.checkCloze(c, 'Vitesse instantanee')); assert.ok(!L.checkCloze(c, 'force')); assert.ok(!L.checkCloze(c, ''));
});

test('examen : notes automatiques, note sur 20, scores collés par une IA', () => {
  const mcq = newCard({ type: 'mcq', front: 'q', choices: ['a', 'b'], correct: 1 });
  assert.equal(L.autoScore(mcq, { picked: 1 }), 1); assert.equal(L.autoScore(mcq, { picked: 0 }), 0); assert.equal(L.autoScore(newCard({ front: 'q' }), {}), null);
  assert.equal(L.examNote([1, 0.5, 0, 1]), 12.5);
  assert.deepEqual(L.parseScores('[{"score":1},{"score":2},{"score":-1}]', 3), [1, 1, 0]);
  assert.throws(() => L.parseScores('[1]', 2), /exactement 2/);
  const pick = L.pickExam([mcq, newCard({ front: 'x' }), newCard({ type: 'cloze', front: '____', back: 'a' })], { kinds: ['mcq', 'cloze'], n: 5 }, () => 0.5);
  assert.equal(pick.length, 2);
  assert.match(L.correctionPrompt([{ front: 'Q', back: 'R', answer: '' }]), /\(vide\)/);
});

test('planning : écart (catalogue §8), examens blancs, plafond de charge, jauges monotones', () => {
  assert.equal(gapFraction(7), 0.3); assert.equal(gapFraction(30), 0.15); assert.equal(gapFraction(365), 0.075);
  assert.ok(gapFraction(60) < 0.15 && gapFraction(60) > 0.075);
  const cards = Array.from({ length: 40 }, () => newCard({ front: 'q', back: 'a' }));
  const plan = buildPlan({ cards, exam: '2026-11-27', target: 16, today: '2026-10-21', maxMin: 60 });
  assert.equal(plan.D, 37); assert.equal(plan.days.length, 38); assert.equal(plan.cover, 32); assert.equal(plan.uncovered, 0);
  assert.deepEqual(plan.days.filter((d) => d.tasks.some((t) => t.type === 'mock_exam')).map((d) => d.date), ['2026-11-20', '2026-11-25']);
  assert.ok(plan.days.every((d) => d.minutes <= 60 + 30)); // 1er jour : cartographie 25 + rappel 5 en plus
  const newTotal = plan.days.flatMap((d) => d.tasks).filter((t) => t.type === 'new').reduce((a, t) => a + t.n, 0);
  assert.equal(newTotal, 32);
  const tight = buildPlan({ cards, exam: '2026-10-23', target: 20, today: '2026-10-21', maxMin: 30 });
  assert.ok(tight.uncovered > 0);
  assert.ok(coverage(20) > coverage(12)); assert.ok(gauges(20).mastery > gauges(12).mastery); assert.ok(gauges(20).timeSaved < gauges(12).timeSaved);
  assert.equal(buildPlan({ cards, exam: '', today: '2026-10-21' }), null); assert.equal(buildPlan({ cards, exam: '2026-10-01', today: '2026-10-21' }), null);
  assert.equal(describeTask({ type: 'new', n: 1 }), '1 nouvelle carte');
});

test('import : une carte sans question est écartée, l\'état mémoire est borné, TF forcé en Vrai/Faux', () => {
  const store = createStore(memory());
  store.importFile(JSON.stringify({ app: 'student-hub', kind: 'section', section: 'revision', version: 1, data: { decks: [{ id: 'd1', name: 'L', target: 99, format: 'x' }], cards: [{ id: 'c1', deckId: 'd1', front: 'Q', back: 'R', mem: { state: 'review', s: -5, due: 'nope' } }, { front: ' ' }, { id: 'c2', deckId: 'd1', type: 'tf', front: 'V ?', choices: ['x'], correct: 7 }], revDays: ['2026-10-20', 'pas une date'] } }));
  assert.equal(store.state.decks[0].target, 20); assert.equal(store.state.decks[0].format, 'mixed');
  assert.equal(store.state.cards.length, 2); assert.equal(store.state.cards[0].mem.state, 'new');
  assert.deepEqual(store.state.cards[1].choices, ['Vrai', 'Faux']); assert.equal(store.state.cards[1].correct, 1);
  assert.deepEqual(store.state.revDays, ['2026-10-20']);
});

test('onglet Mémorisation : sous-onglets, révision d\'une carte jusqu\'à la fin, série enregistrée', () => {
  const store = createStore(memory());
  const { host } = mount('revision', store);
  assert.ok(host.querySelector('h1'));
  store.commit((s) => { s.decks.push(L.newDeck({ id: 'd1', name: 'Cinématique' })); s.cards.push(newCard({ id: 'c1', deckId: 'd1', front: 'Définition de la vitesse ?', back: 'dx/dt' })); });
  click(host.querySelector('.card__main'));
  for (const name of ['Apprendre', 'Retenir', 'S\'exercer']) assert.ok(btn(host, name), `sous-onglet ${name}`);
  click(btn(host, 'Apprendre')); assert.ok(host.textContent.includes('Source du cours')); assert.ok(host.textContent.includes('date d\'examen'));
  click(btn(host, 'Retenir')); click(btn(host, 'Vue grille')); assert.ok(host.querySelector('.cards--grid'));
  click([...host.querySelectorAll('button')].find((b) => b.textContent === '▶ Réviser'));
  assert.ok(host.textContent.includes('Définition de la vitesse'));
  click(btn(host, 'Révéler')); assert.ok(host.textContent.includes('dx/dt'));
  click([...host.querySelectorAll('.review__grades button')][2]);
  assert.equal(store.state.cards[0].mem.state, 'review'); assert.equal(store.state.revDays.length, 1);
  assert.ok(host.textContent.includes('à jour'));
});

test('onglet Mémorisation : QCM, V/F et trous se corrigent tout seuls en révision', () => {
  const store = createStore(memory());
  store.commit((s) => {
    s.decks.push(L.newDeck({ id: 'd1', name: 'D' }));
    s.cards.push(newCard({ id: 'm', deckId: 'd1', type: 'mcq', front: 'QCM ?', choices: ['a', 'b'], correct: 1, layer: 'core' }),
      newCard({ id: 't', deckId: 'd1', type: 'cloze', front: 'Le ____', back: 'mot', layer: 'pillar' }));
  });
  const { host } = mount('revision', store);
  click(host.querySelector('.card__main')); click(btn(host, 'Retenir'));
  click([...host.querySelectorAll('button')].find((b) => b.textContent === '▶ Réviser'));
  click(btn(host, 'b')); assert.ok(host.textContent.includes('Bonne réponse')); click(btn(host, 'Suivant'));
  assert.equal(store.state.cards[0].mem.state, 'review');
  const input = host.querySelector('input[type="text"]'); input.value = 'faux';
  host.querySelector('form').dispatchEvent(new win.Event('submit', { cancelable: true }));
  assert.ok(host.textContent.includes('Faux')); click(btn(host, 'Suivant'));
  assert.equal(store.state.cards[1].mem.state, 'learning');
});

test('onglet Mémorisation : examen complet, note sur 20, erreurs remises à étudier, historique', async () => {
  const store = createStore(memory());
  store.commit((s) => {
    s.decks.push(L.newDeck({ id: 'd1', name: 'D' }));
    s.cards.push(newCard({ id: 'm1', deckId: 'd1', type: 'mcq', front: 'QCM 1', choices: ['a', 'b'], correct: 0, mem: review(newMemory(), 3, Date.now()) }),
      newCard({ id: 'm2', deckId: 'd1', type: 'mcq', front: 'QCM 2', choices: ['a', 'b'], correct: 0, mem: review(newMemory(), 3, Date.now()) }));
  });
  const { host } = mount('revision', store);
  click(host.querySelector('.card__main')); click(btn(host, 'S\'exercer'));
  click(btn(host, 'Commencer un examen'));
  const dlg = document.querySelector('dialog'); assert.ok(dlg.textContent.includes('Configurer l\'examen'));
  dlg.querySelector('input[type="number"][placeholder="ex. 14"]').value = '10';
  dlg.querySelector('form').dispatchEvent(new win.Event('submit', { cancelable: true })); await tick();
  assert.ok(host.querySelector('.exam__timer')); assert.equal(host.querySelectorAll('.review').length, 2);
  const section = (q) => [...host.querySelectorAll('.review')].find((x) => x.textContent.includes(q)); // l'ordre des questions est mélangé
  click(section('QCM 1').querySelectorAll('button')[0]); // bonne réponse
  click(section('QCM 2').querySelectorAll('button')[1]); // mauvaise
  click(btn(host, 'Terminer l\'examen'));
  assert.ok(host.textContent.includes('10/20')); assert.ok(host.textContent.includes('Tu avais prédit 10/20'));
  assert.equal(store.state.exams.length, 1); assert.equal(store.state.exams[0].score, 10);
  const states = Object.fromEntries(store.state.cards.map((c) => [c.id, c.mem.state]));
  assert.equal(states.m1, 'review'); assert.equal(states.m2, 'new');
  click(btn(host, 'Terminer')); assert.ok(host.textContent.includes('10/20 (prédit 10'));
});

test('Objectifs : échéance en mois ou années, progression, guide pré-rempli une seule fois', () => {
  assert.equal(G.dueDate('2026-01-31', 1, 'months'), '2026-02-28'); assert.equal(G.dueDate('2026-10-21', 2, 'years'), '2028-10-21');
  const g = G.newGoal({ title: 'x', start: '2026-01-01', amount: 6, unit: 'months' });
  assert.equal(g.due, '2026-07-01');
  const p = G.progress(g, '2026-04-02'); assert.ok(p.ratio > 0.49 && p.ratio < 0.51); assert.equal(p.daysLeft, 90);
  const store = createStore(memory());
  assert.equal(store.state.tips.length, G.guideTips().length); assert.ok(store.state.tips.length >= 15);
  const all = G.guideTips().map((t) => `${t.title} ${t.body}`).join(' ');
  for (const word of ['Home', 'Workspace', 'Agenda', 'Focus', 'Mémorisation', 'Bibliothèque', 'Messages', 'Vidéos', 'Notes', 'Liens', 'Objectifs', 'GitHub Pages', 'verrou', 'FSRS']) assert.ok(all.includes(word), `guide : ${word}`);
  const old = G.sanitizeGoals({ tips: [{ id: 'mine', title: 'Mien', body: 'x' }] }); // ancienne sauvegarde sans tipsSeeded
  assert.equal(old.tips.length, G.guideTips().length + 1);
  assert.equal(G.sanitizeGoals({ tipsSeeded: true, tips: [] }).tips.length, 0); // supprimés : ils ne reviennent pas
  assert.equal(G.sanitizeGoals({ goals: [{ start: 'nope' }, { start: '2026-01-01', amount: 999, unit: 'x' }], tipsSeeded: true }).goals[0].amount, 120);
});

test('onglet Objectifs : établir un objectif, ajouter et supprimer un conseil', async () => {
  const store = createStore(memory());
  const { host } = mount('goals', store);
  assert.ok(host.querySelectorAll('.tip').length >= 15);
  click(btn(host, 'Établir un objectif'));
  const dlg = document.querySelector('dialog');
  dlg.querySelector('input[type="text"]').value = 'Valider le S1'; dlg.querySelector('input[type="number"]').value = '4';
  dlg.querySelector('form').dispatchEvent(new win.Event('submit', { cancelable: true })); await tick();
  assert.equal(store.state.goals.length, 1); assert.equal(store.state.goals[0].amount, 4);
  assert.ok(host.textContent.includes('Valider le S1'));
  click(btn(host, 'Ajouter un conseil'));
  const d2 = [...document.querySelectorAll('dialog')].pop();
  d2.querySelector('input[type="text"]').value = 'Dormir'; d2.querySelector('textarea').value = '8 h';
  d2.querySelector('form').dispatchEvent(new win.Event('submit', { cancelable: true })); await tick();
  assert.equal(store.state.tips[0].title, 'Dormir');
  click([...host.querySelectorAll('.tip')][0].querySelector('.btn--danger'));
  assert.ok(!store.state.tips.some((t) => t.title === 'Dormir'));
});
