# ADR-014 — Une session Focus est liée à une tâche OU à un événement, jamais aux deux

**Statut :** Acceptée · **Date :** octobre 2026

## Contexte

Une session de concentration peut porter sur un devoir ou sur un cours. L'ancienne version permettait de lier les deux, ce qui rendait les statistiques et la planification ambiguës.

## Décision

**Une session (et une session planifiée) est liée à au plus un élément : une tâche OU un événement.** La règle est appliquée par `exclusiveLink` (la tâche l'emporte si les deux sont fournis), dans l'interface (choisir l'un vide l'autre), à la préparation depuis un menu, et à la validation des données importées.

## Alternatives rejetées

- **Lier tâche et événement** : ambigu, double comptage dans les statistiques.
- **Lier plusieurs tâches** : complexité sans besoin exprimé.

## Conséquences

- Une tâche qui a un événement lié n'envoie plus cet événement à la session : on lance le Focus sur la tâche, ou sur l'événement.
- Les **sessions planifiées** importées avec les deux liens sont corrigées silencieusement (la tâche est conservée) ; les anciennes sessions **terminées** peuvent encore porter les deux liens (l'historique n'est pas réécrit).

## Code concerné

- `js/work-logic.js`
- `js/modules/focus.js`
- `js/ui/focus-plan.js`
- `js/store.js`
