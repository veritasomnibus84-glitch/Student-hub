# Plan : Student Hub

Ordre = dépendances. Une tranche verticale à la fois : implémenter, tester, vérifier, commit.

## Fait (v0.1)
- [x] T1 Coque : index.html, onglets par hash, thèmes clair/sombre, CSP.
- [x] T2 Données : store (localStorage), validation à la lecture/import, export/import JSON. Tests.
- [x] T3 Workspace : cours (champs du template Notion), kanban 4 colonnes, filtre, tri, recherche, feuille modale. Tests.
- [x] T4 Notes : créer, rattacher à un cours/Général, épingler, réordonner.
- [x] T5 Liens : catégories, description, validation d'URL.
- [x] T6 Messages : lecture de data/summaries.json, filtre source, lu/non lu.
- [x] T7 Vidéos : grille par chaîne, script RSS + Action quotidienne. Tests du parseur.
- [x] Vérification navigateur réel (mobile, clair et sombre) : aucune erreur console, persistance OK.

- [x] T13 Bibliothèque : import PDF, couvertures, 5 sections, 4 vues, tri/regroupement, lecteur pdf.js, signets, progression, rattachement multi-appareils par nom+taille. Tests unitaires + test navigateur réel.

- [x] T14 Agenda : semaine/mois/année, événements (répétition, rappels, journée entière), agendas colorés, recherche, import/export .ics, to-dos et examens affichés.
- [x] T15 Home : heure, recherche globale (T11 en partie), aujourd'hui/à venir, mini-calendrier, tâches, récents, note du jour.
- [x] T16 Verrou d'accès (nom + mot de passe), logo minimaliste, suppression d'un cours et d'un to-do.

- [x] T17 Focus : minuteur, arbre en 5 stades, échec si l'app est quittée, tags, tâche/événement liés, statistiques jour/semaine/mois/année.
- [x] T18 Relations événement ↔ tâches ↔ notes, planification d'une tâche en événement.
- [x] T19 Import/export par onglet + sauvegarde complète dans Home.

- [x] T9 Mémorisation (v1, ex-Révision) : leçons, cartes question/réponse et QCM, FSRS-6 (paramètres vérifiés contre py-fsrs), session avec 3 boutons et intervalles, génération par prompt + JSON collé. Tests.

## À faire
- [ ] T8 Synchro GitHub (le catalogue de la bibliothèque en fait partie, pas les PDF) sans token dans le navigateur : l'app charge `data/state.json` du repo (lecture), l'export JSON se commit depuis OpenCode/Codespaces ou une Action.
      Critère : état identique sur téléphone et PC après commit + rechargement.
- [x] T9b Mémorisation, suite : examen chronométré + correction, planning, série, cartes à trous / V-F, dues dans Home. Étapes 1-2 du plan (3 sous-onglets, couches, import CSV, vue grille).
- [x] T10 Objectifs et conseils (guide pré-rempli).
- [x] T10b Menus contextuels, widgets, Paramètres, synchronisation Supabase (v1 manuelle, sans marqueurs de suppression).
- [ ] T10c Synchronisation : marqueurs de suppression, synchro automatique à l'ouverture.
- [ ] T11 Chat tuteur (fds-tutor.md : prompt + blocs sources/profil/plan_session, collage de la réponse, lecture du session_log).
- [ ] T12 Apprendre : fiches (4 styles x 4 longueurs), podcast (script + voix du navigateur), cartographie en couches.
- [ ] T13 Planning dans l'Agenda, XP/niveaux.
- [ ] T10 PWA installable (manifest + service worker), mode hors ligne.
- [ ] T11 Agenda : créer par glisser, modifier une seule occurrence d'une série, événements sur plusieurs jours.
- [ ] T12 Import de cartes depuis PDF/texte (génération via un modèle côté script, jamais de clé dans le navigateur).
