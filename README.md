# Student Hub

Une page, onze onglets : Home (accueil façon Obsidian), Workspace (cours + to-dos façon Notion), Agenda, Focus (minuteur façon Forest), Mémorisation (cartes à répétition espacée), Bibliothèque (PDF), Messages (résumés Hermes), Vidéos, Notes, Liens utiles, Objectifs (objectifs à x mois ou x ans + conseils, avec le guide complet de l'app).
Aucun framework, aucun build. Thème « cahier Seyès » (clair) / « tableau » (sombre) selon le téléphone.

## Lancer
    python3 -m http.server 8080      # puis http://localhost:8080
(les modules ES ne fonctionnent pas en ouvrant index.html directement). Tests : `npm install && npm test`.
Hébergement : GitHub Pages (un repo privé exige un compte GitHub payant pour Pages).

## Home
Salutation, heure, recherche globale (cours, to-dos, événements, notes, livres, liens), aujourd'hui, à venir sur 7 jours, mini-calendrier, tâches (✓ pour terminer), récents, messages non lus, note du jour.

## Mémorisation (inspirée de Diane)
Leçons → trois sous-onglets.
- **Apprendre** : source du cours (texte collé), date d'examen, note visée /20, format d'examen, temps max par jour, **planning optimal** calculé par code (écart conseillé 30 % à 7 j → 7,5 % à 1 an, interpolé ; nouvelles cartes sur ~60 % du délai ; examens blancs à J-7 et J-2 ; plafond de minutes par jour) et jauges « temps gagné » / « maîtrise » (estimations).
- **Retenir** : 6 types de cartes (question/réponse, définition, mot/traduction avec médiateur, QCM, vrai/faux, à trous), couches noyau/pilier/détail, barre maîtrisées/en cours/à étudier, vue liste ou grille, session de révision (3 boutons avec intervalles, QCM/V-F/trous corrigés tout seuls, lecture à voix haute si le navigateur la permet, clavier Espace et 1-2-3), import CSV/TSV/Anki, génération par IA sans clé (prompt à copier, JSON à coller). Répétition espacée FSRS-6 (paramètres de py-fsrs).
- **S'exercer** : examen chronométré (affichage, durée, types, nombre, note prédite), correction (automatique ou, pour les réponses libres, auto-évaluation ou scores collés d'une IA), note /20, écart avec la prédiction, erreurs remises « à étudier », historique, journal des blocages + prompt de rattrapage.
La série compte les jours de révision ; Home affiche les cartes dues et les tâches du jour du planning.
Pas encore : planning branché sur l'Agenda, chat tuteur (fds-tutor.md), fiches et podcast.

## Objectifs
Établir un objectif pour x mois ou x ans (échéance, barre de temps écoulé, jours restants). Conseils : le guide d'utilisation complet est pré-rempli (modifiable, supprimable, jamais rajouté) ; bouton « Ajouter un conseil ».

