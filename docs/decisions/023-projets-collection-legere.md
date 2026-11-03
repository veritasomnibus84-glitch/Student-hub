# ADR-023 — Les projets sont une collection légère, distincte des cours

**Statut :** Acceptée · **Date :** octobre 2026

## Contexte

Les objectifs doivent se relier à du travail borné. Un cours dure un semestre et regroupe tout ; un dossier d'informatique ou la révision d'un partiel est un travail avec une échéance.

## Décision

Collection `projects` : `{ id, name, courseId, deadline, color, archived }`. Une tâche porte `projectId` (vide si aucun) ; un objectif relie un projet par `links`, dans un seul sens, pour éviter deux sources de vérité. Les projets voyagent avec la section d'export « Workspace » et ont des marqueurs de suppression. Supprimer un projet **conserve** ses tâches ; à la lecture, un `projectId` inconnu est vidé. La vue Projets est un sélecteur de Workspace (Tableau · Projets · Rapports) : **pas de 13e onglet**.

## Alternatives rejetées

- **Réutiliser les cours** : un cours n'a pas d'échéance de travail et mélange tout.
- **Un nouvel onglet** : douze onglets suffisent déjà sur 390 px.
- **`goalId` sur le projet** : doublon avec `links`.

## Conséquences

- L'import d'un ancien fichier Workspace sans `projects` ne vide pas les projets existants.
- Voir [workspace-projets](../features/workspace-projets.md).

## Code concerné

- `js/store.js`
- `js/modules/projects.js`
- `js/modules/workspace.js`
- `js/tombstones.js`
- `js/data-io.js`
