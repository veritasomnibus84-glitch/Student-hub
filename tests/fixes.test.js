// Défauts connus corrigés : un test par défaut (voir docs/CHANGELOG.md).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setupDOM, memory } from './helpers/dom.js';
const win = setupDOM();
const { createStore, newTodo, newBook, sanitizeState } = await import('../js/store.js');
const L = await import('../js/revision-logic.js');
const F = await import('../js/fsrs.js');
const T = await import('../js/tutor-logic.js');
const S = await import('../js/study-logic.js');
const C = await import('../js/calendar-logic.js');
const { TABS } = await import('../js/app.js');
const { widgetBody } = await import('../js/ui/widgets.js');
const { pickVoices } = await import('../js/modules/learn-ui.js');
const { importFiles } = await import('../js/modules/library.js');

const mount = (key, store, data = {}) => {
  const mod = TABS.find(([k]) => k === key)[2];
  const host = document.createElement('div'); const ctx = { store, data, rerender: () => host.replaceChildren(mod.render(ctx)) }; ctx.rerender();
  store.subscribe(() => ctx.rerender());
  return host;
};

// 1 -------------------------------------------------------------------------------------------------------------
test('1. carte importée sans « last » : la révision ne plante plus', () => {
  const due = new Date(Date.now() - 3600_000).toISOString();
  const s = L.sanitizeRevision({ cards: [{ id: 'c', front: 'Q', back: 'R', mem: { state: 'review', s: 8, d: 5, due, reps: 3, lapses: 0 } }] });
  const m = s.cards[0].mem;
  assert.equal(m.state, 'review');
  assert.ok(!Number.isNaN(Date.parse(m.last)), 'la dernière révision est déduite de l\'échéance');
  assert.ok(Date.parse(m.last) < Date.parse(due));
  assert.doesNotThrow(() => F.review(m, 3));
  assert.doesNotThrow(() => F.review({ ...m, last: '' }, 3), 'même une mémoire sans date ne lève plus RangeError');
  const next = F.review({ ...m, last: '' }, 3);
  assert.ok(Date.parse(next.due) > Date.now());
});

// 2 -------------------------------------------------------------------------------------------------------------
test('2. cartes à trous : toutes les écritures, signe moins et exposants', () => {
  const ok = (back, answer, accepted = []) => L.checkCloze({ back, accepted }, answer);
  assert.ok(ok('π', 'π') && ok('π', 'Π') && ok('ω', 'ω'));
  assert.ok(ok('الماء', 'الماء') && ok('كِتَاب', 'كتاب'), 'l\'arabe, avec ou sans voyelles');
  assert.ok(ok('вода', 'ВОДА'));
  assert.equal(ok('-5', '5'), false, '-5 n\'est pas 5');
  assert.ok(ok('-5', '-5') && ok('-5', '− 5') && ok('-5', '–5'));
  assert.equal(ok('x²', 'x'), false, 'x² n\'est pas x');
  assert.ok(ok('x²', 'x²') && ok('x²', 'X²'));
  assert.equal(ok('x²', 'x³'), false);
  assert.ok(ok('peut-être', 'peut etre') && ok('Mitochondrie', 'mitochondrie.') && ok('éléphant', 'Elephant'), 'comportement d\'avant conservé');
  assert.ok(ok('3,14', '3.14'));
  assert.ok(ok('Δ', 'x', ['δ']) === false && ok('Δ', 'δ'));
  assert.equal(ok('π', ''), false, 'une réponse vide n\'est jamais acceptée');
  assert.equal(L.norm('  A-B  '), 'a b');
});

