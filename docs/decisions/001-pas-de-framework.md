# ADR-001 — HTML, CSS et JavaScript sans framework ni build

**Statut :** Acceptée · **Date :** octobre 2026

## Contexte

Student Hub doit se publier tel quel sur GitHub Pages, se modifier depuis un téléphone (éditeur web de GitHub) par quelqu'un qui découvre Git, et rester lisible sans chaîne d'outils. Le projet est « minimaliste et modulaire » dès sa spécification d'origine ([SPEC](../SPEC.md)).

## Décision

Application d'une page en **modules ES natifs**, sans framework, sans bundler, sans transpilation, sans dépendance à l'exécution. Le DOM se construit avec `h()` ; chaque onglet est un module qui exporte `render(ctx)` ; l'état est un objet unique redessiné après chaque `commit`.

## Alternatives rejetées

- **React, Vue ou Svelte avec Vite** : productifs, mais exigent un build, Node pour publier, et rendent l'édition depuis un téléphone impossible.
- **Bibliothèques de composants web (Lit…)** : peu de gain pour 12 onglets, une dépendance de plus.
- **Un seul gros fichier** : impossible à tester et à relire.

## Conséquences

- Il n'y a pas de réactivité automatique : le module d'un onglet est **redessiné en entier** quand l'état change (`store.subscribe(draw)`), ce qui impose de poser l'état de la vue *avant* le `commit` (voir [CONTRIBUTING](../CONTRIBUTING.md)).
- Les modules ES exigent un serveur HTTP, même en local : `index.html` ne s'ouvre pas en `file://`.
- Les tests tournent sans navigateur grâce à la séparation logique pure / interface (`js/*-logic.js`) et à jsdom.

## Code concerné

- `js/main.js`
- `js/app.js`
- `js/dom.js`
- `js/modules/`
