# SPEC : Student Hub

## Objectif
Une seule page web (HTML/CSS/JS, sans framework ni build) qui centralise la vie d'étudiant :
Home, Workspace (cours + to-dos façon Notion), Agenda, Focus (minuteur à arbre), Mémorisation (cartes à répétition espacée), Bibliothèque de PDF, Messages (résumés Gmail/WhatsApp faits par Hermes),
Vidéos (chaînes YouTube choisies), Notes, Liens utiles, Objectifs et conseils, Paramètres. Minimaliste, modulaire, sans friction.
Utilisateur : un étudiant, surtout sur téléphone (mobile-first).

## Hypothèses (à corriger si faux)
1. Usage personnel, un seul utilisateur, pas de comptes.
2. Données éditables (cours, to-dos, notes, liens) : stockées dans le navigateur (localStorage) + export/import JSON.
3. Données produites par des scripts (messages Hermes, vidéos) : fichiers JSON du repo, lus en lecture seule.
4. « Placer les notes où on veut » = rattacher une note à un cours ou à « Général », épingler, réordonner.
5. Pas de token GitHub dans le navigateur (le skill sécurité l'interdit) : la synchro GitHub passe par des fichiers/Actions, voir tasks/plan.md.

6. Bibliothèque : les fichiers PDF restent par appareil (IndexedDB), jamais dans le repo (droits d'auteur, taille). Seul le catalogue est partagé.

7. Verrou d'accès : écran de connexion local (PBKDF2), sans chiffrement des données ; ne remplace pas une vraie authentification.
8. Agenda : rappels uniquement app ouverte ; pas de synchronisation en ligne (import/export .ics).

9. Focus : l'arbre meurt si la page est invisible plus de 10 s (API Page Visibility) ; chronomètre fondé sur l'heure réelle ; session en cours persistée.
10. Import/export : un panneau par onglet (ses seules données) et une sauvegarde complète depuis Home ; les PDF ne sont jamais exportés.
11. Relations : événement 1-n tâches, 1-n notes ; une tâche peut être planifiée comme événement.

12. Mémorisation : leçons et cartes (question/réponse, QCM) planifiées par FSRS-6 (paramètres de py-fsrs). Pas de clé IA dans le navigateur : on copie un prompt, on le donne à une IA, on colle le JSON renvoyé.

13. Objectifs : objectifs à x mois/ans et conseils ; le guide d'utilisation est pré-rempli une seule fois (tipsSeeded).
14. Menu contextuel unique (clic droit, appui long 500 ms, bouton ⋯), sans innerHTML.
15. Widgets : blocs de Home réutilisables, barre repliable en bas de chaque onglet, réglages dans `settings`.
16. Synchronisation Supabase facultative : fetch seulement, aucun token GitHub ; identifiants hors sauvegardes ; fusion par identifiant (ne supprime rien) ou remplacement explicite.

## Commandes
- Tests : `npm test`
- Lancer en local : `python3 -m http.server 8080` puis http://localhost:8080 (les modules ES ne marchent pas en file://)
- Mettre à jour les vidéos : `node scripts/fetch-videos.mjs`

## Structure
index.html, css/ (base, components), js/ (app, store, kanban, dom, constants, modules/, ui/),
data/ (summaries.json, channels.json, videos.json), scripts/, tests/, tasks/.

## Modules (un fichier chacun, contrat : `render(ctx) -> Element`)
home, workspace, calendar, focus, revision, library, messages, videos, notes, links, goals, settings. Ajouter un onglet = ajouter un module + une ligne dans app.js.

## Style de code
ES modules, fonctions pures dans store.js/kanban.js (testables), DOM construit avec `h()` (jamais innerHTML).

## Tests
node:test + jsdom : logique pure (store, kanban, flux RSS) et rendu de chaque module.

## Limites
- Toujours : échapper le contenu (textContent), valider les URL (http/https), CSP stricte.
- Jamais : secrets dans le repo, innerHTML avec données, clone du design/code d'une autre app.

## Critères de réussite
- Les 12 onglets s'affichent, aussi sans données.
- To-dos : créer, modifier, filtrer, trier, avancer de statut ; persistance après rechargement.
- Export puis import redonne le même état.
- Tous les tests passent.
