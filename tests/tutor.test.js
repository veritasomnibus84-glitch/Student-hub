import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { setupDOM, memory } from './helpers/dom.js';
const win = setupDOM();
const T = await import('../js/tutor-logic.js');
const S = await import('../js/study-logic.js');
const X = await import('../js/xp-logic.js');
const L = await import('../js/revision-logic.js');
const PROMPT = (await import('../js/tutor-prompt.js')).default;
const { createStore } = await import('../js/store.js');
const { TABS } = await import('../js/app.js');

const click = (el) => el.dispatchEvent(new win.Event('click', { bubbles: true }));
const btn = (root, text) => [...root.querySelectorAll('button')].find((b) => b.textContent.includes(text));
const mount = (key, store) => {
  const mod = TABS.find(([k]) => k === key)[2]; mod.resetView?.();
  const host = document.createElement('div'); document.body.append(host);
  const ctx = { store, data: {}, rerender: () => host.replaceChildren(mod.render(ctx)) };
  store.subscribe(() => ctx.rerender()); ctx.rerender(); return { host, ctx };
};
const LOG = '```session_log\n{"topic":"Moments de force","level":"intermediate","mastered":["Définition du moment"],"weak":["Signe du moment","Équilibre statique"],"recall_questions":["Que vaut la somme des moments à l\'équilibre ?"],"next_step":"Refaire un exercice d\'équilibre","confidence_gap":"Confiance 5/5, résultat faux sur le signe"}\n```';

test('prompt du tuteur : fichier généré = docs/fds-tutor.md ; version envoyée sans en-tête ni notes de maintenance', () => {
  assert.equal(PROMPT, readFileSync(new URL('../docs/fds-tutor.md', import.meta.url), 'utf8'));
  const p = T.systemPrompt();
  assert.ok(p.startsWith('# Prompt Système')); assert.ok(p.includes('[DARACE]') && p.includes('session_log') && p.includes('plan_session'));
  assert.ok(!p.includes('Notes de conception') && !p.includes('name: fds-tutor') && !p.includes('[[Process-validation'));
  assert.ok(p.includes('## 7. Règles absolues'));
});

test('contexte du tuteur : profil, plan (faiblesses puis noyaux), sources, rappels, source trop longue', () => {
  const deck = L.newDeck({ id: 'd', name: 'Physique', source: 'Le moment de force vaut r x F.', level: 'novice', weak: ['Signe du moment'], mastered: ['Vecteur'], format: 'essay', solutions: 'Exo 1 : 12 N.m', layers: { core: ['Somme des moments nulle'], pillar: ['Bras de levier'], detail: [] } });
  const logs = [{ deckId: 'd', date: '2026-10-20T10:00:00Z', recall: ['Q1', 'Q2', 'Q3', 'Q4'] }, { deckId: 'autre', date: '2026-10-21T10:00:00Z', recall: ['Autre'] }];
  const c = T.buildContext({ deck, cards: [], gaps: [{ deckId: 'd', topic: 'Bras de levier' }], logs, mode: 'deep', topic: 'Je bloque' });
  for (const part of ['<profil_etudiant>', 'niveau: novice', 'notions_faibles: Signe du moment', 'blocages: Bras de levier', 'mode: deep', 'minutes: 60', '1. [pilier] Signe du moment', '2. [noyau] Somme des moments nulle', 'format_examen: essai', '- Q1', '- Q3', '<sources>', 'r x F', '<solution_reference>', 'mode_app: true', 'Je bloque']) assert.ok(c.text.includes(part), part);
  assert.ok(!c.text.includes('- Q4') && !c.text.includes('Autre'));
  const empty = T.buildContext({ deck: L.newDeck({ id: 'e', name: 'Vide' }), cards: [] });
  assert.ok(empty.text.includes('(aucune : demande') && !empty.text.includes('<sources>') && !empty.text.includes('<solution_reference>'));
  const big = T.buildContext({ deck: L.newDeck({ source: `${'mot '.repeat(3000)}\n\n${'fin '.repeat(3000)}` }), cards: [] });
  assert.ok(big.truncated && big.sourceChars > T.MAX_SOURCE && big.text.length < T.MAX_SOURCE + 2000);
});

