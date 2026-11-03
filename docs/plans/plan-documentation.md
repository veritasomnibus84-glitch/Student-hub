# Plan de documentation de Student Hub

Statut : **D1 à D6 faites** (fondations, centraux, garde-fous, 19 décisions, 37 fiches dont 3 « Prévue », CHANGELOG et DEPANNAGE). Reste la maintenance : une fiche créée ou mise à jour avec chaque changement de code.

## 1. Objectif

Tout le projet est documenté dans `docs/`, du général au particulier, fonctionnalité par fonctionnalité, avec du pseudo-code et des schémas. Un nouveau développeur (ou toi dans six mois, ou une IA) doit pouvoir : comprendre l'ensemble en lisant `ARCHITECTURE.md`, trouver la fiche dont il a besoin, et modifier le code sans casser le reste.

Livrables : 6 documents centraux, ~19 décisions (ADR), ~35 fiches de fonctionnalités, un `CHANGELOG`, un `DEPANNAGE`, et un test qui empêche la documentation de se périmer.

## 2. Organisation cible

```
README.md                    (racine : court, pointe vers docs/)
docs/
├── README.md                index de la documentation, par où commencer, par profil
├── ARCHITECTURE.md
├── GLOSSAIRE.md
├── CONTRIBUTING.md
├── CHANGELOG.md
├── DEPANNAGE.md
├── decisions/
│   ├── README.md            liste des décisions et statut
│   └── 001-… à 019-….md
├── features/
│   ├── README.md            table des fiches, regroupées par thème
│   └── <theme>-<nom>.md     une fiche par fonctionnalité
├── plans/                   plans de travail (déplacés ici)
│   ├── plan-taches.md
│   ├── plan-mcp.md
│   └── plan-documentation.md
├── SPEC.md                  spécification d'origine (déplacée ici)
└── fds-tutor.md             prompt système du tuteur (source de js/tutor-prompt.js)
```

`tasks/plan.md` devient `docs/plans/plan-taches.md`, `SPEC.md` devient `docs/SPEC.md` (fait en D1). Le README racine reste, mais court ; son ancien détail est conservé dans `docs/features/README.md` jusqu'à la rédaction des fiches. Les références existantes (README, tests, scripts) sont corrigées.

## 3. Gabarit commun des fiches (11 sections, dans cet ordre)

1. **Objectif** : le problème résolu, en 2-3 phrases.
2. **Périmètre** : ce qu'elle fait / ne fait pas (deux listes courtes).
3. **Vue d'ensemble technique** : schéma Mermaid (flux ou séquence).
4. **Composants et fichiers concernés** : tableau `chemin exact | rôle`.
5. **Entrées / sorties** : formats, types, exemple concret réel (JSON, DOM, prompt).
6. **Fonctionnement détaillé** : étapes, règles métier, états, **pseudo-code**.
7. **Dépendances** : modules internes, services externes, configuration, clés `localStorage`, aucune variable d'environnement (l'app n'en a pas : on l'écrit).
8. **Cas limites et erreurs** : comportement attendu, messages affichés.
9. **Tests** : fichiers, commande, ce qui est couvert et ce qui ne l'est pas.
10. **Pièges et dette technique** : ce qui surprend, ce qui reste à améliorer.
11. **Pour modifier ou étendre** : par où commencer, ce qu'il ne faut pas casser, commandes à relancer (`npm test`, `npm run build:sw`…).

En tête de chaque fiche : une ligne d'état (`Implémentée` / `Partielle` / `Prévue`) et la date de dernière vérification contre le code.

### Convention de pseudo-code

