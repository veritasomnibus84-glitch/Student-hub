# ADR-019 — Prompt du tuteur : source en Markdown, fichier JavaScript généré et testé

**Statut :** Acceptée · **Date :** octobre 2026

## Contexte

Le prompt système du tuteur (`docs/fds-tutor.md`) est un document de 16 Ko, écrit et relu comme du texte. L'app doit l'embarquer, hors ligne, sans le réécrire à la main.

## Décision

`docs/fds-tutor.md` est la **source**. `scripts/build-tutor-prompt.mjs` la convertit en `js/tutor-prompt.js` (`export default <chaîne JSON>`). `systemPrompt()` retire à l'exécution l'en-tête, les notes de conception et la section « vault », inutiles à l'élève. `tests/tutor.test.js` **vérifie que le fichier généré est identique à la source**.

## Alternatives rejetées

- **Charger le `.md` au runtime (`fetch`)** : dépend du réseau et du chemin, une requête de plus.
- **Copier le texte à la main dans un module** : dérive garantie.
- **Générer sans test** : le fichier généré pourrait être périmé sans que rien ne le signale.

## Conséquences

- Après modification de `docs/fds-tutor.md`, lancer **`npm run build:tutor`** (puis `npm run build:sw`) ; le test échoue sinon.
- Le contexte envoyé au tuteur (blocs `<profil_etudiant>`, `<plan_session>`, `<sources>`…) est construit par code ([tutor-logic](../../js/tutor-logic.js)), pas dans le prompt.

## Code concerné

- `docs/fds-tutor.md`
- `scripts/build-tutor-prompt.mjs`
- `js/tutor-prompt.js`
- `js/tutor-logic.js`