// 3 -------------------------------------------------------------------------------------------------------------
test('3. le compteur « à réviser » est ce que la séance sert', () => {
  const past = new Date(Date.now() - 86400_000).toISOString();
  const mk = (n, mem) => Array.from({ length: n }, (_, i) => L.newCard({ id: `${mem.state}${i}`, front: `Q${i}`, mem: { ...F.newMemory(), ...mem } }));
  const cards = [...mk(50, {}), ...mk(3, { state: 'review', s: 5, d: 5, due: past, last: past }), ...mk(2, { state: 'review', s: 5, d: 5, due: new Date(Date.now() + 9e8).toISOString(), last: past })];
  assert.equal(L.stats(cards).due, 23, '3 échues + 20 nouvelles');
  assert.equal(L.stats(cards).due, L.queue(cards).length);
  assert.equal(L.stats(cards, Date.now(), 5).due, 8);
  assert.equal(L.stats(cards, Date.now(), 5).due, L.queue(cards, Date.now(), 5).length);
  assert.equal(L.stats(cards, Date.now(), 0).due, 3);
  assert.equal(L.stats(cards).fresh, 50, '« à étudier » compte toujours toutes les nouvelles cartes');
  assert.equal(L.stats(mk(4, {})).due, 4);
});

test('3b. écran Mémorisation et widget : même compte que la séance', () => {
  const store = createStore(memory());
  store.commit((s) => { for (let i = 0; i < 30; i += 1) s.cards.push(L.newCard({ id: `n${i}`, front: `Q${i}` })); s.settings.memo.newPerDay = 7; });
  const w = widgetBody({ store, data: {}, rerender() {} }, 'memory');
  assert.ok(w.textContent.includes('7 cartes à réviser'), w.textContent);
  assert.ok(mount('revision', store).textContent.includes('7 cartes à réviser'));
});

// 4 -------------------------------------------------------------------------------------------------------------
const logOf = (p = {}) => ({ topic: 'Dérivées', level: 'novice', mastered: ['limites'], weak: ['Chaîne'], recall: [], next: '', gap: '', ...p });
const tutorState = () => ({ decks: [{ id: 'd', weak: [], mastered: [], level: '' }], gaps: [], tutorLogs: [], xp: { total: 0, days: {} } });

test('4. tutor : le même bilan collé deux fois ne redonne ni XP ni blocage', () => {
  const st = tutorState();
  const first = T.applySessionLog(st, 'd', logOf(), '2026-11-02');
  assert.equal(first.xp, 20); assert.equal(first.added, 1);
  const second = T.applySessionLog(st, 'd', logOf(), '2026-11-02');
  assert.deepEqual([second.xp, second.added, second.duplicate], [0, 0, true]);
  assert.equal(st.xp.total, 20); assert.equal(st.tutorLogs.length, 1); assert.equal(st.gaps.length, 1);
  T.applySessionLog(st, 'd', logOf({ topic: 'Autre séance' }), '2026-11-03');
  assert.equal(st.tutorLogs.length, 2, 'un bilan différent est enregistré');
});

test('4b. tutor : deux notions qui ne diffèrent que par la casse ou les accents ne créent qu\'un blocage', () => {
  const st = tutorState();
  const r = T.applySessionLog(st, 'd', logOf({ weak: ['Dérivée', 'dérivée', 'DERIVEE', 'Primitive'] }), '2026-11-02');
  assert.equal(r.added, 2);
  assert.deepEqual(st.gaps.map((g) => g.topic), ['Dérivée', 'Primitive']);
  const again = T.applySessionLog(st, 'd', logOf({ topic: 'Plus tard', weak: ['derivee'] }), '2026-11-03');
  assert.equal(again.added, 0);
});

test('4c. onglet Tuteur : un bilan déjà enregistré est signalé', async () => {
  const store = createStore(memory());
  store.commit((s) => { s.decks.push(L.newDeck({ id: 'd', name: 'Physique' })); });
  const host = mount('revision', store);
  const click = (el) => el.dispatchEvent(new win.Event('click', { bubbles: true }));
  const btn = (t) => [...host.querySelectorAll('button')].find((b) => b.textContent === t);
  click(host.querySelector('.card__main')); click(btn('Tuteur'));
  const bilan = '```session_log\n{"topic":"Cinématique","level":"novice","mastered":["vitesse"],"weak":["accélération"],"recall_questions":[],"next_step":"","confidence_gap":""}\n```';
  for (let i = 0; i < 2; i += 1) {
    const area = host.querySelector('textarea[aria-label="Réponse du tuteur"]');
    area.value = bilan; area.dispatchEvent(new win.Event('input', { bubbles: true }));
    click(btn('Enregistrer la session'));
  }
  assert.ok(host.querySelector('[data-tutor-msg]').textContent.includes('déjà enregistré'));
  assert.equal(store.state.tutorLogs.length, 1);
  assert.equal(store.state.xp.total, 20);
});

