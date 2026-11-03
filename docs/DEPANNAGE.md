# Dépannage

Retour à l'[index de la documentation](README.md) · [ARCHITECTURE](ARCHITECTURE.md) · [CONTRIBUTING](CONTRIBUTING.md) · [fiches](features/README.md)

Format : **symptôme → cause → solution**. Les causes viennent d'incidents réellement rencontrés (site vide, ancienne version) ou de ce que le code fait d'après les fiches. Quand une cause est **déduite du code et non reproduite**, c'est écrit. Pour tout problème, ouvre d'abord la console du navigateur (F12) : la première erreur rouge est presque toujours la bonne piste.

## 1. Le site est vide ou à moitié affiché

| Symptôme | Cause probable | Solution |
|---|---|---|
| Page blanche, console : `SyntaxError` ou `Unexpected token <<` | **Marqueurs de conflit de fusion** (`<<<<<<<`, `=======`, `>>>>>>>`) restés dans un fichier après un merge Git. Les modules sont chargés ensemble (`js/main.js` importe `js/app.js`, qui en importe 24 autres) : une seule erreur dans un fichier arrête toute l'application. | Chercher les marqueurs (commande ci-dessous), résoudre le conflit, ne jamais fusionner à la main un fichier généré. |
| Page blanche, console : `Failed to load module` ou 404 sur un fichier `.js` | **Fichier manquant** sur le serveur : envoi incomplet, surtout depuis un téléphone où les fichiers s'envoient dossier par dossier. | Envoyer **tous** les dossiers (`js/`, `js/modules/`, `js/ui/`, `css/`, `vendor/`, `data/`, `icons/`) et les fichiers de la racine. Comparer avec la liste du dépôt. |
| Site affiché sans style ou sans icônes | Dossier `css/` ou `icons/` absent, ou `manifest.webmanifest` non envoyé. | Même vérification que ci-dessus. |
| Seul le texte « Student Hub a besoin de JavaScript. » s'affiche | JavaScript désactivé, ou page ouverte avec `file://` (les modules ES n'y fonctionnent pas). | Servir le dossier : `python3 -m http.server 8080` puis ouvrir `http://localhost:8080`. |

Chercher les marqueurs de conflit avant de pousser :

```text
grep -rn "<<<<<<<\|>>>>>>>" . --include=*.js --include=*.css --include=*.html --include=*.json --exclude-dir=node_modules --exclude-dir=vendor
```

Fichiers générés à ne jamais résoudre à la main : `sw.js` (relancer `npm run build:sw`), `js/tutor-prompt.js` (relancer `npm run build:tutor`) et `data/videos.json` (réécrit chaque jour par l'Action GitHub ; faire `git pull` avant de pousser). Voir [CONTRIBUTING](CONTRIBUTING.md).

## 2. L'ancienne version s'affiche

| Symptôme | Cause | Solution |
|---|---|---|
| Après une mise en ligne, l'ancienne version reste visible | Le service worker sert les fichiers **du cache d'abord** ; la nouvelle version est installée en arrière-plan. | Recharger la page quand le message « recharge la page » apparaît. Sinon : fermer tous les onglets de l'app puis rouvrir ; en dernier recours, vider les données du site pour `sw.js`. |
| Les changements n'apparaissent jamais en production | `sw.js` n'a pas été régénéré : sa version n'a pas changé, donc le navigateur ne le remplace pas. | `npm run build:sw`, puis pousser `sw.js`. `npm test` échoue tant qu'il est périmé. |
| Seulement 6 onglets alors que l'app en a 12 | Version très ancienne servie par le cache (la première version n'avait que 6 sections). *Cause déduite, non reproduite.* | Même remède : recharger, ou vider le cache du site. Vérifier que tous les fichiers ont bien été envoyés. |
| Un fichier modifié à la main n'a aucun effet | Il est servi depuis le cache `studenthub-runtime`, qui n'est jamais vidé (déduit du code). | Vider les données du site, ou renommer le fichier. |

Voir [socle-pwa-hors-ligne.md](features/socle-pwa-hors-ligne.md). Les modifications de `docs/`, `tests/`, `scripts/` et `data/` n'exigent pas `build:sw`.

## 3. Hors ligne

