# ADR-010 — Fusion par identifiant, marqueurs de suppression, XP au maximum

**Statut :** Acceptée · **Date :** octobre 2026

## Contexte

Deux appareils modifient la même base. Un simple « le dernier qui écrit gagne » perdrait des ajouts ; une fusion naïve ferait **revenir** ce qu'on a supprimé.

## Décision

La synchronisation fait : lire le cloud, **fusionner** dans l'état local, écrire le résultat. À la fusion : les listes d'objets sont fusionnées **par `id`** ; pour un même `id`, **la version qui arrive (le cloud) l'emporte** (`mergeList`). Les suppressions deviennent des **marqueurs datés** (`tombstones`, conservés 400 jours, 2 000 par collection) appliqués à chaque fusion. L'**XP** prend le maximum (total et par jour). Les **réglages** restent ceux de l'appareil. « Remplacer le cloud » et « Remplacer cet appareil » repartent d'une copie exacte.

## Alternatives rejetées

- **Dernier écrit gagne sur tout l'état** : perd les ajouts de l'autre appareil.
- **CRDT** : correct mais lourd, hors de proportion pour ce projet.
- **Horodatage par élément (`updated_at`)** : plus fin (garder la version la plus récente), mais demande de modifier chaque modèle de données.
- **Fusion sans marqueurs** : les éléments supprimés ressuscitent.

## Conséquences

- **Deux appareils modifient le même élément** : la modification locale non synchronisée est perdue au profit de la version du cloud, **sans avertissement**. Les ajouts et suppressions, eux, ne se perdent pas. Piste d'amélioration : un horodatage par élément.
- Un import d'une très vieille sauvegarde en mode « fusionner » ne ressuscite pas ce qui a été supprimé depuis ; pour restaurer, utiliser le mode « remplacer ».
- Les suppressions sont détectées dans `commit` (comparaison des identifiants avant/après), pas dans chaque fonction de suppression.

## Code concerné

- `js/tombstones.js`
- `js/data-io.js`
- `js/sync.js`
- `js/store.js`
- `tests/sync2.test.js`
