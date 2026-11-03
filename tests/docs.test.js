// Garde-fous de la documentation : une documentation qui ment fait échouer les tests.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, dirname, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const read = (p) => readFileSync(join(ROOT, p), 'utf8');
const walk = (dir, ext) => (existsSync(join(ROOT, dir)) ? readdirSync(join(ROOT, dir)).flatMap((n) => {
  const rel = join(dir, n); return statSync(join(ROOT, rel)).isDirectory() ? walk(rel, ext) : (rel.endsWith(ext) ? [rel.split(sep).join('/')] : []);
}) : []);
const norm = (p) => p.split(sep).join('/');

// Les plans décrivent des fichiers futurs et le prompt du tuteur n'est pas de la documentation du code : hors contrôle des chemins.
const EXEMPT = ['docs/plans/', 'docs/fds-tutor.md'];
const docs = ['README.md', ...walk('docs', '.md')];
const checked = docs.filter((d) => !EXEMPT.some((e) => d.startsWith(e)));

// Retire les blocs de code (clôtures ``` en début de ligne) ; une ligne qui n'est pas une clôture n'en ouvre pas.
const stripFences = (text) => { let inside = false; return text.split('\n').filter((l) => { if (/^\s*```/.test(l)) { inside = !inside; return false; } return !inside; }).join('\n'); };
const slug = (heading) => heading.toLowerCase().trim().replace(/[^\p{L}\p{N}\s_-]/gu, '').replace(/\s/g, '-');
const anchorsOf = (text) => new Set([...stripFences(text).matchAll(/^#{1,6}\s+(.*)$/gm)].map((m) => slug(m[1])));

test('documents centraux présents', () => {
  for (const f of ['README.md', 'docs/README.md', 'docs/ARCHITECTURE.md', 'docs/GLOSSAIRE.md', 'docs/CONTRIBUTING.md', 'docs/CHANGELOG.md', 'docs/DEPANNAGE.md', 'docs/features/README.md', 'docs/decisions/README.md', 'docs/SPEC.md', 'docs/plans/plan-taches.md', 'docs/plans/plan-documentation.md']) assert.ok(existsSync(join(ROOT, f)), f);
});

test('liens Markdown : le fichier existe, et l\'ancre aussi', () => {
  const bad = [];
  for (const f of checked) {
    const text = stripFences(read(f));
    for (const m of text.matchAll(/\[[^\]]*\]\(([^)\s]+)\)/g)) {
      const [target, anchor] = m[1].split('#');
      if (/^(https?:|mailto:)/.test(m[1])) continue;
      const file = target ? norm(relative(ROOT, resolve(ROOT, dirname(f), target))) : f;
      if (!existsSync(join(ROOT, file))) { bad.push(`${f} → ${m[1]} (fichier introuvable)`); continue; }
      if (anchor && file.endsWith('.md') && !anchorsOf(read(file)).has(anchor)) bad.push(`${f} → ${m[1]} (ancre introuvable)`);
    }
  }
  assert.deepEqual(bad, []);
});

test('chemins du dépôt cités entre accents graves : ils existent', () => {
  const bad = [];
  const re = /`((?:js|css|tests|scripts|docs|data|assets|icons|vendor|\.github)\/[^`\s]*|index\.html|sw\.js|manifest\.webmanifest|package\.json)`/g;
  for (const f of checked) for (const m of read(f).matchAll(re)) {
    if (/[*<>…{}|]/.test(m[1])) continue; // motifs et exemples
    if (!existsSync(join(ROOT, m[1]))) bad.push(`${f} cite ${m[1]}`);
  }
  assert.deepEqual(bad, []);
});

test('ARCHITECTURE : sections attendues et arborescence complète', () => {
  const a = read('docs/ARCHITECTURE.md');
  for (const h of ['## 1. Vue d\'ensemble', '## 2. Flux de données principaux', '## 3. Stack technique et raisons', '## 4. Modèle de données', '## 5. Arborescence commentée']) assert.ok(a.includes(h), h);
  assert.ok(a.includes('```mermaid'));
  const files = [...walk('js', '.js'), ...walk('css', '.css'), ...walk('scripts', '')].filter((f) => !f.endsWith('.DS_Store'));
  const missing = files.filter((f) => !a.includes(f.split('/').pop()));
  assert.deepEqual(missing, [], 'fichiers absents de l\'arborescence commentée');
});

test('GLOSSAIRE : assez de termes, chacun avec définition et lieu', () => {
  const g = read('docs/GLOSSAIRE.md');
  const rows = g.split('\n').filter((l) => /^\| .+ \| .+ \| .+ \|$/.test(l) && !/^\| ?-+/.test(l) && !l.startsWith('| Terme'));
  assert.ok(rows.length >= 60, `${rows.length} termes`);
  for (const r of rows) { const cells = r.split('|').map((c) => c.trim()).filter(Boolean); assert.ok(cells[1].length > 10 && cells[2], r); }
});

test('fiches de fonctionnalités : gabarit en 11 sections, état, schéma et pseudo-code', () => {
  const TITLES = ['Objectif', 'Périmètre', 'Vue d\'ensemble technique', 'Composants et fichiers concernés', 'Entrées / sorties', 'Fonctionnement détaillé', 'Dépendances', 'Cas limites et erreurs', 'Tests', 'Pièges et dette technique', 'Pour modifier ou étendre'];
  const bad = [];
  for (const f of walk('docs/features', '.md').filter((x) => !x.endsWith('/README.md'))) {
    const t = read(f);
    const found = [...stripFences(t).matchAll(/^## (\d+)\. (.*)$/gm)].map((m) => `${m[1]}. ${m[2].trim()}`);
    const want = TITLES.map((x, i) => `${i + 1}. ${x}`);
    if (JSON.stringify(found) !== JSON.stringify(want)) bad.push(`${f} : sections ${JSON.stringify(found)}`);
    if (!/^\*\*État :\*\* (Implémentée|Partielle|Prévue)/m.test(t)) bad.push(`${f} : ligne « **État :** » manquante`);
    if (!t.includes('```mermaid') && !t.includes('sans schéma')) bad.push(`${f} : aucun schéma Mermaid`);
    if (!t.includes('```text') && !t.includes('sans algorithme')) bad.push(`${f} : aucun pseudo-code`);
  }
  assert.deepEqual(bad, []);
});

test('décisions (ADR) : sections Contexte, Décision, Alternatives rejetées, Conséquences', () => {
  const bad = [];
  for (const f of walk('docs/decisions', '.md').filter((x) => !x.endsWith('/README.md'))) {
    const t = read(f);
    for (const h of ['## Contexte', '## Décision', '## Alternatives rejetées', '## Conséquences']) if (!t.includes(h)) bad.push(`${f} : ${h}`);
  }
  assert.deepEqual(bad, []);
});

// Cliquet de couverture : tout nouveau fichier de js/ doit être cité par une fiche ; la liste de base ne peut que rétrécir.
test('couverture : chaque fichier de js/ est documenté (ou dans la liste de base qui se vide à chaque phase)', () => {
  const baseline = JSON.parse(read('tests/docs-baseline.json'));
  const fiches = walk('docs/features', '.md').filter((x) => !x.endsWith('/README.md')).map(read).join('\n');
  const sources = walk('js', '.js').filter((f) => f !== 'js/tutor-prompt.js');
  const undocumented = sources.filter((f) => !fiches.includes(f));
  const newcomers = undocumented.filter((f) => !baseline.includes(f));
  assert.deepEqual(newcomers, [], 'nouveau fichier non documenté : à citer dans une fiche de docs/features/');
  const stale = baseline.filter((f) => fiches.includes(f) || !existsSync(join(ROOT, f)));
  assert.deepEqual(stale, [], 'à retirer de tests/docs-baseline.json (documenté ou supprimé)');
});