| Symptôme | Cause | Solution |
|---|---|---|
| Hors ligne, l'app ne s'ouvre pas | Aucun premier chargement réussi : le cache n'existe pas encore. | Ouvrir une fois l'app en ligne ; Paramètres indique quand le mode hors ligne est prêt. |
| Vignettes YouTube absentes | Les ressources d'autres sites ne sont jamais interceptées. | Normal hors ligne. |
| Listes de vidéos ou de messages vides hors ligne | Pas de copie de `data/videos.json` ou `data/summaries.json` en cache. | Ouvrir l'app une fois en ligne. |
| Un PDF affiche « Fichier absent de cet appareil » | Les PDF sont stockés **par appareil** ([ADR-003](decisions/003-pdf-par-appareil.md)) ; le catalogue seul se synchronise. | Toucher le livre et choisir le même fichier : il est reconnu par son nom et sa taille. Voir [biblio-pdf.md](features/biblio-pdf.md). |

## 4. Synchronisation (Supabase)

La synchronisation est facultative et, d'après la fiche, **n'a pas encore été essayée en vrai** : adresse et clé restent à saisir. Commencer avec des données jetables. Voir [socle-synchronisation.md](features/socle-synchronisation.md).

| Message ou symptôme | Cause | Solution |
|---|---|---|
| L'adresse est refusée ou vidée | Seule l'origine `https://…` est gardée (pas de `http://`, de chemin ni d'identifiants). | Saisir l'adresse du projet sous la forme `https://xxxx.supabase.co`. |
| « Renseigne la clé « anon public » du projet. » | Clé absente. | La copier depuis les réglages API du projet ; c'est la clé **publique**, jamais la clé de service. |
| « Saisis ton e-mail et un mot de passe (6 caractères au minimum). » | Champs incomplets. | Corriger. |
| « Compte créé : confirme ton e-mail… » | Confirmation d'e-mail activée sur le projet. | Cliquer le lien reçu, puis se connecter. |
| « Table user_state introuvable… » | Le script SQL n'a pas été exécuté. | Lancer `scripts/supabase.sql` dans l'éditeur SQL du projet (il crée la table et les règles d'accès par utilisateur). |
| « Connexion impossible… » | Réseau coupé, ou **CSP** qui bloque une adresse hors `*.supabase.co`. | Vérifier le réseau. Un domaine personnalisé est bloqué tant que `connect-src` reste `https://*.supabase.co` ([ADR-004](decisions/004-csp-stricte-sans-innerhtml.md)). |
| « Le cloud est vide : rien à récupérer. » | « Remplacer cet appareil » sans envoi préalable. | Aucune donnée n'a été écrasée ; faire d'abord une synchronisation depuis l'appareil qui a les données. |
| Un élément modifié sur deux appareils revient dans l'ancienne version | Le même identifiant est remplacé par la version entrante, sans comparaison de dates ([ADR-010](decisions/010-fusion-par-identifiant-et-marqueurs.md)). | Synchroniser un appareil à la fois ; exporter une sauvegarde avant. |
| Un élément supprimé réapparaît | Marqueur de suppression de plus de 400 jours, ou jamais synchronisé depuis l'appareil qui l'avait supprimé. | Resynchroniser les deux appareils ; au besoin supprimer à nouveau. |

## 5. Notifications et rappels

| Symptôme | Cause | Solution |
|---|---|---|
| Aucun rappel quand l'app est fermée | **Limite connue** : les rappels ne sonnent que si l'app est ouverte ([ADR-017](decisions/017-rappels-application-ouverte.md), [notifications-application-fermee.md](features/notifications-application-fermee.md)). | Garder un onglet ouvert, ou utiliser le rappel de l'agenda de ton téléphone via l'export `.ics`. |
| Le message à l'écran apparaît mais pas la notification | Permission « pas encore autorisées » ou « bloquées », ou API absente (« indisponible »). | Paramètres → bouton « Autoriser les notifications » ; si « bloquées », changer l'autorisation dans les réglages du site du navigateur. |
| Aucun rappel pour une tâche ou une session Focus | Seuls les **événements** ont des rappels. | Planifier la tâche comme événement avec un rappel. |
| Un rappel est manqué | Il n'est pas rattrapé si l'heure de début est passée. | Rouvrir l'app avant l'événement. |
| Rappels désactivés | Réglage `Rappels` éteint dans Paramètres. | Le rallumer. |

## 6. Mémorisation, tuteur et podcast

| Symptôme | Cause | Solution |
|---|---|---|
| « Révéler la réponse » ne fait rien sur une carte | Corrigé : une carte importée à l'état « en cours » ou « maîtrisée » sans date `last` plantait le calcul des intervalles. Désormais la date est déduite de l'échéance. | Mettre l'application à jour. Si le problème persiste, retirer la carte de la leçon ou la recréer. Voir [memo-cartes-et-revision.md](features/memo-cartes-et-revision.md) section 10. |
| Une carte à trous refuse une bonne réponse (π, ω, signe, exposant) | Le comparateur ne garde que `a-z0-9` : les lettres grecques et l'arabe donnent une chaîne vide ; `-5` égale `5`. | Utiliser une carte question/réponse, ou ajouter des variantes en lettres (« pi »). |
| « N à réviser » plus grand que la séance | Le compteur inclut toutes les cartes neuves ; la séance n'en prend que 20 par défaut. | Normal ; régler « Nouvelles cartes par session » dans Paramètres. |
| « Aucun bloc session_log trouvé » | Réponse du tuteur sans le bloc de clôture, ou texte copié trop tôt. | Demander au tuteur de clôturer la séance, puis coller sa **toute dernière** réponse. |
| « Le bloc session_log est illisible » | JSON invalide, ou accolades en trop après le bloc. | Coller uniquement le bloc entre ```` ```session_log ````. |
| « Réponse illisible : ce n'est pas du JSON. » (cartes, couches) | L'IA a ajouté du texte ou n'a pas répondu en JSON. | Redemander « uniquement le JSON ». Les clôtures ```` ``` ```` sont acceptées. |
| Le tuteur n'a pas mon cours | Source vide ou trop longue (24 000 caractères au plus envoyés). | Coller le cours dans l'onglet Apprendre ; vérifier l'avertissement de troncature. |
| Le podcast est muet ou en mauvaise voix | Navigateur sans `speechSynthesis`, aucune voix installée, ou voix française forcée malgré un autre réglage. *Déduit du code, non vérifié sur appareil.* | Tester dans un autre navigateur ; installer une voix du système. Le script reste lisible. |
| La copie du prompt échoue (« Copie impossible ici… ») | Presse-papiers refusé (page non sécurisée ou permission). | Ouvrir l'app en `https://` ou `localhost` ; sinon sélectionner et copier le texte à la main. |

## 7. Agenda, Focus, verrou, divers

| Symptôme | Cause | Solution |
|---|---|---|
| Le glisser pour créer un événement ne marche pas au doigt | Il faut un **appui long de 350 ms** puis glisser ; déplacer un événement au doigt n'est pas disponible. | Appui long avant de glisser ; déplacer à la souris ou modifier l'événement. Voir [agenda-glisser.md](features/agenda-glisser.md). |
| L'arbre du Focus meurt sans raison | Page invisible plus longtemps que le délai de grâce (10 secondes par défaut, réglable de 5 à 60 dans Paramètres) : autre application, écran verrouillé, rechargement tardif. C'est la règle ([focus-minuteur-et-arbre.md](features/focus-minuteur-et-arbre.md)). Le moteur applique ton réglage, mais le texte affiché **pendant** la session annonce toujours « 10 secondes » (défaut connu). | Garder l'app au premier plan ou allonger le délai dans Paramètres. |
| Mot de passe du verrou oublié | Le verrou est local et ne chiffre rien ([ADR-006](decisions/006-verrou-local-sans-chiffrement.md)). | « Mot de passe oublié ? » **efface le verrou et les données de l'appareil** : restaurer avant tout une sauvegarde exportée. |
| Les données ont disparu | Stockage du navigateur vidé, ou « Mot de passe oublié » utilisé. | Importer la dernière sauvegarde (onglet Home, section « Sauvegarde et données », bouton « Tout exporter » pour en faire une) ; si la synchronisation était active, « Remplacer cet appareil ». |
| `npm test` échoue : « lance npm run build:sw » | `sw.js` périmé. | `npm run build:sw`. |
| `npm test` échoue sur le prompt du tuteur | `js/tutor-prompt.js` modifié à la main ou source changée sans régénérer. | `npm run build:tutor`. |
| `npm test` échoue sur la documentation | Lien cassé, chemin cité introuvable, fiche hors gabarit, ou fichier de `js/` non documenté. | Lire le message : il donne le fichier et la cause. Voir [CONTRIBUTING](CONTRIBUTING.md). |

## 8. Où chercher ensuite

- Comprendre un module : la fiche correspondante dans [features/](features/README.md), section 10 « Pièges ».
- Comprendre un choix : les [décisions](decisions/README.md).
- Vocabulaire : le [glossaire](GLOSSAIRE.md).
- Défauts non corrigés : voir le [CHANGELOG](CHANGELOG.md), section « Défauts connus ».