// 5 -------------------------------------------------------------------------------------------------------------
test('5a. fiche : le niveau de la leçon est transmis au prompt', () => {
  assert.ok(S.sheetPrompt({ style: 'full', level: 'advanced', source: 'x' }).includes(S.LEVEL_TEXT.advanced));
  assert.ok(S.sheetPrompt({ style: 'simple', level: 'novice', source: 'x' }).includes('un étudiant débutant'));
  assert.ok(!S.sheetPrompt({ style: 'full', level: '', source: 'x' }).includes('Adapte le vocabulaire'), 'sans niveau, aucune consigne ajoutée');
  assert.ok(S.sheetPrompt({ style: 'simple', source: 'x' }).includes('un étudiant débutant'), 'comportement d\'avant sans niveau');
});

test('5b. podcast : la voix suit la langue choisie, pas le français seul', () => {
  const voices = [{ lang: 'fr-FR' }, { lang: 'en-US' }, { lang: 'en_GB' }, { lang: 'ar-SA' }, { lang: 'fr-CA' }, { lang: undefined }];
  assert.deepEqual(pickVoices(voices, 'fr-FR').map((v) => v.lang), ['fr-FR', 'fr-CA']);
  assert.deepEqual(pickVoices(voices, 'en-US').map((v) => v.lang), ['en-US', 'en_GB']);
  assert.deepEqual(pickVoices(voices, 'ar-SA').map((v) => v.lang), ['ar-SA']);
  assert.deepEqual(pickVoices(voices, 'de-DE'), []);
});

test('5c. cartographie : le noyau de chaque pilier et le pilier de chaque détail sont conservés', () => {
  const r = S.parseLayers(JSON.stringify({
    cores: [{ id: 'c1', text: 'A' }, { id: 'c2', text: 'B' }],
    pillars: [{ id: 'p1', core_id: 'c2', text: 'P1' }, { id: 'p2', core_id: 'c1', text: 'P2' }, { id: 'p3', core_id: 'inconnu', text: 'P3' }],
    details: [{ id: 'd1', pillar_id: 'p2', text: 'D1' }, { id: 'd2', text: 'D2' }],
  }));
  assert.deepEqual(r.layers.parents, { pillar: [1, 0, -1], detail: [1, -1] });
  const back = L.sanitizeRevision({ decks: [{ id: 'd', name: 'L', layers: r.layers }] }).decks[0].layers;
  assert.deepEqual(back.parents, r.layers.parents, 'la hiérarchie survit à l\'enregistrement');
  const bad = L.sanitizeRevision({ decks: [{ id: 'd', name: 'L', layers: { core: ['A'], pillar: ['P', 'Q'], detail: [], parents: { pillar: [5, 'x'], detail: [3] } } }] }).decks[0].layers;
  assert.deepEqual(bad.parents, { pillar: [-1, -1], detail: [] }, 'indices hors limites ou invalides : -1, alignés sur la liste');
  assert.deepEqual(L.sanitizeRevision({ decks: [{ id: 'd', name: 'L', layers: { core: ['A'], pillar: ['P'] } }] }).decks[0].layers.parents.pillar, [-1], 'anciennes données sans parents');
});

