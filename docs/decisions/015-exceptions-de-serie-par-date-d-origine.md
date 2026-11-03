# ADR-015 — Exceptions d'une série rangées par date d'origine

**Statut :** Acceptée · **Date :** octobre 2026

## Contexte

Modifier ou supprimer une seule occurrence d'un événement répété est une demande courante. Il faut un modèle simple, exportable en `.ics`, qui ne duplique pas la série.

## Décision

L'événement garde un objet `exceptions` indexé par la **date d'origine** de l'occurrence : `{ deleted: true }` pour la supprimer, ou des champs qui remplacent ceux de la série (`title`, `date`, `start`, `end`, `location`, `description`). `occurrenceOn(événement, jour)` calcule l'occurrence qui commence un jour donné en tenant compte des exceptions, y compris une occurrence **déplacée** vers un autre jour. L'export `.ics` écrit `EXDATE` pour les suppressions et un `VEVENT` avec `RECURRENCE-ID` pour les modifications.

## Alternatives rejetées

- **Scinder la série (« cet événement et les suivants »)** : crée de nouveaux événements, difficile à annuler.
- **Une entrée par occurrence matérialisée** : explose en nombre.
- **Aucune exception** : jugé insuffisant.

## Conséquences

- Si on change la règle de répétition de la série, les exceptions peuvent ne plus tomber sur une occurrence existante (elles restent inertes).
- Une occurrence déplacée reste rangée sous sa **date d'origine** ; `occurrenceOn` la retrouve à sa nouvelle date.
- Le déplacement par glisser d'une occurrence d'une série crée une exception ; un message le rappelle.

## Code concerné

- `js/calendar-logic.js`
- `js/ics.js`
- `js/modules/calendar.js`
- `tests/agenda.test.js`
