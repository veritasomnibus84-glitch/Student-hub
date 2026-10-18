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

## À faire
- [ ] T8 Synchro GitHub sans token dans le navigateur : l'app charge `data/state.json` du repo (lecture), l'export JSON se commit depuis OpenCode/Codespaces ou une Action.
      Critère : état identique sur téléphone et PC après commit + rechargement.
- [ ] T9 Révision : cartes + FSRS-5 (vérifier les paramètres contre l'implémentation de référence), mode examen chronométré, série quotidienne.
- [ ] T10 PWA installable (manifest + service worker), mode hors ligne.
- [ ] T11 Recherche globale ; calendrier des deadlines.
- [ ] T12 Import de cartes depuis PDF/texte (génération via un modèle côté script, jamais de clé dans le navigateur).
