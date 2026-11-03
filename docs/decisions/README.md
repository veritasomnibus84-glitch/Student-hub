# Décisions d'architecture (ADR)

Une décision importante = un fichier court : **Contexte · Décision · Alternatives rejetées · Conséquences**, plus la liste du code concerné. Statut et date en tête. Pour comprendre le projet d'abord : [ARCHITECTURE](../ARCHITECTURE.md).

| N° | Décision |
|---|---|
| [001](001-pas-de-framework.md) | HTML, CSS et JavaScript sans framework ni build |
| [002](002-aucun-token-github-dans-le-navigateur.md) | Aucun token GitHub dans le navigateur ; données dans localStorage |
| [003](003-pdf-par-appareil.md) | Les PDF restent sur l'appareil, jamais sur GitHub |
| [004](004-csp-stricte-sans-innerhtml.md) | Politique de sécurité de contenu stricte et aucun innerHTML |
| [005](005-pdfjs-dans-vendor.md) | pdf.js copié dans vendor/ (version 6.4.299) |
| [006](006-verrou-local-sans-chiffrement.md) | Verrou local par nom et mot de passe, sans chiffrement des données |
| [007](007-ia-par-copier-coller.md) | Génération par IA par copier-coller, aucune clé dans le navigateur |
| [008](008-fsrs-6.md) | FSRS-6 pour la répétition espacée |
| [009](009-synchronisation-supabase.md) | Synchronisation des appareils par Supabase |
| [010](010-fusion-par-identifiant-et-marqueurs.md) | Fusion par identifiant, marqueurs de suppression, XP au maximum |
| [011](011-service-worker-genere.md) | Service worker généré, avec test de péremption |
| [012](012-menu-contextuel-unique.md) | Un seul menu contextuel : clic droit, appui long, bouton ⋯ |
| [013](013-widgets-et-reglages.md) | Widgets réutilisables et réglages dans l'état |
| [014](014-session-focus-une-tache-ou-un-evenement.md) | Une session Focus est liée à une tâche OU à un événement, jamais aux deux |
| [015](015-exceptions-de-serie-par-date-d-origine.md) | Exceptions d'une série rangées par date d'origine |
| [016](016-evenements-longs-par-enddate.md) | Événements sur plusieurs jours par une date de fin |
| [017](017-rappels-application-ouverte.md) | Rappels seulement quand l'application est ouverte |
| [018](018-aucune-donnee-privee-dans-le-depot-public.md) | Aucune donnée privée dans le dépôt public |
| [019](019-prompt-du-tuteur-genere.md) | Prompt du tuteur : source en Markdown, fichier JavaScript généré et testé |
| [020](020-un-seul-niveau-de-sous-taches.md) | Un seul niveau de sous-tâches |
| [021](021-dependances-souples.md) | Dépendances « souples » : signalées, démarrables en confirmant |
| [022](022-progression-par-moyenne.md) | La progression remonte par moyenne, à poids égal |
| [023](023-projets-collection-legere.md) | Les projets sont une collection légère, distincte des cours |

## Ajouter une décision

1. Copier le gabarit d'un fichier existant ; numéroter à la suite (`024-…`).
2. Remplir les quatre sections ; citer le code concerné.
3. Ne jamais réécrire une décision acceptée : en créer une nouvelle qui la remplace et passer l'ancienne en « Remplacée par ADR-0xx ».
4. Ajouter la ligne à ce tableau. `npm test` vérifie les sections et les liens.
