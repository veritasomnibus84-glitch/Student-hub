# ADR-002 — Aucun token GitHub dans le navigateur ; données dans localStorage

**Statut :** Acceptée · **Date :** octobre 2026

## Contexte

Pour garder les données entre les appareils, l'idée naturelle est d'écrire dans le dépôt GitHub. Cela demande un jeton d'accès (PAT) dans le navigateur ; ce jeton donnerait accès en écriture au dépôt à toute faille de script. La spécification d'origine l'interdit ([SPEC](../SPEC.md)).

## Décision

**Aucun jeton GitHub n'est jamais saisi ni stocké dans l'app.** Les données modifiables vivent dans `localStorage` (clé `studenthub:v1`). GitHub sert à **publier** le site et à **servir** des données en lecture seule (`data/*.json`, écrites par Hermes ou par une Action GitHub). La synchronisation entre appareils passe par un export/import manuel, puis par Supabase ([ADR-009](009-synchronisation-supabase.md)).

## Alternatives rejetées

- **PAT stocké dans `localStorage`** : exposé à toute injection de script, droits trop larges.
- **OAuth GitHub depuis le navigateur** : l'échange du code exige un serveur qui garde un secret.
- **Écrire dans le dépôt via une Action déclenchée par l'app** : demande quand même un jeton pour déclencher l'Action.

## Conséquences

- ==🟡Une donnée créée sur un appareil n'existe que sur lui tant qu'on n'exporte pas ou qu'on ne synchronise pas.==
- ==🟡Les fichiers `data/*.json` sont lus mais jamais écrits par l'app.==
- ==🟡Le plan MCP ([plan-mcp](../plans/plan-mcp.md)) a dû passer par un « instantané + boîte de réception » plutôt que par une écriture directe.==

## Code concerné

- `js/store.js`
- `js/constants.js`
- `js/data-io.js`
- `data/`
