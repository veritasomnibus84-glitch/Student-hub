# Plan MCP pour Student Hub

Objectif : qu'une IA (OpenCode, Claude Code, Hermes) puisse **lire** l'état de Student Hub et **y ajouter** du contenu (cartes, to-dos, événements, notes, objectifs, conseils, journal du tuteur), sans jamais mettre de token GitHub dans le navigateur.

## 1. Le problème à résoudre

- Les données éditables vivent dans le `localStorage` du navigateur de chaque appareil. Un serveur MCP ne peut pas les lire.
- Le serveur MCP tourne sur un ordinateur (PC, Codespaces), pas sur le téléphone.
- Le site est statique (GitHub Pages) : il peut lire des fichiers du dépôt, mais ne peut pas y écrire.
- Tu as déjà eu une erreur de merge : le plan doit éviter que deux écrivains modifient le même fichier.

## 2. Décision d'architecture : instantané + boîte de réception

```
App (téléphone) ──exporte──▶ data/snapshot.json ──lu par──▶ MCP (lecture)
MCP (écriture)  ──ajoute──▶ data/inbox/<id>.json + index ──lu par──▶ App (« Appliquer »)
```

- **snapshot.json (app → MCP)** : la sauvegarde complète que l'app sait déjà exporter (même enveloppe `{ app: 'student-hub', kind, version, data }`). Tu l'exportes, tu le déposes dans `data/`, commit et push. Le MCP lit ce fichier, jamais le navigateur. Chaque réponse du MCP indique l'âge de l'instantané.
- **inbox (MCP → app)** : le MCP n'écrit **jamais** dans l'état. Il ajoute des **opérations** (un petit fichier par opération). L'app les lit, te les montre, puis les applique sur ta demande.
- Pourquoi un fichier par opération : deux machines qui ajoutent des opérations ne se marchent pas dessus, donc pas de conflit de merge.
- Pourquoi pas un `state.json` unique : deux sources de vérité, risque d'écraser tes données du téléphone.

## 3. Contrats de données

### 3.1 Opération (un fichier `data/inbox/<id>.json`)
```json
{
  "id": "op-20261022-103000-a1b2",
  "version": 1,
  "at": "2026-10-22T10:30:00Z",
  "source": "opencode",
  "op": "cards.add",
  "needsConfirm": false,
  "payload": { "deckId": "d1", "cards": [ { "type": "qa", "front": "…", "back": "…", "layer": "core" } ] }
}
```
- `id` fixé par le MCP, jamais réutilisé : appliquer deux fois la même opération ne fait rien (idempotence).
- `index` : `data/inbox/index.json` = liste des noms de fichiers (le site ne peut pas lister un dossier). Le MCP le régénère à chaque écriture ; une commande `reindex` le reconstruit.

### 3.2 Types d'opérations (v1)
| op | Effet dans l'app |
|---|---|
| `todo.add`, `todo.update` | to-do (cours, statut, deadline) |
| `event.add`, `event.link_task` | événement ; lier une tâche existante |
| `note.add` | morceau de note (cours, événement) |
| `link.add` | lien utile |
| `deck.add`, `deck.update` | leçon (nom, cours, examen, note visée, source du cours) |
| `cards.add` | cartes d'une leçon (6 types) |
| `gap.add` | blocage dans le journal |
| `goal.add` | objectif (durée en mois ou ans) |
| `tip.add` | conseil |
| `session.log` | journal d'une session du tuteur (notions maîtrisées, faibles, blocages) |
| `delete.request` | **demande** de suppression : toujours `needsConfirm: true` |

