# ADR-012 — Un seul menu contextuel : clic droit, appui long, bouton ⋯

**Statut :** Acceptée · **Date :** octobre 2026

## Contexte

Les actions (modifier, dupliquer, copier, supprimer, planifier…) devaient être accessibles sur tous les éléments, sur ordinateur comme sur téléphone, où le clic droit n'existe pas.

## Décision

Un composant unique, `attachMenu(element, getItems)`, ouvre le même menu par **clic droit**, par **appui long de 500 ms** (tactile) ou par le bouton **⋯** (`menuButton`). Chaque onglet fournit seulement sa liste d'actions. Pour les éléments imbriqués (une plage de travail dans un événement), **seul l'élément le plus profond ouvre son menu** (marqueur sur l'événement). Le clic qui suit un appui long est ignoré.

## Alternatives rejetées

- **Boutons d'action visibles sur chaque élément** : encombrement sur mobile.
- **Un menu par module** : duplication, comportements différents.
- **Bibliothèque de menus** : dépendance inutile.

## Conséquences

- Les actions destructrices demandent toujours confirmation.
- Le menu se ferme au défilement, à `Échap` et à un appui ailleurs ; navigation aux flèches.
- Le déplacement par glisser dans l'Agenda n'est pas disponible au doigt (il entrerait en conflit avec l'appui long).

## Code concerné

- `js/ui/context-menu.js`
- `tests/ux.test.js`