test('5d. onglet Apprendre : « sous : … » est affiché sous un pilier', () => {
  const store = createStore(memory());
  store.commit((s) => { s.decks.push(L.newDeck({ id: 'd', name: 'Physique', layers: { core: ['Conservation de l\'énergie'], pillar: ['Énergie cinétique'], detail: [], parents: { pillar: [0], detail: [] } } })); });
  const host = mount('revision', store);
  const click = (el) => el.dispatchEvent(new win.Event('click', { bubbles: true }));
  const row = host.querySelector('.card__main'); if (row) click(row); // la vue garde la leçon ouverte d'un test à l'autre
  const learn = [...host.querySelectorAll('button')].find((b) => b.textContent === 'Apprendre'); if (learn) click(learn);
  assert.ok(host.textContent.includes('Énergie cinétique — sous : Conservation de l\'énergie'));
});

// 6 -------------------------------------------------------------------------------------------------------------
test('6. étiquette « Examen » seulement pour un examen', () => {
  assert.equal(C.itemLabel({ kind: 'exam' }), 'Examen');
  assert.equal(C.itemLabel({ kind: 'todo' }), 'À rendre');
  assert.equal(C.itemLabel({ kind: 'event', allDay: true }), 'Journée');
  assert.equal(C.itemLabel({ kind: 'event', allDay: false, start: '09:00', end: '10:30' }), '09:00–10:30');
  assert.equal(C.itemLabel({ kind: 'slot', start: '14:00', end: '15:00' }), '14:00–15:00', 'plage de travail');
  assert.equal(C.itemLabel({ kind: 'focus', start: '16:00', end: '16:25' }), '16:00–16:25', 'session Focus planifiée');
  assert.equal(C.itemLabel({ kind: 'study', allDay: true }), 'Révision');
  assert.notEqual(C.itemLabel({ kind: 'slot', start: '', end: '' }), 'Examen');
});

test('6b. Agenda : une plage de travail et une session Focus n\'affichent pas « Examen »', () => {
  const store = createStore(memory());
  const d = C.ymd(new Date());
  store.commit((s) => {
    s.todos.push(newTodo({ id: 't', name: 'Série 4', slots: [{ id: 's1', date: d, start: '14:00', end: '15:00', done: false }] }));
    s.focusPlans.push({ id: 'f', date: d, start: '16:00', minutes: 25, todoId: '', eventId: '', title: 'Réviser' });
  });
  location.hash = '#calendar';
  const host = mount('calendar', store);
  const labels = [...host.querySelectorAll('.ev__t')].map((e) => e.textContent);
  assert.ok(!labels.includes('Examen'), labels.join(','));
});

// 7 -------------------------------------------------------------------------------------------------------------
test('7. le lien « Fichier » d\'un to-do est affiché sur sa carte (http et https seulement)', () => {
  const store = createStore(memory());
  store.commit((s) => {
    s.todos.push(newTodo({ id: 'a', name: 'Avec lien', file: 'https://exemple.org/tp3.pdf' }), newTodo({ id: 'b', name: 'Sans lien' }),
      newTodo({ id: 'c', name: 'Lien dangereux', file: 'javascript:alert(1)' }));
  });
  const host = mount('workspace', store);
  const links = [...host.querySelectorAll('a.card__file')];
  assert.equal(links.length, 1);
  assert.equal(links[0].getAttribute('href'), 'https://exemple.org/tp3.pdf');
  assert.equal(links[0].getAttribute('rel'), 'noopener noreferrer');
  assert.equal(links[0].getAttribute('target'), '_blank');
  assert.ok(links[0].getAttribute('aria-label').includes('Avec lien'));
});

// 8 -------------------------------------------------------------------------------------------------------------
test('8. Messages : le widget compte aussi les résumés importés à la main', () => {
  const store = createStore(memory());
  const file = [{ id: 'f1', source: 'email', date: '2026-10-01', title: 'A' }];
  const w = () => widgetBody({ store, data: { summaries: file }, rerender() {} }, 'messages').textContent;
  assert.equal(w(), '1 non lu');
  store.commit((s) => { s.localSummaries.push({ id: 'l1', source: 'email', date: '2026-10-02', title: 'Importé' }, { id: 'f1', source: 'email', date: '2026-10-01', title: 'A' }); });
  assert.equal(w(), '2 non lus', 'sans doublon d\'identifiant');
  store.commit((s) => { s.read.push('l1', 'f1'); });
  assert.equal(w(), 'Aucun message non lu');
});

