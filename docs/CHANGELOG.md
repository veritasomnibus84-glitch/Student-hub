# Journal des changements

Retour à l'[index de la documentation](README.md) · [fiches](features/README.md) · [décisions](decisions/README.md) · [dépannage](DEPANNAGE.md)

## Comment lire ce journal

- **Reconstitué, pas relevé.** Le projet n'a pas d'historique de versions publié : `package.json` indique `0.1.0` et le service worker a seulement un identifiant de build. Ce journal est reconstitué à partir du [plan des tâches](plans/plan-taches.md), des [décisions](decisions/README.md) et des demandes successives du projet. Tout s'est passé en **octobre 2026** ; les dates plus précises ne sont pas conservées.
- **Jalons, pas versions.** Chaque jalon regroupe un thème, du plus récent au plus ancien. Les numéros `T…` renvoient au plan des tâches ; ils y sont parfois réutilisés (par exemple deux `T11`), c'est pourquoi chaque jalon cite aussi son thème.
- Rubriques : **Ajouté**, **Modifié**, **Corrigé**, **Retiré**. Une rubrique absente veut dire « rien de connu », pas « rien ».
- Les entrées pointent vers la fiche de la fonctionnalité quand elle existe.

## Défauts connus

Aucun défaut connu n'est en attente : les dix relevés pendant la rédaction des fiches ont été corrigés (voir « Non publié : corrections des défauts connus » ci-dessous), chacun avec un test dans `tests/fixes.test.js`.

Limites assumées (voir les fiches « Prévue ») : pas de notification application fermée ([notifications-application-fermee.md](features/notifications-application-fermee.md)), pas d'interface dans une autre langue ([interface-multilingue.md](features/interface-multilingue.md)), pas de serveur MCP ([mcp.md](features/mcp.md)). La synchronisation Supabase n'a pas encore été essayée en vrai.

## Non publié : corrections des défauts connus

Les dix défauts relevés pendant la rédaction des fiches sont corrigés. Chacun a un test dans `tests/fixes.test.js`, et la fiche concernée décrit le nouveau comportement.

- **Cartes importées sans `last`** : la dernière révision est déduite de l'échéance et de la stabilité ; « Révéler la réponse » ne lève plus `RangeError` ([memo-cartes-et-revision](features/memo-cartes-et-revision.md)).
- **Cartes à trous** : lettres et chiffres de toute écriture (grec, arabe, cyrillique…), `-5` ≠ `5`, `x²` ≠ `x` (même fiche).
- **Compteur « à réviser »** : égal à la longueur de la séance (échues + au plus « nouvelles par jour » cartes neuves), sur la liste, dans la leçon et dans le widget (même fiche).
- **Tuteur** : un bilan déjà enregistré ne redonne ni XP ni blocage ; deux notions qui ne diffèrent que par la casse ou les accents ne créent qu'un blocage ([memo-tuteur](features/memo-tuteur.md)).
- **Fiche d'étude** : le niveau de la leçon est transmis au prompt ; la voix du podcast suit la langue choisie ; la hiérarchie noyau → pilier → détail est conservée (`deck.layers.parents`) et affichée ([memo-apprendre](features/memo-apprendre.md)).
- **Étiquette « Examen »** : réservée aux examens ; plages de travail et sessions Focus affichent leur heure, les plans de révision « Révision » (`itemLabel`, [agenda-vues-et-recurrence](features/agenda-vues-et-recurrence.md)).
- **Lien « Fichier » d'un to-do** : affiché sur la carte (http et https seulement) ([workspace-cours-et-todos](features/workspace-cours-et-todos.md)).
- **Messages** : le widget compte aussi les résumés importés à la main ; le texte de l'onglet vide ne renvoie plus au dépôt public ([messages-hermes](features/messages-hermes.md)).
- **Focus** : le délai affiché pendant la session est celui des Paramètres ; le conseil du guide l'indique ([focus-minuteur-et-arbre](features/focus-minuteur-et-arbre.md)).
- **Biblio** : « Charger le fichier » relie le PDF choisi au livre cliqué ([biblio-pdf](features/biblio-pdf.md)).

## Non publié : suivi de projets à la Asana (TS1 à TS6)

Plan : [plan-suivi-projets](plans/plan-suivi-projets.md). Décisions : [020](decisions/020-un-seul-niveau-de-sous-taches.md), [021](decisions/021-dependances-souples.md), [022](decisions/022-progression-par-moyenne.md), [023](decisions/023-projets-collection-legere.md).

