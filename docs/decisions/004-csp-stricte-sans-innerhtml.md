# ADR-004 — Politique de sécurité de contenu stricte et aucun innerHTML

**Statut :** Acceptée · **Date :** octobre 2026

## Contexte

L'application affiche des textes saisis par l'utilisateur ou collés depuis une IA ou un fichier d'ailleurs (`.ics`, JSON). Une faille d'injection de HTML pourrait exécuter du code qui lit `localStorage`, y compris la session de synchronisation.

## Décision

La balise `<meta http-equiv="Content-Security-Policy">` de `index.html` n'autorise que `self` (scripts, styles, workers, manifeste, polices), `i.ytimg.com` pour les vignettes, et `*.supabase.co` pour la synchronisation. **Aucun `innerHTML`** : tout le DOM passe par `h()`. **Aucun style en ligne** : les positions dynamiques sont posées avec `element.style.top = …`, que la CSP autorise.

## Alternatives rejetées

- **CSP permissive (`unsafe-inline`)** : plus simple à écrire, mais annule la protection.
- **Assainir du HTML avec une bibliothèque** : une dépendance de plus, et un risque de contournement.
- **Gabarits en chaînes de caractères** : la porte d'entrée classique des injections.

## Conséquences

- Les tests de navigateur ne peuvent pas utiliser `eval` (par exemple `wait_for_function` avec une chaîne) : ils interrogent la page avec des localisateurs.
- `connect-src` autorise tout `*.supabase.co` : à resserrer à l'adresse exacte du projet (Paramètres → Synchronisation ; voir le [dépannage](../DEPANNAGE.md)).
- Chaque nouvelle source externe (police, image, API) demande une modification explicite de la CSP et une décision.

## Code concerné

- `index.html`
- `js/dom.js`
- `tests/pwa.test.js`
