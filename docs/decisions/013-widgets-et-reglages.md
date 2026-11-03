# ADR-013 — Widgets réutilisables et réglages dans l'état

**Statut :** Acceptée · **Date :** octobre 2026

## Contexte

Home regroupait des blocs (aujourd'hui, tâches, Focus…) que l'étudiant voulait retrouver en bas de chaque onglet, dans l'ordre de son choix.

## Décision

Chaque bloc est un **widget** (`id`, titre, fonction de rendu). Un réglage `settings.widgets[onglet]` liste les widgets affichés et leur ordre, pour Home et pour chaque onglet. Un widget **n'apparaît jamais dans l'onglet dont il est le contenu** (`HIDE_ON`). La personnalisation se fait par cases à cocher et flèches ↑ ↓. Les réglages sont dans `state.settings`, validés, exportés avec les données.

## Alternatives rejetées

- **Home fixe** : ne répond pas à la demande.
- **Glisser-déposer des widgets** : fragile au doigt ; écarté pour l'instant.
- **Un tableau de bord différent par onglet, codé en dur** : duplication.

## Conséquences

- Les réglages sont **propres à chaque appareil** à la fusion de synchronisation ([ADR-010](010-fusion-par-identifiant-et-marqueurs.md)).
- Ajouter un widget = une entrée dans `WIDGETS` et une fonction de rendu ; ajouter un onglet = l'ajouter à `TARGETS`.

## Code concerné

- `js/ui/widgets.js`
- `js/settings-logic.js`
- `js/modules/home.js`