test('8b. Messages vide : le texte ne demande plus de commiter dans le dépôt public (décision 018)', () => {
  const host = mount('messages', createStore(memory()), { summaries: [] });
  assert.ok(host.textContent.includes('Aucun résumé.'));
  assert.ok(!host.textContent.includes('summaries.json'));
  assert.ok(host.textContent.includes('Données') && host.textContent.includes('cet appareil'));
});

// 9 -------------------------------------------------------------------------------------------------------------
test('9. Focus : le délai affiché est celui des Paramètres', () => {
  const store = createStore(memory());
  store.commit((s) => { s.settings.focus.grace = 45; s.focusRun = { id: 'r', start: Date.now() - 1000, planned: 25, tagId: '', title: 'Maths', todoId: '', eventId: '', planId: '', lastSeen: Date.now(), hiddenAt: null }; });
  location.hash = '#focus';
  const host = mount('focus', store);
  const text = host.textContent;
  assert.ok(text.includes('plus de 45 secondes'), text.slice(0, 300));
  assert.ok(!text.includes('plus de 10 secondes'));
  store.commit((s) => { s.settings.focus.grace = 10; });
  assert.ok(host.textContent.includes('plus de 10 secondes'));
});

// 10 ------------------------------------------------------------------------------------------------------------
test('10. Biblio : « Charger le fichier » relie le PDF choisi au livre cliqué', async () => {
  const store = createStore(memory());
  const book = newBook({ id: 'b1', name: 'schaum.pdf', title: 'Schaum Algèbre', author: 'S.', size: 1000, pages: 0, fingerprint: 'schaum.pdf|1000' });
  const other = newBook({ id: 'b2', name: 'autre.pdf', title: 'Autre livre', size: 5, pages: 3, fingerprint: 'autre.pdf|5' });
  store.commit((s) => { s.library.push(book, other); });
  const saved = [];
  const io = { readMeta: async () => ({ title: 'Titre lu dans le PDF', author: 'X', pages: 321, cover: 'data:image/png;base64,AAAA' }), putFile: async (id) => saved.push(['file', id]), putCover: async (id) => saved.push(['cover', id]) };
  const pdf = new win.File(['%PDF'], 'Nom-different.pdf', { type: 'application/pdf' });
  await importFiles({ store }, [pdf], store.state.library[0], io);
  assert.equal(store.state.library.length, 2, 'aucun nouveau livre n\'est créé');
  assert.deepEqual(saved, [['file', 'b1'], ['cover', 'b1']], 'le fichier est enregistré sous l\'identifiant du livre cliqué');
  const b = store.state.library[0];
  assert.deepEqual([b.title, b.pages, b.fingerprint], ['Schaum Algèbre', 321, `Nom-different.pdf|${pdf.size}`], 'le titre choisi par l\'utilisateur est gardé ; pages et empreinte mises à jour');
  assert.equal(store.state.library[1].fingerprint, 'autre.pdf|5');
  // sans livre cliqué (import normal) : un nouveau livre est créé comme avant
  await importFiles({ store }, [new win.File(['%PDF2'], 'nouveau.pdf', { type: 'application/pdf' })], null, io);
  assert.equal(store.state.library.length, 3);
});

test('sanitizeState accepte tout cela ensemble (anciennes données comprises)', () => {
  const s = sanitizeState({ cards: [{ id: 'c', front: 'Q', mem: { state: 'review', s: 3, d: 4, due: '2026-12-01T00:00:00.000Z' } }], decks: [{ id: 'd', name: 'L', layers: { core: ['x'] } }] });
  assert.ok(s.cards[0].mem.last && s.decks[0].layers.parents);
});
