# Socle — PWA et mode hors ligne

**État :** Implémentée · **Vérifiée contre le code :** 2026-10-26

Retour à l'[index des fiches](README.md) · [ARCHITECTURE](../ARCHITECTURE.md) · [GLOSSAIRE](../GLOSSAIRE.md) · Décision : [ADR-011](../decisions/011-service-worker-genere.md)

## 1. Objectif

Permettre d'**installer** Student Hub sur le téléphone ou l'ordinateur comme une application, et de l'**ouvrir sans réseau** après un premier chargement complet. Les données de l'étudiant vivent déjà dans le navigateur ; le service worker garde en plus les fichiers de l'application.

## 2. Périmètre

**Fait** : manifeste d'application ; service worker **généré** à partir des fichiers du dépôt, avec une version qui change quand un fichier change ; stratégies de cache (cache d'abord pour l'application, réseau d'abord pour `data/*.json`) ; message quand une nouvelle version prend la main ; invite d'installation ; état affiché dans Paramètres ; test qui échoue si `sw.js` est périmé.

**Ne fait pas** : mettre en cache les ressources d'autres sites (vignettes YouTube, Supabase) ; synchroniser en arrière-plan ; envoyer des notifications application fermée ([ADR-017](../decisions/017-rappels-application-ouverte.md)) ; recharger la page tout seul.

## 3. Vue d'ensemble technique

```mermaid
sequenceDiagram
  participant B as Navigateur
  participant S as sw.js
  participant C as caches studenthub-VERSION
  participant R as cache studenthub-runtime
  participant N as Réseau
  B->>S: registerSW() enregistre sw.js
  S->>C: install : addAll(PRECACHE), puis skipWaiting
  S->>S: activate : supprime les anciens caches, clients.claim
  B->>S: requête de la même origine
  alt data/xxx.json
    S->>N: réseau d'abord
    N-->>R: copie ; si hors ligne, lecture dans R
  else page (navigation)
    S->>C: renvoie index.html
  else autre fichier
    S->>C: cache d'abord, sinon réseau puis copie dans R
  end
```

## 4. Composants et fichiers concernés

| Chemin | Rôle |
|---|---|
| `scripts/build-sw.mjs` | `precacheList`, `versionOf`, `renderSw` ; écrit `sw.js` (`npm run build:sw`) |
| `sw.js` | **fichier généré**, ne jamais le modifier à la main : version, liste `PRECACHE`, trois écouteurs (`install`, `activate`, `fetch`) |
| `js/pwa.js` | `registerSW`, `initInstall`, `canInstall`, `promptInstall`, `isStandalone`, `offlineReady`, `onInstallChange` |
| `js/main.js` | appelle `initInstall()` puis `registerSW()` |
| `manifest.webmanifest` | nom, adresse de départ, affichage, couleurs, trois icônes |
| `icons/icon-192.png`, `icons/icon-512.png`, `icons/maskable-512.png`, `assets/logo.svg` | icônes de l'application |
| `index.html` | balises `rel="manifest"`, `apple-touch-icon`, `theme-color`, et CSP (`worker-src 'self'`, `manifest-src 'self'`) |
| `js/modules/settings-ui.js` | section « Application » de Paramètres (état, hors ligne, installation) |
| `tests/pwa.test.js` | 7 tests |

## 5. Entrées / sorties

**Manifeste** (valeurs réelles) : `name` et `short_name` « Student Hub », `start_url` `./index.html`, `scope` `./`, `display` `standalone`, `lang` `fr`, `theme_color` `#274a9e`, `background_color` `#f4f7fd`, icônes 192 et 512 (`any`) et 512 (`maskable`).

**`sw.js`** commence par :

```js
// Fichier généré par scripts/build-sw.mjs : ne pas modifier à la main (npm run build:sw).
const VERSION = '2fe27e0c2d27';           // 12 premiers caractères de l'empreinte SHA-256
const CACHE = `studenthub-${VERSION}`;
const RUNTIME = 'studenthub-runtime';
const PRECACHE = [ "assets/logo.svg", "css/base.css", … "vendor/pdfjs/pdf.worker.min.mjs" ];
```

