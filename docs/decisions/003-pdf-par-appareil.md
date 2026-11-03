# ADR-003 — Les PDF restent sur l'appareil, jamais sur GitHub

**Statut :** Acceptée · **Date :** octobre 2026

## Contexte

La bibliothèque lit des PDF de cours et d'ouvrages, souvent protégés par le droit d'auteur. Le dépôt est public ([ADR-018](018-aucune-donnee-privee-dans-le-depot-public.md)). `localStorage` est limité à quelques mégaoctets.

## Décision

Les fichiers PDF et leurs couvertures sont stockés dans **IndexedDB** (`studenthub-files`), **par appareil**. Seul le **catalogue** (titre, auteur, tags, favoris, signets, progression) fait partie de l'état et s'exporte. Un livre est relié entre appareils par son **empreinte** : `nom|taille` (`fingerprint`).

## Alternatives rejetées

- **PDF dans le dépôt GitHub** : publication de contenus protégés, dépôt public, limites de taille.
- **PDF en base64 dans `localStorage`** : quota de quelques Mo, tout l'état ralenti.
- **Stockage Supabase** : coût, droits d'auteur, hors du périmètre « sans serveur ».

## Conséquences

- Sur un autre appareil, le catalogue importé affiche « fichier absent de cet appareil » ; il suffit de rouvrir le même PDF pour le relier.
- L'empreinte `nom|taille` peut confondre deux fichiers différents de même nom et taille (cas très rare).
- Les PDF ne sont jamais synchronisés ni sauvegardés par l'export.

## Code concerné

- `js/files.js`
- `js/library-logic.js`
- `js/modules/library.js`
- `js/pdfdoc.js`