test('priorités : couches des cartes quand la leçon n\'a pas de cartographie', () => {
  const deck = L.newDeck({ id: 'd' });
  const cards = [L.newCard({ front: 'détail', layer: 'detail' }), L.newCard({ front: 'noyau', layer: 'core' }), L.newCard({ front: 'pilier', layer: 'pillar' })];
  assert.deepEqual(T.priorities(deck, cards).map((p) => p.layer), ['core', 'pillar', 'detail']);
});

test('session_log : avec ou sans clôture ```, marqueur [DARACE], erreurs claires', () => {
  const a = T.parseSessionLog(`Bonne session. Reviens quand tu veux. [DARACE]\n${LOG}`);
  assert.equal(a.topic, 'Moments de force'); assert.equal(a.level, 'intermediate'); assert.deepEqual(a.weak, ['Signe du moment', 'Équilibre statique']); assert.equal(a.recall.length, 1);
  const b = T.parseSessionLog('Fin [DARACE] session_log {"topic":"X","level":"expert","mastered":"pas une liste","weak":[1,"ok"]}');
  assert.equal(b.level, ''); assert.deepEqual(b.mastered, []); assert.deepEqual(b.weak, ['ok']);
  assert.throws(() => T.parseSessionLog('Pas de bilan ici [DARACE]'), /Aucun bloc session_log/);
  assert.throws(() => T.parseSessionLog('```session_log\n{pas du json}\n```'), /illisible/);
});

test('session enregistrée : niveau, maîtrisé / faible sans doublon, blocages, historique, XP', () => {
  const store = createStore(memory());
  store.commit((s) => { s.decks.push(L.newDeck({ id: 'd', name: 'Physique', weak: ['Définition du moment'], mastered: ['Signe du moment'] })); });
  let res; store.commit((s) => { res = T.applySessionLog(s, 'd', T.parseSessionLog(LOG), '2026-10-22'); });
  const d = store.state.decks[0];
  assert.equal(d.level, 'intermediate');
  assert.deepEqual(d.mastered, ['Définition du moment']); // sorti des faiblesses
  assert.deepEqual(d.weak, ['Signe du moment', 'Équilibre statique']); // sorti des maîtrisées
  assert.equal(res.added, 2); assert.equal(store.state.gaps.length, 2); assert.equal(store.state.tutorLogs.length, 1);
  assert.equal(res.xp, X.XP.tutor); assert.equal(store.state.xp.total, X.XP.tutor);
  store.commit((s) => { T.applySessionLog(s, 'd', T.parseSessionLog(LOG), '2026-10-22'); });
  assert.equal(store.state.gaps.length, 2); // pas de doublon dans le journal
  assert.throws(() => T.applySessionLog(store.state, 'nope', T.parseSessionLog(LOG), '2026-10-22'), /introuvable/);
});

test('XP : niveaux croissants, plafond quotidien, données bornées', () => {
  assert.equal(X.levelOf(0), 1); assert.equal(X.levelOf(49), 1); assert.equal(X.levelOf(50), 2); assert.equal(X.levelOf(200), 3);
  const p = X.progressOf(125); assert.equal(p.level, 2); assert.equal(p.need, 150); assert.equal(p.into, 75); assert.equal(p.ratio, 0.5);
  const st = { xp: X.defaultXp() };
  assert.equal(X.award(st, 250, '2026-10-22'), 250); assert.equal(X.award(st, 100, '2026-10-22'), 50); assert.equal(X.award(st, 10, '2026-10-22'), 0);
  assert.equal(X.award(st, 10, '2026-10-23'), 10); assert.equal(st.xp.total, 310);
  const clean = X.sanitizeXp({ xp: { total: -5, days: { '2026-10-22': 99999, nope: 3 } } }).xp;
  assert.equal(clean.total, 0); assert.deepEqual(clean.days, { '2026-10-22': X.DAILY_CAP });
  assert.equal(X.XP.exam(15), 18); assert.deepEqual(X.sanitizeXp({}).xp, { total: 0, days: {} });
});

