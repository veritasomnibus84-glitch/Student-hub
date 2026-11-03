# ADR-021 — Dépendances « souples »

**Statut :** Acceptée · **Date :** octobre 2026

## Contexte

Une tâche peut devoir attendre une autre (« Faire les exos » après « Lire le cours »). Une application qui interdit d'avancer irrite un étudiant seul, qui connaît sa situation mieux qu'elle.

## Décision

`blockedBy` liste les tâches à finir avant. Une tâche bloquée est **signalée** (carte grisée, pastille « Bloquée », absente de « Prêtes à démarrer ») mais pas interdite : la démarrer ou la terminer demande une **confirmation**. Un réglage « Dépendances strictes » (Paramètres → Travail, désactivé par défaut) refuse à la place. Une sous-tâche hérite du blocage de son parent. Les boucles sont **refusées** à la saisie (`checkBlock`) et **coupées** à la lecture (`breakCycles`, ordre fixe du tableau) : deux appareils peuvent chacun ajouter un lien inoffensif qui forme une boucle une fois réunis.

## Alternatives rejetées

- **Blocage strict par défaut** : bloque l'utilisateur quand la dépendance est devenue fausse.
- **Information seule, sans confirmation** : un blocage ignoré par inadvertance ne sert à rien.
- **Autoriser les boucles et les afficher** : tri topologique et « prêtes » indéfinis.

## Conséquences

- La fusion de deux appareils reste correcte sans coordination : le même résultat partout.
- Le lien perdu lors d'une coupure n'est pas signalé (limite connue).
- 20 blocages au plus par tâche.

## Code concerné

- `js/deps-logic.js`
- `js/ui/todo-actions.js`
- `js/ui/todo-dialog.js`
- `js/store.js`
