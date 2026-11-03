# ADR-006 — Verrou local par nom et mot de passe, sans chiffrement des données

**Statut :** Acceptée · **Date :** octobre 2026

## Contexte

Un écran de connexion est utile pour un téléphone partagé ou laissé ouvert. Un vrai chiffrement des données demanderait de dériver une clé du mot de passe et de chiffrer tout l'état.

## Décision

Le verrou est un **écran de connexion local** : nom + mot de passe, empreinte **PBKDF2 (210 000 itérations)** stockée sous `studenthub:lock`, session déverrouillée dans `sessionStorage`. Il **ne chiffre pas** les données et n'a jamais prétendu le faire. « Mot de passe oublié » **efface le verrou et les données de l'appareil**.

## Alternatives rejetées

- **Chiffrement AES-GCM de tout l'état** : un mot de passe oublié rend les données irrécupérables, la synchronisation et l'import deviennent plus complexes.
- **Pas de verrou** : écarté ; l'étudiant avait noté « authentification » (le verrou répond-il exactement à ce qu'il voulait ? question encore ouverte).
- **Authentification serveur** : hors du périmètre sans serveur (voir [ADR-009](009-synchronisation-supabase.md) pour la synchronisation seule).

## Conséquences

- Quelqu'un qui ouvre les outils de développement du navigateur peut lire `localStorage` : le verrou ne protège pas contre cela. L'interface le dit (« ne chiffre pas tes données »).
- Les données déjà synchronisées dans Supabase ne sont pas effacées par « mot de passe oublié ».
- L'empreinte du verrou n'est jamais exportée ni synchronisée.

## Code concerné

- `js/lock.js`
- `js/ui/lock-screen.js`
- `js/app.js`
