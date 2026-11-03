# Glossaire

Vocabulaire du domaine et des termes du projet. Colonne « Où » : le fichier de référence dans le dépôt.

## Application et interface

| Terme | Définition | Où |
|---|---|---|
| Onglet | Une section de l'app (Home, Workspace, Agenda…). Un onglet = un module qui exporte `render(ctx)`. | `js/app.js`, `js/modules/` |
| Module | Fichier d'un onglet dans `js/modules/`. | `js/modules/` |
| `ctx` | Objet passé à `render` : `store`, `data`, `storage`, `rerender`, `lockControls`. | `js/app.js` |
| `h()` | Fonction qui construit un élément DOM sans `innerHTML`. | `js/dom.js` |
| Feuille (sheet) | Fenêtre modale de saisie ouverte par `openSheet`. | `js/ui/dialog.js` |
| Toast | Petit message temporaire en bas de l'écran. | `js/reminders.js` |
| Widget | Bloc réutilisable (Aujourd'hui, Tâches, Niveau et XP…) affiché dans Home et en bas des onglets. | `js/ui/widgets.js` |
| Barre de widgets | Zone repliable en bas de chaque onglet qui affiche les widgets choisis. | `js/ui/widgets.js` |
| Menu contextuel | Menu d'actions ouvert par clic droit, appui long ou bouton ⋯. | `js/ui/context-menu.js` |
| Appui long | Appui maintenu 500 ms sur tactile : ouvre le menu contextuel (350 ms pour tracer dans l'Agenda). | `js/ui/context-menu.js` |
| Hash | Partie `#onglet` de l'adresse : choisit l'onglet courant. | `js/app.js` |

## Données et état

| Terme | Définition | Où |
|---|---|---|
| État | Objet JSON unique qui contient toutes les données de l'étudiant. | `js/store.js` |
| `seed` | Données de départ (8 cours de MPC1, agendas, tags, guide…). | `js/store.js` |
| `sanitizeState` | Validation et bornage de tout l'état à l'entrée. | `js/store.js` |
| `commit` | Seule façon de modifier l'état : modification, marqueurs de suppression, sauvegarde, notification. | `js/store.js` |
| Section | Groupe de clés d'état exportable séparément (une par onglet). | `js/data-io.js` |
| Fusion | Import qui garde les deux côtés (listes fusionnées par `id`). | `js/data-io.js` |
| Remplacement | Import qui écrase les clés présentes dans le fichier. | `js/data-io.js` |
| Marqueur de suppression (tombstone) | Trace datée d'un élément supprimé, pour qu'il ne revienne pas à la fusion. | `js/tombstones.js` |
| `localStorage` | Stockage du navigateur : état (`studenthub:v1`), verrou, configuration de synchro. | `js/constants.js` |
| IndexedDB | Base du navigateur qui garde les PDF et couvertures, par appareil. | `js/files.js` |
| Hermes | Assistant externe qui écrit les résumés d'e-mails et de messages dans `data/summaries.json`. | `data/summaries.json` |
| `channels.json` | Liste des chaînes YouTube suivies. | `data/channels.json` |
| `videos.json` | Dernières vidéos, mises à jour chaque jour par une Action GitHub. | `scripts/fetch-videos.mjs` |

## Agenda et tâches

| Terme | Définition | Où |
|---|---|---|
| Agenda (calendrier) | Un des calendriers colorés qui regroupent des événements. | `js/store.js` |
| Événement | Élément daté de l'Agenda (titre, lieu, heures, répétition, rappel). | `js/store.js` |
| Série | Événement répété (jour, semaine, mois, an). | `js/calendar-logic.js` |
| Occurrence | Une répétition d'une série à une date donnée. | `js/calendar-logic.js` |
| Exception de série | Modification ou suppression d'une seule occurrence, rangée dans `exceptions` par date d'origine. | `js/calendar-logic.js` |
| Date d'origine | Date où l'occurrence tomberait sans exception (clé de l'exception). | `js/calendar-logic.js` |
| Événement long | Événement sur plusieurs jours (`endDate`). | `js/calendar-logic.js` |
| `itemsOn` | Fonction qui donne tous les éléments d'un jour (événements, to-dos, examens, plages, Focus, planning). | `js/calendar-logic.js` |
| Rappel | Notification avant un événement, seulement si l'app est ouverte. | `js/reminders.js` |
| ICS | Format de fichier de calendrier (import et export). | `js/ics.js` |
| EXDATE / RECURRENCE-ID | Champs ICS : occurrence supprimée / occurrence modifiée d'une série. | `js/ics.js` |
| Cours | Fiche de cours inspirée du template Notion « Student Ultimate ». | `js/modules/workspace.js` |
| To-do | Tâche avec statut (À faire, En cours, Terminés, Sans statut) et date limite. | `js/kanban.js` |
| Plage de travail (slot) | Créneau (jour, début, fin) où une tâche liée à un événement sera travaillée. | `js/work-logic.js` |

## Focus

| Terme | Définition | Où |
|---|---|---|
| Session | Période de concentration chronométrée. | `js/focus-logic.js` |
| Arbre | Récompense : planté si la session va au bout, mort si l'étudiant quitte l'app trop longtemps. | `js/focus-logic.js` |
| Tolérance (grace) | Délai hors de l'app avant que l'arbre meure (10 s par défaut, réglable). | `js/focus-logic.js` |
| Session en cours (`focusRun`) | Session démarrée, pas encore terminée. | `js/focus-runtime.js` |
| Session planifiée (`focusPlans`) | Créneau réservé pour une session, lié à UNE tâche ou UN événement. | `js/work-logic.js` |
| Tag | Catégorie d'une session Focus. | `js/store.js` |

## Mémorisation

| Terme | Définition | Où |
|---|---|---|
| Leçon (deck) | Ensemble de cartes avec sa source, sa date d'examen, ses couches et son profil. | `js/revision-logic.js` |
| Carte | Question/réponse, définition, mot/traduction, QCM, vrai/faux ou phrase à trous. | `js/revision-logic.js` |
| Source (du cours) | Texte du cours collé dans la leçon ; point de départ des prompts. | `js/revision-logic.js` |
| Couche | Importance d'une notion : noyau, pilier ou détail. | `js/revision-logic.js` |
| Noyau | Idée sans laquelle le reste du cours n'a pas de sens (3 à 5 par cours). | `js/study-logic.js` |
| Pilier | Notion qui dépend d'un noyau. | `js/study-logic.js` |
| Cartographie | Découpage d'un cours en noyaux, piliers et détails, produit par l'IA de l'étudiant puis lu par `parseLayers` (le lien noyau-pilier n'est pas conservé). | `js/study-logic.js` |
| Détail | Notion secondaire rattachée à un pilier. | `js/study-logic.js` |
| FSRS | Algorithme de répétition espacée (version 6 ici). | `js/fsrs.js` |
| Stabilité | Durée (en jours) pendant laquelle une carte reste retenue à 90 %. | `js/fsrs.js` |
| Difficulté | Facilité de la carte, de 1 à 10. | `js/fsrs.js` |
| Rétention visée | Probabilité de se rappeler au moment de la révision (90 % par défaut). | `js/fsrs.js` |
| À revoir / Moyen / Bien | Les trois notes d'une carte (grades 1, 2, 3). | `js/fsrs.js` |
| Maîtrisée | Carte dont la stabilité atteint 21 jours. | `js/fsrs.js` |
| Série (streak) | Nombre de jours de suite avec au moins une révision ou un examen. | `js/revision-logic.js` |
| Examen blanc | Examen chronométré fabriqué avec les cartes de la leçon. | `js/revision-logic.js` |
| Note prédite | Note que l'étudiant pense obtenir, saisie avant l'examen. | `js/revision-logic.js` |
| Blocage (gap) | Notion qui a posé problème, notée dans le journal. | `js/revision-logic.js` |
| Planning | Répartition des cartes et des examens blancs jusqu'à la date d'examen. | `js/planning.js` |
| Prompt | Texte à copier dans une IA pour générer des cartes, une fiche, un podcast ou une correction. | `js/revision-logic.js`, `js/study-logic.js` |
| Tuteur | Session guidée avec une IA qui suit le prompt `docs/fds-tutor.md`. | `js/tutor-logic.js` |
| `plan_session` | Bloc du contexte du tuteur : mode, minutes, priorités, format d'examen, rappels. | `js/tutor-logic.js` |
| `session_log` | Bilan JSON que le tuteur écrit à la clôture ; l'app le lit. | `js/tutor-logic.js` |
| `[DARACE]` | Marqueur que le tuteur place avant son bilan. | `docs/fds-tutor.md` |
| XP | Points de régularité ; plafond de 300 par jour. | `js/xp-logic.js` |
| Niveau | Palier d'XP (`50 × (niveau − 1)²`). | `js/xp-logic.js` |

## Objectifs, réglages et plateforme

| Terme | Définition | Où |
|---|---|---|
| Objectif | But à x mois ou x ans, avec échéance et progression. | `js/goals-logic.js` |
| Conseil | Fiche de texte ; le guide d'utilisation est un ensemble de conseils pré-remplis. | `js/goals-logic.js` |
| Version du guide | Numéro qui permet d'ajouter les nouveaux conseils sans recréer ceux supprimés. | `js/goals-logic.js` |
| Réglages (`settings`) | Apparence, langues, Agenda, Focus, Mémorisation, notifications, synchro, widgets. | `js/settings-logic.js` |
| PWA | Application web installable qui fonctionne hors ligne. | `js/pwa.js` |
| Service worker | Programme du navigateur qui répond aux requêtes depuis le cache. | `sw.js` |
| Précache | Liste des fichiers mis en cache à l'installation. | `scripts/build-sw.mjs` |
| CSP | Politique de sécurité de contenu : limite ce que la page peut charger ou exécuter. | `index.html` |
| Verrou | Écran de connexion local (nom + mot de passe) qui ne chiffre pas les données. | `js/lock.js` |
| PBKDF2 | Fonction qui dérive une empreinte de mot de passe (210 000 itérations). | `js/lock.js` |
| Supabase | Service en ligne qui héberge la table de synchronisation. | `js/sync.js` |
| `user_state` | Table de synchronisation : une ligne par utilisateur (`data` en JSON). | `scripts/supabase.sql` |
| RLS | Règle de sécurité au niveau de la ligne : chacun ne voit que sa ligne. | `scripts/supabase.sql` |
| Clé anon | Clé publique du projet Supabase ; sans danger si la RLS est active. | `js/sync.js` |
| GitHub Pages | Hébergement statique du site. | `index.html` |
| GitHub Actions | Automatisation qui met à jour `data/videos.json` chaque jour. | `.github/workflows/videos.yml` |
| `vendor/` | Bibliothèques copiées dans le dépôt (pdf.js), sans CDN. | `vendor/pdfjs` |
| Instantané (prévu) | Copie de l'état de l'app déposée dans le dépôt pour que le serveur MCP la lise ; n'existe pas encore ([fiche](features/mcp.md)). | plan MCP |

## Suivi de projets

| Terme | Définition | Où |
|---|---|---|
| Sous-tâche | To-do rattaché à un autre par `parentId` ; un seul niveau (le parent n'est pas lui-même une sous-tâche). | `js/tasks-logic.js` |
| Progression | Avancement de 0 à 1 : part des sous-tâches faites, ou moyenne des tâches de niveau 1 d'un projet, d'un cours ou d'un objectif. | `js/tasks-logic.js` |
| Dépendance | Lien « bloquée par » : une tâche doit attendre qu'une autre soit terminée. | `js/deps-logic.js` |
| Tâche bloquée | Tâche dont un blocage n'est pas terminé (ou dont le parent est bloqué) ; signalée, démarrable en confirmant. | `js/deps-logic.js` |
| Tâche prête | Tâche non terminée, non bloquée et sans sous-tâche ouverte : ce qu'on peut faire maintenant. | `js/deps-logic.js` |
| Ordre conseillé | Classement des tâches d'un projet où les blocages passent avant ce qui en dépend (tri topologique). | `js/deps-logic.js` |
| `doneAt` | Date de fin d'une tâche, posée quand elle passe à « Terminés ». | `js/tasks-logic.js` |
| `effort` | Durée estimée d'une tâche en minutes, utilisée par la charge de travail. | `js/store.js` |
| Projet | Regroupement de to-dos pour un travail borné, avec cours et échéance facultatifs. | `js/modules/projects.js` |
| Mode de progression | Façon dont avance un objectif : `time` (temps écoulé), `manual` (curseur) ou `auto` (travail relié). | `js/goals-logic.js` |
| Lien d'objectif | Référence d'un objectif automatique vers un projet, un cours ou un to-do ; « Lien cassé » si l'élément a disparu. | `js/goals-logic.js` |
| Statut d'objectif | « Dans les temps », « À risque », « En retard » ou « Atteint » : le travail fait comparé au temps écoulé. | `js/goals-logic.js` |
| Capacité | Minutes de travail par jour au-delà desquelles un jour est signalé en surcharge. | `js/reports-logic.js` |
| Charge de travail | Minutes planifiées (plages, sessions Focus) plus effort estimé des tâches sans plage, jour par jour. | `js/reports-logic.js` |
