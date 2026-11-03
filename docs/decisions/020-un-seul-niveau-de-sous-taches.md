# ADR-020 — Un seul niveau de sous-tâches

**Statut :** Acceptée · **Date :** octobre 2026

## Contexte

Le suivi de projets demande des sous-tâches. Asana en permet plusieurs niveaux ; sur un téléphone, une arborescence profonde est illisible et sa progression demande de la récursion.

## Décision

Une tâche peut avoir des sous-tâches, **mais une sous-tâche ne peut pas en avoir** : `parentId` désigne une tâche de niveau 1. Une tâche qui a des enfants ne peut pas devenir enfant. À la lecture d'une sauvegarde, `fixParents` ramène à `''` tout `parentId` orphelin, égal à la tâche elle-même, ou pointant vers une sous-tâche. La progression d'un parent est la part de ses sous-tâches terminées ; dans les rapports et les projets, seules les tâches de niveau 1 comptent, pour qu'une sous-tâche ne pèse pas deux fois. La sous-tâche hérite du cours et du projet du parent, mais garde sa propre deadline.

## Alternatives rejetées

- **Plusieurs niveaux** : récursion dans la progression, la suppression et la fusion de deux appareils ; affichage difficile sur 390 px.
- **Une liste de cases à cocher dans la tâche** : plus simple, mais une sous-tâche n'aurait ni deadline, ni statut, ni dépendance.
- **Calculer la date du parent à partir de ses sous-tâches** : surprenant ; seule la progression remonte.

## Conséquences

- Aucune boucle possible entre parents et enfants.
- Une personne qui veut une structure plus profonde crée un projet.
- Voir [workspace-sous-taches-et-dependances](../features/workspace-sous-taches-et-dependances.md).

## Code concerné

- `js/tasks-logic.js`
- `js/store.js`
- `js/ui/todo-actions.js`