- Bloc ```` ```text ````, en français, mots-clés en majuscules : `FONCTION`, `SI / SINON`, `POUR CHAQUE … DANS …`, `TANT QUE`, `RETOURNER`, `ERREUR`.
- Les noms de fonctions et de champs sont **ceux du code** (`occurrenceOn`, `exceptions[origin]`) pour pouvoir chercher dans le dépôt.
- Une règle métier = une ligne ; pas de syntaxe d'un langage réel ; pas de détails d'affichage.
- Chaque fiche contient au moins un pseudo-code pour son algorithme principal, et les fonctions pures sont décrites avec leurs entrées/sorties et un exemple chiffré tiré des tests.

Exemple de style :

```text
FONCTION occurrenceOn(événement, jour)
  POUR CHAQUE (origine, exception) DANS événement.exceptions
    SI exception.date = jour ET origine ≠ jour ET PAS exception.deleted ET la série tombe le jour « origine »
      RETOURNER occurrence déplacée (champs de l'exception par-dessus ceux de la série)
  SI la série ne tombe pas ce jour : RETOURNER rien
  SI exception[jour] est supprimée OU déplacée ailleurs : RETOURNER rien
  RETOURNER occurrence (série + exception éventuelle), origine = jour
```

## 4. Documents centraux : contenu prévu

| Document | Contenu |
|---|---|
| `README.md` (racine) | Ce qu'est Student Hub en 5 lignes, captures de l'organisation, lancement en 5 minutes (ouvrir `index.html` via un petit serveur, `npm install`, `npm test`), déploiement GitHub Pages, liens vers `docs/`. |
| `docs/README.md` | Index : « je veux comprendre » (ARCHITECTURE), « je veux modifier X » (table fonctionnalité → fiche), « je veux déployer » (CONTRIBUTING), « ça ne marche pas » (DEPANNAGE). |
| `ARCHITECTURE.md` | Schéma des composants (navigateur : `index.html` → `main.js` → `app.js` → modules ; couche données : `store.js`, `data-io.js`, `sync.js` ; services : GitHub Pages, GitHub Actions, Supabase, IA de l'utilisateur) ; flux principaux (démarrage, édition d'une donnée, import/export, synchronisation, hors ligne, génération par IA) ; stack et raisons ; **arborescence commentée** de tout le dépôt ; modèle de données (liste des clés d'état et de leur propriétaire) ; contraintes transverses (CSP stricte, aucun `innerHTML`, aucune dépendance d'exécution, mobile d'abord). |
| `GLOSSAIRE.md` | ~60 termes : noyau/pilier/détail, FSRS, stabilité, difficulté, rétention, carte, leçon, session, examen blanc, blocage (gap), plage de travail, occurrence, exception de série, marqueur de suppression (tombstone), instantané, boîte de réception, widget, appui long, PWA, service worker, CSP, RLS, anon key, etc. Chaque terme : définition, fichier de référence, lien vers la fiche. |
| `CONTRIBUTING.md` | Conventions de code (modules ES, pas de framework, fonctions pures dans `*-logic.js`, interface dans `modules/` et `ui/`, aucun `innerHTML`, typographie), organisation des tests (node:test + jsdom, e2e Playwright), commandes (`npm test`, `npm run build:sw`, `npm run build:tutor`, e2e), workflow Git (branches courtes, commits atomiques, **comment éviter les conflits de merge** : ne pas éditer `data/*.json` à la main, tirer avant de pousser, vérifier l'absence de `<<<<<<<`), revue (liste de contrôle), publication sur GitHub Pages, règles propres au dépôt public (aucune donnée privée). |
| `CHANGELOG.md` | Reconstitué depuis l'historique de la conversation et du plan : versions regroupées par thème (socle, Agenda, Focus, Mémorisation, Objectifs, Paramètres, synchro, PWA…), format « Ajouté / Modifié / Corrigé / Retiré ». |
| `DEPANNAGE.md` | Symptôme → cause → solution, à partir des vrais incidents : site vide (erreur de merge, fichier manquant, marqueurs `<<<<<<<`), ancienne version affichée (cache, service worker, `build:sw`), 6 onglets au lieu de 12, erreur de synchronisation (adresse, clé, RLS, e-mail non confirmé, CSP), hors ligne, notifications absentes, PDF « absent de cet appareil », podcast muet, glisser au doigt, verrou oublié. |

## 5. Les décisions (ADR) — `docs/decisions/`

Format court : Contexte · Décision · Alternatives rejetées · Conséquences · Statut/date.

| N° | Décision |
|---|---|
| 001 | HTML/CSS/JS sans framework ni build |
| 002 | Aucun token GitHub dans le navigateur ; données dans `localStorage` |
| 003 | PDF par appareil (IndexedDB), jamais sur GitHub (droits d'auteur) ; relier par nom + taille |
| 004 | CSP stricte et aucun `innerHTML` |
| 005 | pdf.js 6.4.299 (legacy) copié dans `vendor/` |
| 006 | Verrou local (PBKDF2) = écran de connexion, pas de chiffrement |
| 007 | IA par copier-coller : aucune clé dans le navigateur |
| 008 | FSRS-6 (paramètres vérifiés contre py-fsrs ; pas FSRS-5) |
| 009 | Synchronisation par Supabase (alternatives : Firebase, fonctions serverless, serveur perso, statique + MCP) |
| 010 | Fusion par identifiant + marqueurs de suppression ; XP au maximum ; réglages locaux |
| 011 | PWA avec service worker **généré** (`npm run build:sw`, test de péremption) |
| 012 | Menu contextuel unique (clic droit, appui long 500 ms, bouton ⋯) |
| 013 | Widgets de Home réutilisés en bas de chaque onglet ; réglages dans `state.settings` |
| 014 | Une session Focus = UNE tâche OU UN événement |
| 015 | Exceptions de série par date d'origine (`exceptions`) |
| 016 | Événements sur plusieurs jours par `endDate` (jours du milieu en « journée ») |
| 017 | Rappels seulement application ouverte (pas de serveur de notifications) |
| 018 | Dépôt public : aucune donnée privée dans le dépôt (Hermes, sauvegardes, instantanés) — **à confirmer avec toi** |
| 019 | Prompt du tuteur : source `docs/fds-tutor.md`, fichier JS généré et testé |

## 6. Fiches de fonctionnalités — `docs/features/`

Une fiche = un fichier. Les chemins sources sont ceux du dépôt actuel (relus avant rédaction).

**Socle**
| Fiche | Périmètre | Sources principales |
|---|---|---|
| `socle-etat-et-stockage.md` | état, `seed`, validation, `commit`, clés `localStorage` | `js/store.js`, `js/constants.js` |
| `socle-import-export.md` | sauvegardes par onglet et complète, fusion/remplacement | `js/data-io.js`, `js/ui/data-panel.js` |
| `socle-interface.md` | `h()`, feuilles, toasts, navigation, hash | `js/dom.js`, `js/ui/dialog.js`, `js/app.js`, `js/main.js` |
| `socle-verrou.md` | nom + mot de passe, PBKDF2, session | `js/lock.js`, `js/ui/lock-screen.js`, `js/app.js` |
| `socle-recherche-globale.md` | recherche Home | `js/search.js` |
| `socle-rappels.md` | rappels app ouverte, toasts, notifications navigateur | `js/reminders.js`, `js/calendar-logic.js` |
| `socle-menu-contextuel.md` | clic droit, appui long, ⋯ | `js/ui/context-menu.js` |
| `socle-widgets-et-home.md` | registre, barre de bas d'onglet, personnalisation | `js/ui/widgets.js`, `js/modules/home.js`, `js/settings-logic.js` |
| `socle-parametres.md` | tous les réglages et leur effet | `js/modules/settings*.js`, `js/appearance.js`, `js/settings-logic.js` |
| `socle-pwa-hors-ligne.md` | manifeste, service worker généré, installation | `sw.js`, `scripts/build-sw.mjs`, `js/pwa.js`, `manifest.webmanifest` |
| `socle-synchronisation.md` | Supabase, marqueurs de suppression, auto-sync | `js/sync.js`, `js/autosync.js`, `js/tombstones.js`, `scripts/supabase.sql` |
| `socle-automatisations.md` | Action GitHub des vidéos, scripts de génération | `.github/workflows/videos.yml`, `scripts/` |

**Onglets**
| Fiche | Sources principales |
|---|---|
| `workspace-cours-et-todos.md` | `js/modules/workspace.js`, `js/ui/todo-dialog.js`, `js/kanban.js` |
| `agenda-vues-et-recurrence.md` | `js/calendar-logic.js`, `js/modules/calendar.js` |
| `agenda-evenements-longs-et-occurrences.md` | `endDate`, `exceptions`, `occurrenceOn` |
| `agenda-glisser.md` (créer, multi-jours, déplacer) | `weekView` |
| `agenda-ics.md` | `js/ics.js` |
| `agenda-plages-de-travail.md` | `js/work-logic.js`, `js/ui/slot-planner.js` |
| `focus-minuteur-et-arbre.md` | `js/modules/focus.js`, `js/focus-logic.js`, `js/focus-runtime.js` |
| `focus-sessions-planifiees.md` | `js/ui/focus-plan.js`, `focusPlans` |
| `focus-statistiques.md` | `js/focus-logic.js`, `js/ui/charts.js` |
| `biblio-pdf.md` | `js/modules/library.js`, `js/library-logic.js`, `js/files.js`, `js/pdfdoc.js`, `js/ui/reader.js` |
| `messages-hermes.md` | `js/modules/messages.js`, `data/summaries.json` |
| `videos.md` | `js/modules/videos.js`, `scripts/fetch-videos.mjs` |
| `notes.md` | `js/modules/notes.js` |
| `liens.md` | `js/modules/links.js` |
| `objectifs-et-conseils.md` | `js/modules/goals.js`, `js/goals-logic.js` |

**Mémorisation**
| Fiche | Sources principales |
|---|---|
| `memo-cartes-et-revision.md` | `js/revision-logic.js`, `js/modules/revision.js` |
| `memo-fsrs.md` | `js/fsrs.js` |
| `memo-examens.md` | examens, correction, prompts de correction |
| `memo-planning.md` | `js/planning.js` |
| `memo-apprendre.md` (couches, fiches, podcast) | `js/study-logic.js`, `js/modules/learn-ui.js` |
| `memo-tuteur.md` | `js/tutor-logic.js`, `js/modules/tutor-ui.js`, `js/tutor-prompt.js`, `docs/fds-tutor.md` |
| `memo-xp-et-niveaux.md` | `js/xp-logic.js` |

**Prévues** (marquées `Prévue`) : `mcp.md` (d'après `plan-mcp.md`), `notifications-application-fermee.md`, `interface-multilingue.md`.

## 7. Méthode de rédaction

1. **Lire le code et les tests, pas la mémoire** : pour chaque fiche, relire les fichiers sources et les tests avant d'écrire ; les signatures, noms de champs, messages d'erreur et exemples chiffrés sont copiés du code.
2. **Du général au particulier** : centraux d'abord (ARCHITECTURE pose les noms), fiches ensuite.
3. **Montrer avant d'expliquer** : chaque fiche ouvre sur un schéma Mermaid, puis un exemple réel, puis les règles.
4. **Expliquer le pourquoi** : la section « Pièges » et les ADR portent les raisons ; le code porte le comment.
5. **Lier à tout** : chemins exacts en `code`, liens relatifs entre fiches, vers les ADR et le glossaire.
6. **Dire la vérité sur l'état** : ce qui est partiel, non testé sur appareil réel ou prévu est écrit comme tel.

## 8. Garde-fous automatiques (nouveau `tests/docs.test.js`, lancé par `npm test`)

- Chaque fichier de `docs/features/` contient les **11 titres** du gabarit, dans l'ordre, et une ligne d'état.
- Chaque chemin de code cité entre accents graves (`js/…`, `css/…`, `tests/…`, `scripts/…`) **existe** dans le dépôt.
- Tous les liens Markdown relatifs pointent vers un fichier existant (et une ancre existante quand elle est donnée).
- Chaque fichier de `js/modules/` et chaque `js/*-logic.js` est cité par au moins une fiche (impossible d'ajouter un module sans le documenter).
- Chaque ADR a les sections Contexte / Décision / Alternatives / Conséquences.
- Chaque terme du glossaire pointe vers un fichier existant.
- Chaque fiche contient au moins un bloc de pseudo-code (```` ```text ````) et un schéma (```` ```mermaid ````), sauf mention « sans algorithme ».

## 9. Phases

| Phase | Contenu | Critère de fin |
|---|---|---|
| **D1 — Fondations** (faite) | structure `docs/`, déplacement des plans et de la spec, `docs/README.md`, `ARCHITECTURE.md`, `GLOSSAIRE.md`, `CONTRIBUTING.md`, README racine réduit, `tests/docs.test.js` (règles des centraux et des liens) | les centraux se lisent de bout en bout ; le test de liens passe |
| **D2 — Décisions** (faite) | les 19 ADR + index | chaque ADR cite le code concerné |
| **D3 — Socle** | 12 fiches « socle » | test des 11 sections passe pour ces fiches |
| **D4 — Onglets** | 15 fiches (Workspace, Agenda, Focus, Biblio, Messages, Vidéos, Notes, Liens, Objectifs) | idem |
| **D5 — Mémorisation** | 7 fiches | idem |
| **D6 — Transversal** | `CHANGELOG.md`, `DEPANNAGE.md`, fiches « Prévue », relecture croisée (liens, glossaire), test de couverture des modules | tous les garde-fous passent ; chaque module est documenté |

Chaque phase est livrée avec le zip complet et `npm test` au vert. On ne passe pas à la suivante tant que le test de la phase n'est pas vert.

## 10. Points à confirmer

1. Déplacer `SPEC.md` et `tasks/plan.md` dans `docs/` (proposé : oui).
2. ADR 018 (dépôt public) : on documente « aucune donnée privée dans le dépôt », ou tu prévois de passer en dépôt privé ?
3. Langue des identifiants dans le pseudo-code : français pour les mots-clés, noms du code inchangés (proposé).
4. Les fiches « Prévue » (MCP, notifications fermées, multilingue) : incluses (proposé), pour garder la trace du raisonnement.

## 11. Hors périmètre

- Documentation d'API générée automatiquement (JSDoc) : le code n'est pas annoté pour cela ; les fiches décrivent les fonctions utiles à la main.
- Captures d'écran : l'environnement de rédaction ne permet pas d'en garantir la fraîcheur ; les schémas Mermaid et exemples de données les remplacent.
