# ADR-011 — Service worker généré, avec test de péremption

**Statut :** Acceptée · **Date :** octobre 2026

## Contexte

L'application doit s'installer et s'ouvrir hors ligne. Un service worker écrit à la main contient une liste de fichiers qui dérive dès qu'on ajoute un fichier : l'app hors ligne sert alors une version cassée ou ancienne.

## Décision

`sw.js` est **généré** par `scripts/build-sw.mjs` : la liste des fichiers à mettre en cache est lue dans le dépôt et la **version est l'empreinte de leur contenu**. Fichiers de l'app : cache d'abord ; `data/*.json` : réseau d'abord ; autres origines : jamais interceptées. `skipWaiting` et `clients.claim` activent la nouvelle version tout de suite ; un message invite à recharger. `tests/pwa.test.js` **échoue si `sw.js` est périmé**.

## Alternatives rejetées

- **Service worker manuel** : liste de fichiers qui dérive.
- **Workbox** : dépendance et build, contraire à [ADR-001](001-pas-de-framework.md).
- **Pas de mode hors ligne** : écarté, l'étudiant travaille souvent sans réseau.

## Conséquences

- Après toute modification d'un fichier de l'app, **`npm run build:sw` est obligatoire** (sinon le mode hors ligne sert l'ancienne version, et le test échoue).
- Éditer depuis un téléphone sans Node oblige à régénérer `sw.js` ailleurs ; c'est la contrainte principale de cette décision.
- Une page déjà ouverte garde l'ancien code jusqu'au rechargement.

## Code concerné

- `sw.js`
- `scripts/build-sw.mjs`
- `js/pwa.js`
- `tests/pwa.test.js`
- `tests/e2e/pwa.e2e.py`
