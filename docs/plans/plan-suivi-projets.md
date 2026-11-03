# Plan : suivi de projets à la Asana (sous-tâches, dépendances, rapports, objectifs reliés)

> **Réalisé** (octobre 2026) : les six tranches sont faites, avec tests et documentation. Les fiches [sous-tâches et dépendances](../features/workspace-sous-taches-et-dependances.md), [projets](../features/workspace-projets.md) et [rapports](../features/rapports-et-tableaux-de-bord.md) décrivent le résultat. Écarts avec ce plan : les opérations MCP de TS6 ne sont pas faites (l'application n'a pas encore de serveur MCP, voir [plan-mcp](plan-mcp.md)) ; les champs à prévoir pour `todo.add` y sont notés.

Objectif : faire de Workspace un vrai outil de suivi, sans framework, sans build et sans nouvel onglet. Cinq apports inspirés d'Asana : **sous-tâches**, **dépendances**, **projets**, **objectifs reliés au travail** et **rapports / tableaux de bord**.

Règle de ce plan (comme `plan-taches.md`) : une tranche verticale à la fois : implémenter, tester, vérifier dans le navigateur, documenter, commit. Ce document décrit des fichiers futurs ; il est donc hors du contrôle des chemins de `tests/docs.test.js`.

## 1. Ce que le code fait déjà (constaté dans le dépôt)

| Besoin | Existant | Manque |
|---|---|---|
| Tâche | `newTodo` : `name, courseId, deadline, file, status, type, eventId, slots` | `parentId`, `blockedBy`, `effort`, `projectId`, **`doneAt`** |
| Statuts | `STATUSES` : À faire, En cours, Terminés, Sans statut | « bloquée » (calculé, pas stocké) |
| Objectif | `goals-logic.js` : `start, amount, unit, due, done` ; `progress()` = **temps écoulé uniquement** | progression venant du travail, liens |
| Graphiques | `ui/charts.js` : `barChart`, `lineChart`, `donut` (SVG sans `innerHTML`) | ligne de capacité, barre de progression |
| Plages de travail | `slots` (date, début, fin, done) + `focusPlans` | somme par jour, capacité |
| Fusion appareils | `tombstones.js` (`TRACKED`), `data-io.js` (`SECTIONS`) | nouvelles collections à déclarer |
| Widgets Home | `settings-logic.js` (`WIDGETS`, `HIDE_ON`) | widgets « en retard », « prêtes », « charge » |

Point d'attention : **aucune date de fin de tâche n'est enregistrée** aujourd'hui. Sans `doneAt`, le graphique « tâches terminées par semaine » est impossible, et l'historique ne peut pas être reconstruit après coup. Ce champ passe donc en **première tranche**.

## 2. Décisions à prendre (une ADR chacune, numérotées à la suite de 019)

- **020 : un seul niveau de sous-tâches.** Un parent ne peut pas être lui-même une sous-tâche. Raison : lisibilité sur téléphone, progression simple, pas de récursion à tester.
- **021 : dépendances « souples ».** Une tâche bloquée est signalée (cadenas, grisée, absente de « prêtes à démarrer »), mais l'utilisateur peut la démarrer en confirmant. Option dans Paramètres pour passer en mode strict.
- **022 : la progression remonte par moyenne, à poids égal.** Sous-tâches → tâche → projet → objectif. Le temps (`effort`) sert à la charge de travail, pas à pondérer la progression (pondération possible plus tard).
- **023 : l'objet « projet » est une collection légère `projects`, distincte de `courses`.** Un cours dure un semestre ; un projet est un travail borné (dossier d'informatique, révision du partiel). Un projet peut être rattaché à un cours (`courseId`), pas obligatoirement.

## 3. Modèle de données

### 3.1 Tâche (`todos`)
```text
parentId   : '' | id d'une tâche qui n'a pas de parent        (1 niveau)
blockedBy  : [id, …]   max 20, sans doublon, sans cycle
effort     : minutes estimées, 0 à 6000 (0 = non estimé)
projectId  : '' | id d'un projet
doneAt     : '' | 'AAAA-MM-JJ'   posé quand le statut passe à « Terminés », vidé sinon
```
`sanitizeState` (dans `js/store.js`) applique, dans cet ordre : types et longueurs → `parentId` invalide ramené à `''` → `blockedBy` filtré (ids existants, pas soi-même, pas parent↔enfant) → **cycles coupés** (voir 4.2) → `doneAt` vidé si le statut n'est pas « Terminés ».

### 3.2 Projet (`projects`, nouvelle collection)
```text
{ id, name (300), courseId, deadline, color (CAL_COLORS), archived: false }
```

