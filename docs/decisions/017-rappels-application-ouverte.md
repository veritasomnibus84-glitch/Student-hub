# ADR-017 — Rappels seulement quand l'application est ouverte

**Statut :** Acceptée · **Date :** octobre 2026

## Contexte

Les rappels d'événements sont attendus même application fermée. Cela demande une notification poussée par un serveur.

## Décision

Les rappels se déclenchent **uniquement quand Student Hub est ouvert** : `startReminders` vérifie régulièrement les événements proches et affiche un toast (et une notification du navigateur si elle est autorisée). L'interface le dit explicitement (Paramètres, guide).

## Alternatives rejetées

- **Web Push** : exige un serveur de notifications et des clés VAPID, hors du périmètre sans serveur (piste : T20).
- **API Notification Triggers** : expérimentale, non disponible dans les navigateurs courants.
- **Synchronisation périodique en arrière-plan** : réservée à certaines installations, aucune garantie d'heure.

## Conséquences

- Avec la PWA installée, l'app peut être ouverte rapidement, mais **aucun rappel ne sonne application fermée**.
- Un réglage permet de désactiver les rappels (`settings.notify.reminders`).

## Code concerné

- `js/reminders.js`
- `js/calendar-logic.js`
- `js/modules/settings-ui.js`
