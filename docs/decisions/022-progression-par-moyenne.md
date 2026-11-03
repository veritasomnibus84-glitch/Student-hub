# ADR-022 — La progression remonte par moyenne, à poids égal

**Statut :** Acceptée · **Date :** octobre 2026

## Contexte

Les objectifs ne mesuraient que le temps écoulé. Pour suivre le travail réel (sous-tâches → tâche → projet → objectif), il faut une règle de remontée simple et prévisible.

## Décision

L'avancement d'une tâche est 0 ou 1, ou la part de ses sous-tâches terminées. L'avancement d'un projet ou d'un cours est la **moyenne** de celui de ses tâches de niveau 1. Un objectif « automatique » fait la moyenne des éléments reliés (projets, cours, tâches) ; un objectif « manuel » utilise un curseur ; le mode « temps » reste celui de l'ancienne version (les objectifs existants ne changent pas). Le **statut** compare le travail au temps écoulé : écart d'au plus 10 points → « Dans les temps », jusqu'à 25 → « À risque », au-delà → « En retard » ; « Atteint » à 100 %. L'`effort` estimé sert à la charge de travail, pas à pondérer.

## Alternatives rejetées

- **Pondérer par l'effort** : exige que toutes les tâches soient estimées ; reporté.
- **Compter toutes les sous-tâches comme des tâches** : une tâche découpée pèserait plus qu'une tâche équivalente non découpée.
- **Remplacer le temps écoulé** : casse les objectifs existants.

## Conséquences

- Un lien vers un élément supprimé est ignoré dans la moyenne et signalé « Lien cassé ».
- Un projet sans tâche vaut 0 %.

## Code concerné

- `js/goals-logic.js`
- `js/tasks-logic.js`
- `js/modules/goals.js`
