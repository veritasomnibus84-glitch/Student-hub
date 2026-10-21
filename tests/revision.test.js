import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setupDOM, memory } from './helpers/dom.js';
const win = setupDOM();
const { review, newMemory, label, interval, W } = await import('../js/fsrs.js');
const { parseCards, queue, stats, buildPrompt, newCard } = await import('../js/revision-logic.js');
const { createStore } = await import('../js/store.js');
const { TABS } = await import('../js/app.js');

const click = (el) => el.dispatchEvent(new win.Event('click', { bubbles: true }));

test('FSRS : première note « bien » = stabilité initiale w[2] ; l\'intervalle croît ; « à revoir » baisse la stabilité', () => {
  const m1 = review(newMemory(), 3, 0);
  assert.equal(m1.s, W[2]); assert.equal(m1.state, 'review');
  let m = m1; let last = 0;
  for (let i = 0; i < 4; i++) { m = review(m, 3, Date.parse(m.due)); const iv = interval(m.s); assert.ok(iv > last); last = iv; }
  const f = review(m, 1, Date.parse(m.due));
  assert.ok(f.s < m.s); assert.equal(f.state, 'learning'); assert.equal(f.lapses, 1);
  assert.equal(label(newMemory(), 1), '< 1 min'); assert.equal(label(newMemory(), 2), '15 min');
});

test('parseCards : accepte du JSON entouré de ```, refuse le reste', () => {
  const cards = parseCards('```json\n[{"type":"qa","front":"Q ?","back":"R"},{"type":"mcq","front":"QCM ?","choices":["a","b","c","d"],"correct_index":2},{"front":""},{"type":"tf","front":"Vrai ?","answer":false,"correction":"Non."}]\n```', 'd1');
  assert.equal(cards.length, 3); assert.equal(cards[1].type, 'mcq'); assert.equal(cards[1].back, 'c'); assert.match(cards[2].back, /^Faux/);
  assert.throws(() => parseCards('pas du json', 'd1'), /JSON/);
  assert.throws(() => parseCards('[{"back":"x"}]', 'd1'), /Aucune carte/);
});

test('file de session : dues d\'abord, nouvelles plafonnées ; stats', () => {
  const fresh = Array.from({ length: 25 }, () => newCard({ front: 'n' }));
  const due = newCard({ front: 'd', mem: review(newMemory(), 3, 0) });
  assert.equal(queue([...fresh, due], Date.now()).length, 21);
  assert.equal(queue([...fresh, due], Date.now())[0].id, due.id);
  assert.equal(stats([...fresh, due]).fresh, 25);
  assert.match(buildPrompt({ type: 'mcq', n: 5, course: 'COURS' }), /<source>COURS<\/source>/);
});

test('import de données : une carte invalide ou sans question est écartée, l\'état mémoire est borné', () => {
  const store = createStore(memory());
  store.importFile(JSON.stringify({ app: 'student-hub', kind: 'section', section: 'revision', version: 1, data: { decks: [{ id: 'd1', name: 'L' }], cards: [{ id: 'c1', deckId: 'd1', front: 'Q', back: 'R', mem: { state: 'review', s: -5, due: 'nope' } }, { front: ' ' }] } }));
  assert.equal(store.state.decks.length, 1); assert.equal(store.state.cards.length, 1); assert.equal(store.state.cards[0].mem.state, 'new');
});

test('onglet Révision : liste vide, leçon, révision d\'une carte jusqu\'à la fin', () => {
  const store = createStore(memory());
  const mod = TABS.find(([k]) => k === 'revision')[2];
  const host = document.createElement('div');
  const ctx = { store, data: {}, rerender: () => host.replaceChildren(mod.render(ctx)) };
  store.subscribe(() => ctx.rerender());
  ctx.rerender();
  assert.ok(host.querySelector('h1'));
  store.commit((s) => { s.decks.push({ id: 'd1', name: 'Cinématique', courseId: '', exam: '' }); s.cards.push(newCard({ id: 'c1', deckId: 'd1', front: 'Définition de la vitesse ?', back: 'dx/dt' })); });
  click(host.querySelector('.card__main'));
  assert.ok(host.textContent.includes('Cinématique'));
  click([...host.querySelectorAll('button')].find((b) => b.textContent.includes('Réviser')));
  assert.ok(host.textContent.includes('Définition de la vitesse'));
  click([...host.querySelectorAll('button')].find((b) => b.textContent.includes('Révéler')));
  assert.ok(host.textContent.includes('dx/dt'));
  click([...host.querySelectorAll('.review__grades button')][2]);
  assert.equal(store.state.cards[0].mem.state, 'review');
  assert.ok(host.textContent.includes('à jour'));
});
