# ADR-009 — Synchronisation des appareils par Supabase

**Statut :** Acceptée · **Date :** octobre 2026

## Contexte

Les données sont locales à chaque appareil ([ADR-002](002-aucun-token-github-dans-le-navigateur.md)). L'étudiant utilise un téléphone et parfois un ordinateur, et veut retrouver ses cours, cartes et agenda partout, sans écrire de serveur.

## Décision

Une table `user_state` (une ligne par utilisateur, colonne `data` en JSON) dans un projet **Supabase** que l'étudiant crée lui-même. L'app parle à l'API REST et à l'authentification par de simples `fetch` (`js/sync.js`), sans bibliothèque. La **règle RLS** (`scripts/supabase.sql`) limite chaque utilisateur à sa ligne ; la clé « anon public » n'est donc pas un secret. Adresse, clé et session sont saisies dans Paramètres et stockées sous `studenthub:sync`, **hors des sauvegardes**.

## Alternatives rejetées

- **Firebase / Firestore** : comparable, mais SDK volumineux à charger, donc contraire à [ADR-001](001-pas-de-framework.md).
- **Fonctions serverless (Cloudflare Workers, Netlify, Vercel)** : un code serveur à écrire et à protéger.
- **Serveur personnel** : maintenance et sécurité à la charge de l'étudiant.
- **Rester statique avec instantané + boîte de réception** (plan MCP) : sans compte, mais gestes manuels et fichiers dans un dépôt public ([ADR-018](018-aucune-donnee-privee-dans-le-depot-public.md)).

## Conséquences

- Les données (hors PDF) sont stockées chez un tiers : choix à faire en connaissance de cause.
- La CSP autorise `*.supabase.co` ; à resserrer à l'adresse exacte du projet.
- La session de connexion reste dans le navigateur ; le mot de passe n'est jamais stocké.
- Les limites et tarifs gratuits de Supabase n'ont pas été vérifiés : à contrôler avant de s'y fier.
- Testée contre un faux serveur ; jamais contre un projet réel au moment de la décision.

## Code concerné

- `js/sync.js`
- `js/autosync.js`
- `scripts/supabase.sql`
- `js/modules/settings.js`
