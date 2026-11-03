# ADR-007 — Génération par IA par copier-coller, aucune clé dans le navigateur

**Statut :** Acceptée · **Date :** octobre 2026

## Contexte

Les cartes, fiches, podcasts, couches, corrections et sessions de tuteur sont produits par une IA. Appeler une API depuis un site statique exige une clé secrète, visible de tout visiteur.

## Décision

L'app **construit des prompts** (catalogue de prompts fondés sur la recherche, `docs/fds-tutor.md`) que l'étudiant **copie** dans son IA (Claude, ChatGPT…), puis **colle la réponse** dans l'app. Chaque réponse est lue par un analyseur strict (`parseCards`, `parseLayers`, `parseSessionLog`, `parseScores`…) qui valide et borne.

## Alternatives rejetées

- **Clé API dans le navigateur** : exposée, facturable par n'importe qui.
- **Fonction serverless qui garde la clé** : bon compromis, mais un serveur à maintenir et à protéger (reste une option, tâche T20/MCP).
- **IA locale dans le navigateur (WebLLM)** : jugée trop lourde pour un téléphone, qualité incertaine.
- **MCP** : prévu pour l'avenir ([plan-mcp](../plans/plan-mcp.md)), mais une version locale ne sert pas le chat web.

## Conséquences

- L'étudiant fait des allers-retours manuels ; c'est le prix de l'absence de serveur.
- Toute réponse d'IA est **non fiable** : elle est validée, tronquée, et l'interface invite à la relire avant de la garder.
- Les prompts sont testés (présence de la source, de la langue, du schéma attendu).

## Code concerné

- `js/revision-logic.js`
- `js/study-logic.js`
- `js/tutor-logic.js`
- `tests/tutor.test.js`