### 3.3 Objectif (`goals`, champs ajoutés)
```text
mode   : 'time' | 'manual' | 'auto'      défaut 'time' → les objectifs existants ne changent pas
manual : 0..100                          utilisé si mode = 'manual'
links  : [{ kind: 'project'|'course'|'todo', id }]   max 100, utilisé si mode = 'auto'
```
Les liens vers un id absent sont **ignorés au calcul** et signalés « lien cassé » (ne pas les supprimer à la lecture : l'onglet Workspace peut être importé après celui des Objectifs).

### 3.4 Réglages (`settings`)
```text
work: { capacityMin: 240, strictDeps: false, autoCloseParent: true }
```

### 3.5 Branchements obligatoires
- `js/tombstones.js` : ajouter `'projects'` à `TRACKED`.
- `js/data-io.js` : `SECTIONS.workspace.keys` devient `['courses', 'todos', 'projects']`.
- `js/store.js` : `seed()`, `newProject`, `sanitizeProjects`, `removeProject` (détache les tâches : `projectId = ''`), `removeTodo` (retire l'id de tous les `blockedBy`, détache ou supprime les sous-tâches).
- `js/settings-logic.js` : `sanitizeSettings` gère `work`.

## 4. Logique pure (testable sans navigateur)

### 4.1 `js/tasks-logic.js` : sous-tâches et progression
```text
children(todos, id)        = todos filtrés par parentId == id
canNest(todos, id, parent) = parent existe ET parent.parentId == '' ET id n'a pas d'enfants ET id != parent
itemProgress(todo, todos)  =
    kids = children(todos, todo.id)
    si kids non vide : (nombre de kids « Terminés ») / (nombre de kids)
    sinon            : 1 si todo.status == 'Terminés', sinon 0
rollup(list, todos)        = moyenne des itemProgress sur les tâches de niveau 1 de `list`
                             (les sous-tâches ne sont JAMAIS comptées en plus de leur parent)
onChildStatus(todos, child) =
    si réglage autoCloseParent ET tous les enfants « Terminés » → proposer parent = « Terminés » (+ doneAt)
    si un enfant revient en arrière ET parent « Terminés »      → parent = « En cours »
onParentDone(parent)        = confirmer : « Terminer aussi les N sous-tâches ? »
```
Création d'une sous-tâche : elle **hérite** `courseId` et `projectId` du parent (Asana ne le fait pas : c'est un gain), garde sa propre deadline.

### 4.2 `js/deps-logic.js` : dépendances
Sens : `X.blockedBy = [Y]` signifie « Y doit être fini avant X ».
```text
isDone(t)        = t.status == 'Terminés'
isBlocked(t, byId) =
    existe b dans t.blockedBy tel que byId[b] existe ET non isDone(byId[b])
    OU (t.parentId ET isBlocked(byId[t.parentId]))        ← une sous-tâche hérite du blocage du parent
wouldCycle(todos, x, y) =                                    ← ajouter « x bloquée par y » ?
    parcourir en profondeur depuis y en suivant blockedBy ;
    si on atteint x → true (cycle) ; sinon false
breakCycles(todos) =                                         ← appelé par sanitizeState (fusion de 2 appareils)
    graphe vide ; pour chaque tâche dans l'ordre du tableau, pour chaque blocage :
        si wouldCycle(graphe, tâche, blocage) → on abandonne CE lien ; sinon on l'ajoute
    (ordre fixe ⇒ même résultat sur tous les appareils)
ready(todos)     = tâches non terminées, non bloquées, de niveau 1 ou sous-tâches non bloquées
                   triées par deadline puis par nombre de tâches qu'elles débloquent (décroissant)
earliestStart(t) = max des deadlines des blocages non terminés (ou '')
conflicts(todos) = tâches dont la deadline est AVANT la deadline d'un de leurs blocages
topoOrder(list)  = tri topologique (Kahn) pour afficher « ordre conseillé » dans un projet
```

### 4.3 `js/goals-logic.js` : progression d'un objectif (extension)
```text
timeRatio(goal, today) = progress(goal, today).ratio                 ← existant, inchangé
workRatio(goal, state) =
    mode 'manual' → manual / 100
    mode 'auto'   → moyenne, sur chaque lien valide, de :
                       project → rollup(tâches du projet)
                       course  → rollup(tâches du cours)
                       todo    → itemProgress(tâche)
    mode 'time'   → timeRatio
status(goal, state, today) =                                          ← vocabulaire d'Asana
    si goal.done ou workRatio ≥ 1           → 'Atteint'
    écart = workRatio − timeRatio
    écart ≥ −0.10                           → 'Dans les temps'
    écart ≥ −0.25                           → 'À risque'
    sinon                                   → 'En retard'
```
Un objectif en mode `time` n'affiche pas de statut (pas de travail à comparer).

### 4.4 `js/reports-logic.js` : agrégats pour les rapports
```text
statusCounts(todos, today)  → { fait, enCours, aFaire, enRetard }   (en retard = deadline < today ET non fait ; compté À PART)
byCourse(todos, courses)    → [{ course, total, done, ratio }]
doneByWeek(todos, weeks=8)  → 8 compteurs à partir de doneAt (tâches sans doneAt ignorées)
overdue(todos, today)       → liste triée par ancienneté
load(state, from, days=14)  → pour chaque jour :
    planifié  = somme des minutes des slots non faits des tâches non terminées
              + minutes des focusPlans non faits
    non planifié = somme des effort des tâches sans slot dont la deadline est ce jour
    surcharge = planifié + non planifié > settings.work.capacityMin
```

## 5. Interface (sans `innerHTML`, avec `h()`, composants existants)

- **Carte kanban** : pastille « 3/5 » + barre fine pour un parent ; pastille « Bloquée » (cadenas texte) si `isBlocked` ; les sous-tâches se replient sous leur parent (pas de carte séparée). Menu contextuel (`attachMenu`) : *Ajouter une sous-tâche*, *Bloquée par…*, *Projet…*.
- **Fenêtre de to-do** (`ui/todo-dialog.js`) : champs *Projet*, *Sous-tâche de*, *Bloquée par* (liste à cocher, avec refus et message si cycle), *Effort estimé*. Aide à la saisie : « Cette tâche débloque N autres tâches ».
- **Workspace** : un sélecteur de vue à trois entrées : *Tableau* (actuel) · *Projets* · *Rapports*. Pas de nouvel onglet.
- **Page d'un projet** (`js/modules/projects.js`) : barre de progression, kanban filtré, section *Ordre conseillé* (`topoOrder`), section *Objectifs liés* (objectifs dont `links` contient ce projet).
- **Rapports** (`js/ui/report-widgets.js`) : donut des statuts, barres par cours, courbe des tâches terminées par semaine, liste des retards cliquable, barres de charge sur 14 jours avec **ligne de capacité** (nouvelle option `limit` de `barChart`), liste « Prêtes à démarrer ».
- **Objectifs** (`js/modules/goals.js`) : choix du mode (Temps · Manuel · Automatique), sélecteur de liens pour le mode automatique, barre de progression + barre de temps + pastille de statut.
- **Home** : trois widgets ajoutés à `WIDGETS` : `late` (En retard), `ready` (Prêtes à démarrer), `load` (Charge de la semaine). `HIDE_ON` : `late` et `ready` masqués dans `workspace`.

## 6. Tranches (ordre = dépendances)

- [x] **TS1 Sous-tâches + champs de suivi.** `parentId`, `effort`, `doneAt` ; `tasks-logic.js` ; sanitize ; carte et fenêtre ; menu contextuel ; suppression d'un parent (choix : supprimer ou détacher).
  Critère : cocher la dernière sous-tâche termine le parent ; `doneAt` est posé et vidé correctement ; un export/import ne perd rien.
  Tests : `tests/tasks.test.js` (`canNest`, `itemProgress`, `rollup`, `onChildStatus`, sanitize d'un `parentId` orphelin ou à deux niveaux).
  **À livrer en premier : l'historique `doneAt` ne commence qu'à ce moment.**
- [x] **TS2 Dépendances.** `deps-logic.js` ; `blockedBy` ; sélecteur ; cadenas ; refus des cycles ; `breakCycles` dans sanitize ; réglage « strict ».
  Critère : A bloque B bloque C ; ajouter « A bloquée par C » est refusé ; terminer A débloque B.
  Tests : `tests/deps.test.js` (cycle direct, indirect, auto-référence, parent↔enfant, **cycle créé par la fusion de deux sauvegardes**, `ready`, `conflicts`, `topoOrder`, suppression d'un bloqueur).
- [x] **TS3 Projets.** Collection `projects` ; `TRACKED` et `SECTIONS` ; vue *Projets* ; champ *Projet* dans la fenêtre ; page de projet avec progression et ordre conseillé.
  Critère : supprimer un projet détache ses tâches ; l'import fusionne par id et un projet supprimé ailleurs ne revient pas.
  Tests : `tests/projects.test.js` + ajout aux tests de `tombstones` et `data-io`.
- [x] **TS4 Objectifs reliés.** `mode`, `manual`, `links` ; `workRatio` et `status` ; interface ; liens cassés signalés ; section *Objectifs liés* dans la page d'un projet.
  Critère : un objectif automatique relié à un projet à 50 % affiche 50 % ; les anciens objectifs restent en mode temps, sans changement visible.
  Tests : `tests/goals2.test.js` (moyennes, lien cassé, seuils du statut, compatibilité des anciennes données).
- [x] **TS5 Rapports et widgets.** `reports-logic.js` ; extension de `charts.js` (`limit`, barre de progression) ; vue *Rapports* ; widgets Home ; réglage `work.capacityMin`.
  Critère : ajouter 3 h de travail planifié un jour affiche une surcharge au-delà de la capacité ; cliquer un retard ouvre la tâche.
  Tests : `tests/reports.test.js` (comptes, semaines sans `doneAt`, charge avec et sans plages, jour de surcharge) ; test SVG dans `tests/ux.test.js`.
- [x] **TS6 Finitions.** Guide (`GUIDE_VERSION` 6 : conseils sous-tâches, dépendances, rapports) ; opérations MCP (`todo.add` accepte `parentId`, `blockedBy`, `effort`, `projectId`, voir `plan-mcp.md`) ; test navigateur `tests/e2e/projects.e2e.py` ; vérification mobile clair/sombre.

## 7. Documentation et garde-fous des tests (à prévoir dès le début, sinon `npm test` échoue)

- **Chaque nouveau fichier de `js/`** (`tasks-logic.js`, `deps-logic.js`, `reports-logic.js`, `modules/projects.js`, `ui/report-widgets.js`) doit figurer dans l'**arborescence de `docs/ARCHITECTURE.md`** et être **cité dans une fiche** de `docs/features/`, sinon le cliquet de couverture échoue.
- **Fiches à créer** (gabarit en 11 sections, ligne `**État :**`, un schéma Mermaid, un bloc `text` de pseudo-code) : `workspace-sous-taches-et-dependances.md`, `workspace-projets.md`, `rapports-et-tableaux-de-bord.md`. **À mettre à jour** : `workspace-cours-et-todos.md`, `objectifs-et-conseils.md`, `socle-etat-et-stockage.md`, `socle-widgets-et-home.md`. Ajouter les trois nouvelles à `docs/features/README.md`.
- **ADR 020 à 023** avec les quatre sections *Contexte · Décision · Alternatives rejetées · Conséquences*, plus la ligne dans `docs/decisions/README.md`.
- **GLOSSAIRE** : sous-tâche, dépendance, bloquée, prête, projet, progression, statut d'objectif, capacité (chaque ligne : terme | définition de plus de 10 caractères | lieu).
- **CHANGELOG**, puis **régénération du service worker** (`scripts/build-sw.mjs`, ADR 011), sinon le test de péremption échoue.
- Le dépôt est public (ADR 018) : aucun jeu de données réel dans les tests ni les fiches.

## 8. Pièges à traiter

1. **Fusion de deux appareils** : `mergeList` remplace une tâche entière par id ; deux appareils peuvent chacun ajouter un lien qui forme un cycle une fois réunis. D'où `breakCycles` à la lecture, avec un ordre fixe.
2. **Widgets des utilisateurs existants** : `sanitizeSettings` conserve la liste stockée, donc les nouveaux widgets n'apparaîtront pas sur Home. Prévoir un numéro de version des widgets et ajouter une seule fois les nouveaux identifiants.
3. **Suppression en cascade** : `removeTodo` doit nettoyer `blockedBy` des autres tâches, et `removeProject` les `projectId` ; les marqueurs de suppression (`recordDeletions`) s'occupent seuls des ids disparus.
4. **Doublons dans les totaux** : ne compter que les tâches de niveau 1 dans `rollup` et dans les rapports, sinon une sous-tâche pèse deux fois.
5. **Tâches sans `doneAt`** (terminées avant TS1) : exclues de la courbe hebdomadaire, mais comptées dans le donut et les barres par cours. Le dire dans l'interface.
6. **Poids de `localStorage`** : `sessions` est déjà plafonné à 20 000 entrées ; garder `blockedBy` à 20 et `links` à 100.
7. **Calendrier** : la date d'un parent n'est pas calculée à partir de ses sous-tâches (comportement voulu, ADR 020) ; seule la progression remonte.

## 9. Hors périmètre (pour plus tard)

Vue chronologie (Gantt), jalons, chemin critique complet, règles d'automatisation (« quand A est terminée, passer B en cours »), pondération de la progression par `effort`, partage entre utilisateurs.