test('fiches : 4 styles x 4 longueurs, source et consignes présentes', () => {
  for (const [style] of S.STYLES) for (const [length] of S.LENGTHS) {
    const p = S.sheetPrompt({ style, length, source: 'SOURCE-X' });
    assert.ok(p.includes('<source>SOURCE-X</source>') && p.includes('UNIQUEMENT à partir du contenu'), `${style}/${length}`);
    assert.ok(!p.includes('"layer"'), 'pas de consigne de couche dans une fiche');
  }
  assert.ok(S.sheetPrompt({ style: 'exam', length: 'cheat' }).includes('Pièges et confusions'));
  assert.ok(S.sheetPrompt({ style: 'simple', length: 'short', level: 'un lycéen' }).includes('un lycéen') && S.sheetPrompt({ style: 'simple', length: 'short' }).includes('MAPPING'));
  assert.ok(S.sheetPrompt({ style: 'memo', length: 'medium' }).includes('Ma version'));
  assert.ok(S.sheetPrompt({ style: 'full', length: 'long' }).includes('1600'));
  assert.deepEqual(S.sheetBlocks('# Titre\n- point **clé**\n1. deux\ntexte'), [{ t: 'h', level: 1, text: 'Titre' }, { t: 'li', text: 'point **clé**' }, { t: 'li', text: 'deux' }, { t: 'p', text: 'texte' }]);
});

test('podcast : répliques, voix, pauses ; couches : JSON de l\'IA', () => {
  const seg = S.parsePodcast('HÔTE: Bonjour ! [PAUSE 3s]\nEXPERTE: Voici l\'idée.\nsuite de la réplique\n[PAUSE 30s]\nHote: Merci.');
  assert.deepEqual(seg.map((x) => x.pause ?? `${x.who}:${x.text}`), ['host:Bonjour !', 3000, 'expert:Voici l\'idée.', 'expert:suite de la réplique', 10000, 'host:Merci.']);
  assert.ok(S.podcastPrompt({ minutes: 5, source: 'S' }).includes('5 minutes') && S.podcastPrompt({ source: 'S' }).includes('PAUSE 3s'));
  const r = S.parseLayers('```json\n{"cores":[{"id":"c1","text":"Idée 1"},"Idée 2"],"pillars":[{"id":"p1","core_id":"c1","text":"Pilier"}],"details":[{"text":"Détail"}],"two_minute_summary":"Résumé","recall_questions":[{"core_id":"c1","q":"Pourquoi ?","a":"Parce que"},{"q":""}]}\n```');
  assert.deepEqual(r.layers, { core: ['Idée 1', 'Idée 2'], pillar: ['Pilier'], detail: ['Détail'], parents: { pillar: [0], detail: [-1] } }); // le pilier garde son noyau (core_id) assert.equal(r.summary, 'Résumé'); assert.equal(r.recall.length, 1);
  assert.throws(() => S.parseLayers('{"pillars":[]}'), /noyau/); assert.throws(() => S.parseLayers('nope'), /JSON/);
  assert.ok(S.layersPrompt({ source: 'S' }).includes('NOYAUX (3 à 5 maximum)'));
});

test('données de leçon : champs du tuteur et des fiches bornés à l\'import', () => {
  const r = L.sanitizeRevision({ decks: [{ id: 'd', name: 'L', level: 'dieu', weak: ['a', 'a', 5, ' b '], mastered: 'x', layers: { core: ['n'], pillar: 'x' }, sheet: { style: 'inconnu', length: 'long', text: 't' }, recall: [{ q: 'q', a: 'a' }, { q: '' }] }], tutorLogs: [{ deckId: 'd', date: '2026-10-22T10:00:00Z', topic: 'T', level: 'novice', weak: ['w'] }, 'x'] });
  const d = r.decks[0];
  assert.equal(d.level, ''); assert.deepEqual(d.weak, ['a', 'b']); assert.deepEqual(d.mastered, []); assert.deepEqual(d.layers, { core: ['n'], pillar: [], detail: [], parents: { pillar: [], detail: [] } });
  assert.deepEqual(d.sheet, { style: 'full', length: 'long', text: 't' }); assert.equal(d.recall.length, 1); assert.equal(r.tutorLogs.length, 1);
});