### 3.3 Côté app
- Nouvelle clé d'état `appliedOps` (liste d'identifiants, plafonnée) : exportée avec les données.
- Panneau « Boîte de réception » dans Home (Sauvegarde et données) :
  1. « Vérifier » : télécharge `index.json` puis les opérations (`fetch` vers le même site, autorisé par la CSP `connect-src 'self'`, avec `cache: 'no-store'`).
  2. Aperçu en texte (rien n'est appliqué) : « 15 cartes dans Cinématique », « 1 to-do »…
  3. « Appliquer » : chaque opération passe par les **mêmes fonctions de validation** que les imports actuels.
  4. Les opérations `needsConfirm` demandent un clic individuel.
  5. Opération invalide ou dont la cible n'existe plus : ignorée et listée, jamais bloquante.
- Bouton « Exporter l'instantané » : produit `snapshot.json`.

## 4. Le serveur MCP

### 4.1 Technique
- Dossier `mcp/` avec son propre `package.json` (l'app reste sans dépendance ni build).
- SDK TypeScript officiel du MCP + `zod` ; versions épinglées exactement.
- Transport **stdio** uniquement : aucun port ouvert, aucun réseau.
- Réutilise les modules purs de `js/` (`revision-logic.js`, `goals-logic.js`, `planning.js`, `fsrs.js`, `data-io.js`) : **une seule source de vérité** pour la validation et le planning.

### 4.2 Outils de lecture (depuis l'instantané)
Chaque réponse contient `snapshot_age_days` ; avertissement si l'instantané a plus de 3 jours. Listes paginées (`limit` 50 par défaut, 200 maximum).

| Outil | Rôle |
|---|---|
| `get_overview` | comptes par onglet, cartes dues, série, prochains examens |
| `list_courses`, `get_course` | cours et leurs champs |
| `list_todos` | filtres : cours, statut, deadline |
| `list_events` | plage de dates |
| `list_notes`, `list_links` | notes et liens |
| `list_decks`, `get_deck` | leçons, source du cours, paramètres d'examen |
| `list_due_cards` | cartes à réviser (par leçon) |
| `get_study_plan` | planning calculé par `planning.js` pour une leçon |
| `get_exam_history`, `list_gaps` | examens et blocages |
| `list_goals`, `list_tips` | objectifs et conseils |
| `get_focus_stats` | statistiques Focus sur une période |
| `search` | recherche globale |

### 4.3 Outils d'écriture (ajoutent des opérations)
`add_todo`, `update_todo`, `add_event`, `link_task_to_event`, `add_note`, `add_link`, `create_deck`, `update_deck`, `set_deck_source`, `add_cards` (40 cartes par appel maximum), `add_gap`, `add_goal`, `add_tip`, `submit_session_log`, `request_delete`.
- Chaque entrée est validée avec les mêmes fonctions que l'app avant d'écrire.
- Réponse : l'identifiant de l'opération et ce qui sera appliqué. Rien n'est « fait » tant que tu n'as pas appliqué dans l'app : le dire clairement dans la description de l'outil.
- Annotations MCP : outils de lecture marqués en lecture seule ; `request_delete` marqué destructif.

### 4.4 Ressources et prompts
- Ressources : `studenthub://spec` (SPEC.md), `studenthub://guide` (les 19 conseils), `studenthub://tutor-prompt` (`fds-tutor.md`), `studenthub://snapshot-info`.
- Prompts : `generate_cards` (les prompts du catalogue, par type), `build_tutor_session`, `weekly_review`, `make_mock_exam`, `after_session`.

### 4.5 Lien avec le tuteur (`fds-tutor.md`)
- `build_tutor_session(deckId, mode, minutes)` assemble les blocs que le tuteur attend (`<sources>`, `<profil_etudiant>`, `<plan_session>`) à partir de l'instantané et du planning de la leçon.
- `submit_session_log(log)` écrit une opération `session.log` : l'app met à jour notions maîtrisées, faibles et blocages.
- À vérifier contre `fds-tutor.md` au moment de coder : noms exacts des blocs, format du `session_log`, traitement du marqueur `[DARACE]`.

## 5. Phases

| # | Contenu | Taille | Critère de fin |
|---|---|---|---|
| 0 | Erreur de merge réglée, site en ligne avec la dernière version | S | 11 onglets visibles |
| 1 | Contrats : `snapshot.json`, opérations, `appliedOps`, panneau « Boîte de réception », export de l'instantané | M | Test : opération → aperçu → application → état correct ; rejouer ne change rien |
| 2 | Serveur MCP en lecture seule : 15 outils, ressources, config OpenCode et Claude Code | M | L'IA liste tes cartes dues depuis un instantané réel |
| 3 | Écriture : outils `add_*`, fichiers d'opérations, index, `needsConfirm`, validation partagée | L | Aller-retour complet : MCP écrit → app applique → contenu visible |
| 4 | Mémorisation avancée : `generate_cards`, `build_tutor_session`, `submit_session_log`, `get_study_plan`, `make_mock_exam` | L | Une session de tuteur complète met à jour tes notions faibles |
| 5 | Automatisation : option `--autocommit` (pull --rebase puis commit puis push), Action GitHub de contrôle (opérations valides, aucun marqueur `<<<<<<<`) | M | Un push cassé est refusé par l'Action |
| 6 | Durcissement et docs : revue de sécurité, README, conseil de guide « Le MCP », dépannage | S | Checklist de la section 7 cochée |

Chaque phase commence par les tests (même méthode que le reste de l'app).

## 6. Branchement (à vérifier dans la doc de ta version)

- **Claude Code :** `claude mcp add student-hub -- node mcp/server.mjs` (depuis la racine du dépôt).
- **OpenCode :** déclarer un serveur MCP local dans la configuration du projet, commande `node mcp/server.mjs`. Le format exact dépend de ta version d'OpenCode 2.0 : le confirmer dans sa documentation avant d'écrire la configuration.
- Le MCP tourne **là où tu lances l'outil** (PC ou Codespaces), pas sur le téléphone.
- Flux au quotidien : exporter l'instantané depuis l'app → push → demander à l'IA → push des opérations → « Vérifier » puis « Appliquer » dans l'app.

## 7. Sécurité (checklist)

- Stdio seulement ; aucun réseau, aucun token.
- Chemins confinés au dépôt : tout chemin résolu est vérifié avant lecture ou écriture.
- Limites de taille : fichier d'instantané, longueur des champs (mêmes limites que les validateurs de l'app), 40 cartes par appel.
- **Contenu non fiable :** notes, résumés d'e-mails (Hermes) et textes de cours peuvent contenir des instructions cachées. Les sorties du MCP les présentent comme des **données**. Les résumés de messages sont **désactivés par défaut** (option `--include-messages`).
- Aucune suppression silencieuse : `request_delete` exige ton clic dans l'app.
- Écritures atomiques (fichier temporaire puis renommage).
- Le MCP ne lit ni ne modifie `summaries.json`, `videos.json` ni `channels.json`.
- Aucune opération ne s'applique sans ton clic dans l'app.

## 8. Arborescence prévue

```
mcp/
  package.json
  server.mjs            (point d'entrée, stdio)
  src/snapshot.mjs      (lecture + âge de l'instantané)
  src/ops.mjs           (création des opérations, index, atomicité)
  src/tools-read.mjs
  src/tools-write.mjs
  src/prompts.mjs
  tests/
js/
  inbox.js              (aperçu + application, côté app)
data/
  snapshot.json
  inbox/index.json
  inbox/<id>.json
```

## 9. Hors périmètre (et pourquoi)

- Synchronisation automatique app → dépôt : exigerait un token ou un serveur. Reste manuelle (export).
- MCP distant (HTTP) accessible depuis le téléphone : possible plus tard avec un petit serveur qui garde la clé côté serveur. Ajoute un hébergement à maintenir : pas recommandé maintenant.
- Notifications app fermée : il faut une PWA et un serveur de notifications.

## 10. Décisions à confirmer

1. Instantané exporté à la main, ou rappel dans l'app quand il a plus de 3 jours ?
2. `--autocommit` activé par défaut ou non ? (recommandé : non au début)
3. Messages Hermes lisibles par le MCP ? (recommandé : non)
4. Où lance-t-on le MCP : PC, Codespaces, ou les deux ?
5. Fichier par opération (recommandé) ou un seul `inbox.json` ?

## Note : champs ajoutés aux to-dos par le suivi de projets

Quand `todo.add` et `todo.update` seront réalisés, ils devront accepter `parentId`, `blockedBy`, `effort` et `projectId`, et appliquer les mêmes règles que l'application : un seul niveau de sous-tâches, pas de boucle de dépendances, `doneAt` posé par `setStatus` (jamais écrit à la main). Voir `docs/plans/plan-suivi-projets.md`.