**Fichiers mis en cache à l'installation** : `index.html`, `manifest.webmanifest`, `vendor/pdfjs/pdf.min.mjs`, `vendor/pdfjs/pdf.worker.min.mjs`, et **tout le contenu** de `css/`, `js/`, `assets/` et `icons/`. Rien de `tests/`, `scripts/`, `docs/`, `data/` ni `sw.js` lui-même.

## 6. Fonctionnement détaillé

```text
FONCTION precacheList(racine)
  fichiers ← EXTRA + tous les fichiers des dossiers css, js, assets, icons (parcours récursif), ceux qui existent
  RETOURNER les chemins relatifs, sans doublon, triés

FONCTION versionOf(liste, racine)
  empreinte ← SHA-256 ; POUR CHAQUE chemin DANS liste : ajouter le chemin ET le contenu du fichier
  RETOURNER les 12 premiers caractères de l'empreinte hexadécimale     // un octet changé = une autre version

SERVICE WORKER (écouteurs de sw.js)
  install  : ouvrir le cache CACHE ; addAll(PRECACHE) ; skipWaiting()
  activate : supprimer chaque cache dont le nom commence par « studenthub- » et qui n'est ni CACHE ni RUNTIME ; clients.claim()
  fetch(requête)
    SI méthode ≠ GET : laisser passer
    SI origine ≠ origine du site : laisser passer                       // YouTube, Supabase : jamais interceptés
    SI le chemin est /data/<nom>.json : RÉSEAU D'ABORD (copie dans RUNTIME), sinon la copie, sinon erreur « hors ligne »
    SI requête de navigation : répondre index.html depuis le cache, sinon le réseau
    SINON : CACHE D'ABORD ; à défaut le réseau, avec copie dans RUNTIME si la réponse est « ok »

FONCTION registerSW({ nav, loc, onUpdate = showToast })
  SI pas de service worker OU protocole ∉ {http:, https:} : RETOURNER rien
  avaitContrôleur ← un service worker contrôle déjà la page
  ÉCOUTER « controllerchange » : SI avaitContrôleur : onUpdate('Nouvelle version de Student Hub installée : recharge la page pour l'utiliser.')
  RETOURNER nav.serviceWorker.register('sw.js') (une erreur donne rien)

FONCTION promptInstall()
  SI aucune invite mémorisée : RETOURNER 'indisponible'
  e ← l'invite mémorisée ; l'oublier ; e.prompt() ; RETOURNER le choix : 'accepted' ou 'dismissed'
```

L'invite vient de l'événement `beforeinstallprompt`, mémorisé par `initInstall` ; `appinstalled` l'oublie. `isStandalone()` vaut vrai si l'application est ouverte en mode installé. `offlineReady()` vaut vrai dès qu'un service worker contrôle la page : le premier chargement n'en bénéficie donc pas encore.

La nouvelle version prend la main tout de suite (`skipWaiting` + `clients.claim`) **sans recharger** la page : ce que l'étudiant est en train de faire n'est pas perdu, mais l'écran affiche encore l'ancienne version jusqu'au rechargement, d'où le message.

## 7. Dépendances

- **Internes** : `js/reminders.js` (`showToast` pour le message de mise à jour) ; `node:crypto` et `node:fs` pour la génération.
- **Navigateur** : `serviceWorker`, `caches`, `beforeinstallprompt`, `matchMedia('(display-mode: standalone)')`. L'installation par invite n'existe pas sur iPhone : « Partager → Sur l'écran d'accueil » (l'app l'explique dans Paramètres).
- **Hébergement** : GitHub Pages (HTTPS obligatoire, sauf `localhost`).
- **Externe** : aucun. **Variable d'environnement** : aucune. **Clés de stockage** : aucune (les caches sont ceux du navigateur).

## 8. Cas limites et erreurs

