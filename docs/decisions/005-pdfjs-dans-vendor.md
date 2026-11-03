# ADR-005 — pdf.js copié dans vendor/ (version 6.4.299)

**Statut :** Acceptée · **Date :** octobre 2026

## Contexte

Le lecteur de PDF a besoin de pdf.js. Un chargement depuis un CDN serait refusé par la CSP ([ADR-004](004-csp-stricte-sans-innerhtml.md)) et casserait le mode hors ligne.

## Décision

Les fichiers de `pdfjs-dist` 6.4.299 (version « legacy », compatible avec davantage de navigateurs) sont **copiés dans `vendor/pdfjs/`** avec leur licence : `pdf.min.mjs`, `pdf.worker.min.mjs`, `cmaps/` et `standard_fonts/`. Le module est chargé à la demande par `js/pdfdoc.js`.

## Alternatives rejetées

- **CDN (cdnjs, jsDelivr)** : refusé par la CSP, inutilisable hors ligne.
- **npm + bundler** : contredit [ADR-001](001-pas-de-framework.md).
- **Visionneuse PDF native du navigateur (iframe/object)** : pas de signets ni de progression, comportement variable sur mobile.

## Conséquences

- Le dossier pèse environ 4 Mo ; le service worker ne met en cache à l'installation que `pdf.min.mjs` et `pdf.worker.min.mjs` ; `cmaps/` et `standard_fonts/` sont mis en cache à la première utilisation ([ADR-011](011-service-worker-genere.md)).
- La mise à jour de pdf.js est manuelle : remplacer les fichiers, relancer `npm run build:sw` et tester la bibliothèque.

## Code concerné

- `vendor/pdfjs`
- `js/pdfdoc.js`
- `js/ui/reader.js`
