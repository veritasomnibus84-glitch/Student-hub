# Contribuer à Student Hub

Conventions de code, tests, workflow Git et publication. Lire d'abord [ARCHITECTURE](ARCHITECTURE.md).

## 1. Mise en place

```text
git clone <dépôt>  &&  cd student-hub
npm install                          # jsdom pour les tests (seule dépendance de développement)
npm test                             # tests node : doivent tous passer
python3 -m http.server 8080          # puis http://localhost:8080 (les modules ES ne marchent pas en ouvrant index.html directement)
```

Construire ou étendre le projet avec des agents : `npx skills add addyosmani/agent-skills` dans OpenCode ou Claude Code, puis `/spec`, `/plan`, `/build` (voir [SPEC.md](SPEC.md) et le [plan des tâches](plans/plan-taches.md)).

Tests dans un vrai navigateur (facultatif) : `pip install playwright && playwright install chromium`, puis, **le serveur étant lancé** (`python3 -m http.server 8765`), `python3 tests/e2e/<nom>.e2e.py`.

## 2. Conventions de code

- **Modules ES**, indentation de 2 espaces, guillemets simples, points-virgules, virgules finales dans les listes sur plusieurs lignes.
- **Textes, commentaires et messages en français** (tutoiement dans l'interface) ; noms de fonctions et de champs en anglais (`occurrenceOn`, `focusPlans`).
- **Logique pure d'abord** : toute règle métier va dans un `js/*-logic.js` (ou un module sans DOM) et se teste sans navigateur. Les fichiers de `js/modules/` et `js/ui/` dessinent et appellent la logique.
- **Aucun `innerHTML`** : le DOM se construit avec `h(tag, props, ...enfants)` (`js/dom.js`). Pas de style en ligne : on pose une position avec `element.style.top = …` (autorisé par la CSP), jamais avec un attribut `style`.
- **Modifier l'état uniquement dans `store.commit((s) => { … })`**. Si la vue dépend d'un état local (onglet choisi, message), **pose-le avant le `commit`** : c'est le `commit` qui redessine.
- **Tout ce qui entre est validé** : état chargé, import, cloud, réponse d'IA, fichier `.ics`. Un validateur borne les longueurs et écarte l'invalide.
- **Dates locales** : `ymd(date)` pour `AAAA-MM-JJ`, jamais `toISOString()` pour un jour calendaire. Identifiants : `uid()` (`js/store.js`).
- **Pas de dépendance d'exécution** : une bibliothèque se copie dans `vendor/` ([ADR-005](decisions/005-pdfjs-dans-vendor.md)) et se justifie dans une décision.

### Ajouter un onglet

```text
1. créer js/modules/<nom>.js qui exporte render(ctx) → Element (et resetView() si l'onglet garde un état local)
2. ajouter une ligne dans TABS de js/app.js : ['<nom>', 'Libellé', module]
3. SI l'onglet a des données propres :
     ajouter la clé dans seed() et dans sanitizeState (js/store.js)
     déclarer la section dans SECTIONS (js/data-io.js) et le libellé dans js/ui/data-panel.js
     ajouter la clé à tombstones.TRACKED si ses éléments ont un id et peuvent être supprimés
4. ajouter l'onglet aux cibles des widgets (js/settings-logic.js : TARGETS)
5. écrire les tests, puis la fiche docs/features/<nom>.md (gabarit ci-dessous)
6. npm run build:sw  puis  npm test
```

### Ajouter une clé d'état

```text
seed()            → valeur de départ
sanitizeState     → validation et bornes (une fonction sanitizeXxx dédiée si elle est longue)
SECTIONS          → dans quelle section elle s'exporte
fusion            → liste d'objets avec id : automatique ; objet : ajouter une règle dans MERGERS (js/data-io.js)
```

## 3. Tests

| Type | Où | Lancer | Ce que c'est |
|---|---|---|---|
| Unitaires et interface (jsdom) | `tests/*.test.js` | `npm test` | logique pure, validations, composants dessinés dans un faux DOM |
| Navigateur réel | `tests/e2e/*.e2e.py` | `python3 tests/e2e/<nom>.e2e.py` (serveur lancé) | Chromium avec la vraie CSP : glisser, hors ligne, tuteur… |
| Garde-fous | `tests/pwa.test.js`, `tests/docs.test.js` | `npm test` | `sw.js` à jour, documentation cohérente |

Conventions de test :

- Un `test(...)` = un comportement ; le titre dit le comportement en français.
- Aides : `setupDOM()` et `memory()` (`tests/helpers/dom.js`) ; pour un onglet, monter le module avec un `ctx` de test, appeler `resetView?.()` avant, et s'abonner au `store` pour redessiner.
- Éviter les horloges réelles : passer `now` en paramètre quand la fonction l'accepte.
- Tests e2e : la CSP interdit `eval`, donc **pas de `wait_for_function`** avec une chaîne ; interroger l'état avec `locator(...)` en boucle.
- Un bug corrigé = un test qui l'aurait attrapé.

## 4. Fichiers générés (ne pas modifier à la main)

| Fichier | Généré par | Garde-fou |
|---|---|---|
| `sw.js` | `npm run build:sw` | `tests/pwa.test.js` échoue s'il est périmé |
| `js/tutor-prompt.js` | `npm run build:tutor` (depuis `docs/fds-tutor.md`) | `tests/tutor.test.js` compare au fichier source |

**Après toute modification d'un fichier de l'app, lance `npm run build:sw`**, sinon le mode hors ligne sert l'ancienne version.

## 5. Workflow Git

- Une branche courte par sujet (`feat/…`, `fix/…`, `docs/…`), fusionnée dans `main` quand `npm test` est vert.
- Commits atomiques, message `type: résumé` (`feat`, `fix`, `docs`, `test`, `refactor`, `chore`), comme dans `.github/workflows/videos.yml`.
- **Éviter les conflits de merge** (cause d'un site vide déjà rencontrée) :
  - ne jamais modifier à la main `data/videos.json` : l'Action GitHub le réécrit chaque jour ; tirer (`git pull`) avant de pousser ;
  - en cas de conflit, ne pas fusionner à la main un fichier généré (`sw.js`, `js/tutor-prompt.js`, `data/videos.json`) : prendre une version propre et régénérer ;
  - avant de pousser, chercher les marqueurs : `grep -rn "<<<<<<<\|>>>>>>>" . --include=*.js --include=*.css --include=*.html --include=*.json --exclude-dir=node_modules --exclude-dir=vendor`.
- Depuis un téléphone : éditeur web (touche `.` sur la page du dépôt ou `github.dev`) ; l'envoi de fichiers se fait dossier par dossier, il faut tout envoyer, sinon le site s'affiche à moitié ou reste vide (voir le [dépannage](DEPANNAGE.md)).

## 6. Dépôt public : règles

- **Aucune donnée privée dans le dépôt** : pas de vrais résumés d'e-mails ou de messages dans `data/summaries.json`, pas de sauvegarde exportée, pas de clé secrète. La clé « anon public » de Supabase n'est pas un secret, mais elle se saisit dans l'app (Paramètres), pas dans le code.
- Les exemples « demo » de `data/summaries.json` sont à supprimer quand Hermes écrit pour de vrai ; tant que le dépôt est public, mieux vaut ne pas y écrire de vrais messages.

## 7. Revue (liste de contrôle)

- [ ] `npm test` vert ; `npm run build:sw` lancé.
- [ ] Aucun `innerHTML`, aucun style en ligne, aucune dépendance ajoutée sans décision.
- [ ] Tout ce qui entre est validé et borné.
- [ ] Les nouvelles données sont déclarées (`seed`, `sanitizeState`, `SECTIONS`, suppressions suivies).
- [ ] Les messages visibles sont en français, clairs, sans jargon.
- [ ] Un test couvre le comportement, y compris les cas limites.
- [ ] La fiche de fonctionnalité est créée ou mise à jour (et le [CHANGELOG](CHANGELOG.md)).

## 8. Documentation

La documentation est organisée du général au particulier : [README des docs](README.md) → [ARCHITECTURE](ARCHITECTURE.md) → [fiches](features/README.md). Chaque fiche suit le même gabarit en 11 sections :

1. Objectif · 2. Périmètre · 3. Vue d'ensemble technique · 4. Composants et fichiers concernés · 5. Entrées / sorties · 6. Fonctionnement détaillé (avec pseudo-code) · 7. Dépendances · 8. Cas limites et erreurs · 9. Tests · 10. Pièges et dette technique · 11. Pour modifier ou étendre.

`tests/docs.test.js` vérifie que les chemins cités existent, que les liens fonctionnent et que chaque fiche respecte le gabarit : une documentation qui ment fait échouer `npm test`. Le [plan de documentation](plans/plan-documentation.md) décrit la convention de pseudo-code.