| Situation | Comportement |
|---|---|
| ouverture via `file://` | pas de service worker (protocole refusé) ; l'app marche sans mode hors ligne |
| premier chargement | pas encore hors ligne ; Paramètres l'indique |
| hors ligne, page rechargée | `index.html` et tous les fichiers viennent du cache |
| hors ligne, `data/videos.json` ou `data/summaries.json` | dernière copie vue ; sinon l'application démarre avec des listes vides |
| fichier modifié mais `sw.js` non régénéré | `npm test` échoue (« lance npm run build:sw ») |
| nouvelle version déployée | installée en arrière-plan, prise en charge tout de suite, message « recharge la page » |
| enregistrement refusé | ignoré (`catch`) : l'app fonctionne normalement |
| ressource d'un autre site (vignette YouTube) | non interceptée : absente hors ligne |
| synchronisation hors ligne | échoue proprement ; reprend au retour du réseau ([socle-synchronisation](socle-synchronisation.md)) |
| PDF | stockés dans IndexedDB de l'appareil : lisibles hors ligne |

## 9. Tests

- Fichier : `tests/pwa.test.js`. Couvert : `sw.js` identique à ce que `renderSw` produirait, liste sans `tests`, `scripts`, `docs`, `data` ni `sw.js` ; manifeste et dimensions réelles des icônes, balises de `index.html`, CSP stricte (aucun `unsafe-inline` ni `unsafe-eval`) ; installation (liste complète mise en cache), activation (anciennes versions supprimées) ; cache d'abord, données fraîches si possible, hors ligne, rien d'extérieur (dans un faux environnement `vm`) ; enregistrement seulement en `http(s)` avec avertissement de mise à jour ; invite mémorisée, proposée au clic, oubliée après usage ; section « Application » de Paramètres.
- Lancer : `npm test`.
- Ne couvre pas : un vrai navigateur (installation réelle, iPhone), le cache de l'exécution (`studenthub-runtime`) dans la durée, le comportement lors d'un déploiement réel sur GitHub Pages.

## 10. Pièges et dette technique

- **Oublier `npm run build:sw`** après un changement de fichier de l'application : le test de péremption échoue, et en production les utilisateurs continueraient à recevoir l'ancienne version du fichier. Les changements dans `docs/`, `tests/`, `scripts/` et `data/` ne l'exigent pas.
- **`cacheFirst` sert l'ancienne version** jusqu'à ce que le nouveau service worker soit installé ; sur GitHub Pages, le navigateur peut mettre un moment à voir un nouveau `sw.js`.
- **Le cache `studenthub-runtime` n'est jamais vidé** par l'activation (il est exempté) : un fichier de la même origine qui n'est pas dans la liste précachée y reste, servi en priorité, sans mise à jour (déduit du code, non testé).
- **`onInstallChange` n'est pas utilisé** : `settings-ui.js` l'importe sans l'appeler ; la section Application se met à jour au redessin.
- **iPhone** : pas d'invite d'installation ; l'étudiant doit passer par le menu Partager.
- **Pas de stratégie de mise à jour des PDF.js** : la copie de `vendor/pdfjs/` est figée ([ADR-005](../decisions/005-pdfjs-dans-vendor.md)).

## 11. Pour modifier ou étendre

1. **Après toute modification d'un fichier de `css/`, `js/`, `assets/`, `icons/`, de `index.html` ou du manifeste** : `npm run build:sw`, puis `npm test`.
2. **Mettre en cache un nouveau dossier** : l'ajouter à `FOLDERS` (ou `EXTRA` pour un fichier) dans `scripts/build-sw.mjs`.
3. **Changer une stratégie de cache** : modifier le modèle de texte `renderSw` dans `scripts/build-sw.mjs`, jamais `sw.js` directement, puis régénérer.
4. **Ne pas casser** : l'exclusion des ressources d'autres sites ; le test de péremption ; la CSP (`worker-src 'self'`, `manifest-src 'self'`) ; le fait que le service worker ne recharge jamais la page de lui-même.
