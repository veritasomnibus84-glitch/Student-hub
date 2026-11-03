# ADR-016 — Événements sur plusieurs jours par une date de fin

**Statut :** Acceptée · **Date :** octobre 2026

## Contexte

Stages, voyages et semaines de révision durent plusieurs jours. Le modèle ne connaissait que des événements d'un jour.

## Décision

Un champ optionnel `endDate` (après `date`, 366 jours au plus). Pour chaque jour, l'élément d'Agenda est : **premier jour** jusqu'à 23:59 ; **jours du milieu** en « journée » ; **dernier jour** depuis 00:00 jusqu'à l'heure de fin. Une série multi-jours couvre ses jours à chaque occurrence. L'export `.ics` utilise `DTEND` (exclusif pour les journées entières).

## Alternatives rejetées

- **Date et heure de fin complètes** : changeait toute la validation et l'affichage existants.
- **Une série d'événements d'un jour** : impossible à éditer d'un bloc.
- **Journées entières uniquement** : insuffisant pour un stage avec des heures.

## Conséquences

- Le tracé par glisser sur plusieurs colonnes crée un événement long ; déplacer par glisser n'est possible que pour un événement d'un seul jour.
- Les plages de travail d'une tâche liée à un événement s'appuient sur ses jours d'activité ([agenda](../features/README.md)).

## Code concerné

- `js/calendar-logic.js`
- `js/ics.js`
- `js/store.js`
- `js/work-logic.js`