test('onglet Tuteur : prépare la session, enregistre le bilan collé, met à jour profil et XP', () => {
  const store = createStore(memory());
  store.commit((s) => { s.decks.push(L.newDeck({ id: 'd', name: 'Physique' })); });
  const { host } = mount('revision', store);
  click(host.querySelector('.card__main')); click(btn(host, 'Tuteur'));
  assert.ok(host.textContent.includes('Colle d\'abord le texte de ton cours'));
  assert.ok(btn(host, '1. Copier le prompt du tuteur') && btn(host, '2. Copier le contexte'));
  click(btn(host, 'Enregistrer la session')); assert.ok(host.querySelector('[data-tutor-msg]').textContent.includes('Aucun bloc session_log'));
  host.querySelector('textarea[aria-label="Réponse du tuteur"]').dispatchEvent(Object.assign(new win.Event('input', { bubbles: true })));
  const area = host.querySelector('textarea[aria-label="Réponse du tuteur"]'); area.value = `Bonne session. [DARACE]\n${LOG}`; area.dispatchEvent(new win.Event('input', { bubbles: true }));
  click(btn(host, 'Enregistrer la session'));
  assert.equal(store.state.tutorLogs.length, 1); assert.equal(store.state.decks[0].level, 'intermediate'); assert.equal(store.state.xp.total, X.XP.tutor);
  assert.ok(host.querySelector('[data-tutor-msg]').textContent.includes('Session enregistrée : 1 maîtrisée(s), 2 à retravailler, 2 ajoutée(s) au journal des blocages, +20 XP.'));
  assert.equal(host.querySelector('textarea[aria-label="Réponse du tuteur"]').value, '');
  assert.ok(host.textContent.includes('Moments de force') && host.textContent.includes('Refaire un exercice'));
});

test('onglet Apprendre : couches, fiche et podcast collés puis affichés ; cartes de rappel créées', () => {
  const store = createStore(memory());
  store.commit((s) => { s.decks.push(L.newDeck({ id: 'd', name: 'Physique', source: 'Cours' })); });
  const { host } = mount('revision', store);
  click(host.querySelector('.card__main')); click(btn(host, 'Apprendre'));
  for (const title of ['Cartographie en couches', 'Fiche', 'Podcast', 'Source du cours', 'Corrigés validés']) assert.ok(host.textContent.includes(title), title);
  const fill = (label, value) => { const el = host.querySelector(`textarea[aria-label="${label}"]`); el.value = value; };
  fill('JSON des couches', '{"cores":["Idée A"],"pillars":["Pilier A"],"details":[],"two_minute_summary":"R","recall_questions":[{"q":"Pourquoi A ?","a":"Parce que"}]}');
  click(btn(host, 'Enregistrer la cartographie'));
  assert.deepEqual(store.state.decks[0].layers.core, ['Idée A']); assert.ok(host.textContent.includes('Idée A'));
  click(btn(host, 'En faire des cartes')); assert.equal(store.state.cards.length, 1); assert.equal(store.state.cards[0].layer, 'core');
  click(btn(host, 'En faire des cartes')); assert.equal(store.state.cards.length, 1, 'pas de doublon');
  fill('Fiche', '# Moments\n- **Définition** : r x F'); click(btn(host, 'Enregistrer la fiche'));
  assert.ok(host.querySelector('.sheet h3') && host.querySelector('.sheet strong').textContent === 'Définition');
  fill('Script du podcast', 'HÔTE: Salut\nEXPERTE: Bonjour'); click(btn(host, 'Enregistrer le script'));
  assert.ok(host.textContent.includes('n\'est pas disponible') && host.textContent.includes('2 répliques'));
  const before = store.state.decks[0].podcast; assert.ok(before.includes('EXPERTE'));
});