- **Ajouté** : sous-tâches (un niveau) avec progression et fermeture automatique du parent ; dates de fin `doneAt` et effort estimé ; dépendances « bloquée par » avec refus et coupure des boucles, confirmation avant de démarrer une tâche bloquée ; projets (vue Projets de Workspace, page, ordre conseillé) ; objectifs reliés au travail (modes temps, manuel, automatique, statut) ; rapports (statut, retards, charge, avancement par cours, rythme hebdomadaire) et trois widgets de Home ; section « Travail » des Paramètres ; trois conseils du guide. Fiches : [sous-tâches et dépendances](features/workspace-sous-taches-et-dependances.md), [projets](features/workspace-projets.md), [rapports](features/rapports-et-tableaux-de-bord.md).
- **Modifié** : le sélecteur Tableau · Projets · Rapports de Workspace (toujours 12 onglets) ; le widget « Objectif en cours » montre l'avancement des objectifs reliés ; `barChart` accepte une seconde série empilée et une ligne de capacité ; les widgets nouveaux sont ajoutés une seule fois à un Home déjà personnalisé ; `GUIDE_VERSION` passe à 6.
- **Corrigé** : rien de connu.
- **Retiré** : rien.

## Non publié : documentation (jalon D1 à D6)

**Ajouté**
- Dossier `docs/` : index, [ARCHITECTURE](ARCHITECTURE.md), [GLOSSAIRE](GLOSSAIRE.md), [CONTRIBUTING](CONTRIBUTING.md), ce journal et le [dépannage](DEPANNAGE.md).
- 19 [décisions d'architecture](decisions/README.md).
- 37 fiches de fonctionnalités sur un gabarit de 11 sections, dont 3 fiches « Prévue ».
- `tests/docs.test.js` : liens, chemins cités, gabarit des fiches et couverture des fichiers de `js/` ; il fait échouer `npm test` si la documentation ment.

**Modifié**
- Plans et spécification déplacés dans `docs/plans/` et `docs/SPEC.md` ; le `README.md` de la racine devient court.
- Le résumé des fonctionnalités qui se trouvait dans l'index des fiches est supprimé : chaque fiche le remplace.

## Jalon 12 : application installable et hors ligne (T18)

**Ajouté**
- `manifest.webmanifest`, icônes, invitation d'installation ; l'app s'ouvre sans réseau après un premier chargement. Fiche : [socle-pwa-hors-ligne.md](features/socle-pwa-hors-ligne.md).
- Service worker **généré** par `npm run build:sw` (liste des fichiers et version) ; `npm test` échoue s'il est périmé ([ADR-011](decisions/011-service-worker-genere.md)).
- Message « recharge la page » quand une nouvelle version est prête.

## Jalon 11 : plages de travail, Focus planifié, Paramètres complets (T16, T17)

**Ajouté**
- Une tâche liée à un événement se planifie en **plages de travail** ; elles s'affichent dans l'événement en vue semaine. Fiche : [agenda-plages-de-travail.md](features/agenda-plages-de-travail.md).
- Sessions Focus planifiées, liées à **une** tâche **ou** un événement, jamais les deux ([ADR-014](decisions/014-session-focus-une-tache-ou-un-evenement.md)). Fiche : [focus-sessions-planifiees.md](features/focus-sessions-planifiees.md).
- Paramètres complets : apparence, langues, verrou, notifications, Agenda, Focus, Mémorisation. Fiche : [socle-parametres.md](features/socle-parametres.md).

## Jalon 10 : synchronisation avec suppressions et automatique (T10c)

**Ajouté**
- Marqueurs de suppression : ce qu'on supprime sur un appareil disparaît des autres ([ADR-010](decisions/010-fusion-par-identifiant-et-marqueurs.md)).
- Synchronisation automatique. Fiche : [socle-synchronisation.md](features/socle-synchronisation.md).

**Modifié**
- La première synchronisation (v1) était manuelle et sans marqueurs de suppression.

## Jalon 9 : Agenda avancé (T11 et T14, seconde série)

**Ajouté**
- Événements sur plusieurs jours (« Se termine le », [ADR-016](decisions/016-evenements-longs-par-enddate.md)) : [agenda-evenements-longs-et-occurrences.md](features/agenda-evenements-longs-et-occurrences.md).
- Modification ou suppression d'**une seule occurrence** d'une série ([ADR-015](decisions/015-exceptions-de-serie-par-date-d-origine.md)).
- Création par glisser dans la vue semaine, glisser sur plusieurs jours, déplacement d'un événement à la souris ou au stylet : [agenda-glisser.md](features/agenda-glisser.md).
- Export et import `.ics` des événements longs (`DTEND`), des exceptions (`EXDATE`) et des occurrences modifiées (`RECURRENCE-ID`) : [agenda-ics.md](features/agenda-ics.md).

**Modifié**
- L'export `.ics` ignorait auparavant les événements longs et les exceptions de série.

## Jalon 8 : Mémorisation complète (T11, T12 et T13, seconde série)

**Ajouté**
- Tuteur IA : prompt système, contexte à coller, lecture du bloc `session_log` : [memo-tuteur.md](features/memo-tuteur.md), [ADR-019](decisions/019-prompt-du-tuteur-genere.md).
- Apprendre : fiches (4 styles, 4 longueurs), podcast à deux voix, cartographie en couches : [memo-apprendre.md](features/memo-apprendre.md).
- Planning optimal avant un examen : [memo-planning.md](features/memo-planning.md).
- XP et niveaux : [memo-xp-et-niveaux.md](features/memo-xp-et-niveaux.md).

## Jalon 7 : menus, widgets, Paramètres, synchronisation v1 (T10b)

**Ajouté**
- Menu contextuel unique (clic droit, appui long, bouton ⋯) : [socle-menu-contextuel.md](features/socle-menu-contextuel.md), [ADR-012](decisions/012-menu-contextuel-unique.md).
- Widgets en bas de chaque onglet : [socle-widgets-et-home.md](features/socle-widgets-et-home.md), [ADR-013](decisions/013-widgets-et-reglages.md).
- Onglet Paramètres (première version).
- Synchronisation Supabase manuelle, facultative : [ADR-009](decisions/009-synchronisation-supabase.md).

## Jalon 6 : Mémorisation (suite), Objectifs et conseils (T9b, T10)

**Ajouté**
- Examen chronométré avec correction, planning, série de jours, cartes à trous et vrai/faux, cartes dues dans Home : [memo-examens.md](features/memo-examens.md).
- Trois sous-onglets, couches, import CSV, vue grille : [memo-cartes-et-revision.md](features/memo-cartes-et-revision.md).
- Objectifs (échéance en mois ou en années) et conseils, pré-remplis par un guide d'utilisation (33 conseils dans le code actuel) : [objectifs-et-conseils.md](features/objectifs-et-conseils.md).

## Jalon 5 : Mémorisation v1 (T9)

**Ajouté**
- Leçons, cartes question/réponse et QCM, séance à trois boutons avec intervalles affichés, génération de cartes par prompt et JSON collé ([ADR-007](decisions/007-ia-par-copier-coller.md)).
- Répétition espacée FSRS-6, paramètres vérifiés contre py-fsrs : [memo-fsrs.md](features/memo-fsrs.md), [ADR-008](decisions/008-fsrs-6.md).

**Modifié**
- L'onglet « Révision » est renommé **Mémorisation**.

## Jalon 4 : Focus, relations, import/export (T17, T18 et T19, première série)

**Ajouté**
- Focus : minuteur, arbre en 5 stades qui meurt si l'app est quittée plus de 10 secondes, tags, statistiques jour, semaine, mois, année : [focus-minuteur-et-arbre.md](features/focus-minuteur-et-arbre.md), [focus-statistiques.md](features/focus-statistiques.md).
- Relations événement, tâches et notes ; une tâche devient un événement.
- Import et export par onglet, sauvegarde complète : [socle-import-export.md](features/socle-import-export.md).

## Jalon 3 : Agenda, Home, verrou (T14, T15, T16)

**Ajouté**
- Agenda : vues semaine, mois, année, répétition, rappels, agendas colorés, recherche, `.ics` : [agenda-vues-et-recurrence.md](features/agenda-vues-et-recurrence.md).
- Home : heure, recherche globale, aujourd'hui et à venir, mini-calendrier, tâches, récents, note du jour : [socle-recherche-globale.md](features/socle-recherche-globale.md).
- Verrou d'accès par nom et mot de passe, logo, suppression d'un cours et d'un to-do : [socle-verrou.md](features/socle-verrou.md), [ADR-006](decisions/006-verrou-local-sans-chiffrement.md).

## Jalon 2 : Bibliothèque (T13, première série)

**Ajouté**
- Import de PDF, couvertures, cinq sections, quatre vues, tri et regroupement, lecteur PDF.js, signets, progression, rattachement entre appareils par nom et taille : [biblio-pdf.md](features/biblio-pdf.md).
- Choix liés : PDF gardés par appareil ([ADR-003](decisions/003-pdf-par-appareil.md)), PDF.js copié dans `vendor/` ([ADR-005](decisions/005-pdfjs-dans-vendor.md)).

## Jalon 1 : socle v0.1 (T1 à T7)

**Ajouté**
- Coque `index.html`, onglets par adresse, thèmes clair et sombre, politique de sécurité stricte ([ADR-004](decisions/004-csp-stricte-sans-innerhtml.md), [ADR-001](decisions/001-pas-de-framework.md)).
- État dans `localStorage`, validation à la lecture, export et import JSON : [socle-etat-et-stockage.md](features/socle-etat-et-stockage.md).
- Workspace (cours, kanban, tri, recherche) : [workspace-cours-et-todos.md](features/workspace-cours-et-todos.md) ; Notes : [notes.md](features/notes.md) ; Liens : [liens.md](features/liens.md) ; Messages : [messages-hermes.md](features/messages-hermes.md) ; Vidéos avec script RSS et Action quotidienne : [videos.md](features/videos.md).
- Vérification en navigateur réel (mobile, clair et sombre) : aucune erreur de console, persistance correcte.
