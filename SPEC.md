# SPEC : Student Hub

## Objectif
Une seule page web (HTML/CSS/JS, sans framework ni build) qui centralise la vie d'étudiant :
Workspace (cours + to-dos façon Notion), Messages (résumés Gmail/WhatsApp faits par Hermes),
Vidéos (chaînes YouTube choisies), Notes, Liens utiles. Minimaliste, modulaire, sans friction.
Utilisateur : un étudiant, surtout sur téléphone (mobile-first).

## Hypothèses (à corriger si faux)
1. Usage personnel, un seul utilisateur, pas de comptes.
2. Données éditables (cours, to-dos, notes, liens) : stockées dans le navigateur (localStorage) + export/import JSON.
3. Données produites par des scripts (messages Hermes, vidéos) : fichiers JSON du repo, lus en lecture seule.
4. « Placer les notes où on veut » = rattacher une note à un cours ou à « Général », épingler, réordonner.
5. Pas de token GitHub dans le navigateur (le skill sécurité l'interdit) : la synchro GitHub passe par des fichiers/Actions, voir tasks/plan.md.

## Commandes
- Tests : `npm test`
- Lancer en local : `python3 -m http.server 8080` puis http://localhost:8080 (les modules ES ne marchent pas en file://)
- Mettre à jour les vidéos : `node scripts/fetch-videos.mjs`

## Structure
index.html, css/ (base, components), js/ (app, store, kanban, dom, constants, modules/, ui/),
data/ (summaries.json, channels.json, videos.json), scripts/, tests/, tasks/.

## Modules (un fichier chacun, contrat : `render(ctx) -> Element`)
workspace, messages, videos, notes, links. Ajouter un onglet = ajouter un module + une ligne dans app.js.

## Style de code
ES modules, fonctions pures dans store.js/kanban.js (testables), DOM construit avec `h()` (jamais innerHTML).

## Tests
node:test + jsdom : logique pure (store, kanban, flux RSS) et rendu de chaque module.

## Limites
- Toujours : échapper le contenu (textContent), valider les URL (http/https), CSP stricte.
- Jamais : secrets dans le repo, innerHTML avec données, clone du design/code d'une autre app.

## Critères de réussite
- Les 5 onglets s'affichent, aussi sans données.
- To-dos : créer, modifier, filtrer, trier, avancer de statut ; persistance après rechargement.
- Export puis import redonne le même état.
- Tous les tests passent.
