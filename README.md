# Student Hub

Une page, cinq onglets : Workspace (cours + to-dos façon Notion), Messages (résumés Hermes), Vidéos, Notes, Liens utiles.
Aucun framework, aucun build. Thème « cahier Seyès » (clair) / « tableau » (sombre) selon le téléphone.

## Lancer
    python3 -m http.server 8080      # puis http://localhost:8080
(les modules ES ne fonctionnent pas en ouvrant index.html directement). Tests : `npm install && npm test`.
Hébergement : GitHub Pages (un repo privé exige un compte GitHub payant pour Pages).

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