## Agenda
Vues semaine / mois / année, création rapide (clic sur un créneau de la semaine, double-clic sur un jour du mois, ou « + Événement »), titre, lieu, description, heures ou journée entière, répétition (jour, semaine, mois, an, jusqu'au…), rappels, plusieurs agendas colorés affichables ou masquables, recherche. Les deadlines de to-dos et les dates d'examen s'affichent automatiquement.
- Rappels : affichés tant que l'app est ouverte (notification du navigateur si autorisée). Pas de rappel quand l'app est fermée (il faudrait une PWA + un serveur de notifications).
- Pas de synchronisation Google/Nextcloud/Exchange (elle exigerait de stocker des identifiants) : importe ou exporte un fichier `.ics`.
- Limites connues : un événement tient sur un seul jour ; une série se modifie en bloc (pas d'exception sur une occurrence).

## Focus
Minuteur de concentration : un arbre pousse en 5 étapes pendant la session. Si tu quittes l'app plus de 10 secondes (autre application, écran verrouillé, rechargement tardif), l'arbre meurt. Tags (modifiables), titre, tâche liée et événement liée à la session ; en fin de session, un clic marque la tâche terminée.
Statistiques jour / semaine / mois / année : arbres plantés et morts, temps total, jour et heure de concentration maximale, tendance, répartition par tag, temps par tâche et par événement.
- Le chronomètre se base sur l'heure réelle (pas sur des ticks) : il reste exact quand le navigateur ralentit l'onglet. Seuls les arbres réussis comptent dans le temps total.
- Limite : un site web ne voit pas quelle autre application tu ouvres, seulement que la page n'est plus visible.

## Tâches, événements et notes
Un événement peut avoir plusieurs tâches et plusieurs notes (créer, lier une existante, délier). Une tâche peut devenir un événement : « Planifier dans l'agenda » (à sa deadline). Une note peut être rattachée à un événement. Supprimer un événement délie ses tâches et notes sans les supprimer.

## Import / export
- Chaque onglet a son panneau « Données — … » : exporter ou importer **uniquement ses données** (fusionner ou remplacer). Un fichier d'un autre onglet est refusé.
- La page Home a « Sauvegarde et données » : tout exporter / tout importer, onglet par onglet, verrou et réinitialisation.
- Messages et Vidéos acceptent aussi directement les fichiers `summaries.json` et `videos.json`.
- Les PDF ne sont jamais exportés (ils restent sur chaque appareil).

## Verrou d'accès
Page Home → « Sauvegarde et données » → « Définir un verrou » (nom + mot de passe). L'app demande alors la connexion à chaque session. C'est un écran de connexion local : il ne chiffre pas les données et ne remplace pas un vrai compte. « Mot de passe oublié » efface le verrou **et** les données de l'appareil.

## Bibliothèque (PDF)
Sections : Bibliothèque, Dossiers, Récents, Favoris, Signets. Vues : couvertures, grille, liste, condensée. Recherche, tri, regroupement (auteur, tag, dossier).
Lecteur intégré (pdf.js, copie locale dans `vendor/pdfjs`, licence Apache 2.0) : zoom, signets, reprise à la dernière page, progression.
- Les PDF sont stockés **dans le navigateur de chaque appareil** (IndexedDB) : ils ne sont jamais envoyés sur GitHub.
- Le **catalogue** (titres, tags, favoris, signets, progression) est dans les données exportables.
- Sur un deuxième appareil : importe ton catalogue, puis touche un livre « Fichier absent de cet appareil » et choisis le même PDF ; il est reconnu (nom + taille) et relié.
- Tests navigateur réel : `python3 -m http.server 8765` puis `python3 tests/e2e/library.e2e.py`, `app.e2e.py` et `focus.e2e.py` (Playwright + reportlab).

## Données
- **Éditables dans l'app** (cours, to-dos, notes, liens) : stockées dans le navigateur. Bouton « Données » en bas : Exporter / Importer / Réinitialiser.
- **summaries.json** (Hermes écrit ce fichier) : liste d'objets
  `{ "id": "unique", "source": "gmail" | "whatsapp", "from": "…", "subject": "…(optionnel)", "summary": "…", "date": "2026-10-17T08:10:00Z" }`
  Les deux entrées « demo-… » sont des exemples à supprimer.
- **channels.json** : `[{ "name": "Nom affiché", "channelId": "UC…(24 caractères)" }]`. L'Action `.github/workflows/videos.yml`
  (ou `node scripts/fetch-videos.mjs`) remplit `videos.json` chaque jour.

## Sécurité
CSP stricte (aucun script inline), contenu toujours inséré comme texte, URL limitées à http(s).
Aucun token GitHub n'est stocké dans le navigateur : la synchro passe par des fichiers du repo et des Actions.

## Construire avec les skills
`npx skills add addyosmani/agent-skills` dans OpenCode ou Claude Code, puis `/spec`, `/plan`, `/build`. Voir SPEC.md et tasks/plan.md.
