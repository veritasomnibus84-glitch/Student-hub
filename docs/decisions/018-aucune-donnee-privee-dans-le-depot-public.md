# ADR-018 — Aucune donnée privée dans le dépôt public

**Statut :** Acceptée · **Date :** octobre 2026

## Contexte

Le dépôt GitHub de Student Hub est **public**. Hermes écrit des résumés de vrais e-mails et conversations dans `data/summaries.json`, l'app exporte des sauvegardes, et le plan MCP prévoyait un instantané et une boîte de réception dans le dépôt : tout cela serait lisible par n'importe qui.

## Décision

**Rien de privé n'est commité dans le dépôt public.** Concrètement : (1) `data/summaries.json` ne contient que des **exemples fictifs** ; (2) les **sauvegardes exportées** (`student-hub-*.json`) ne sont jamais commitées (motif ajouté à `.gitignore`) ; (3) aucune clé secrète (`service_role`, mots de passe) ; la clé « anon public » se saisit dans l'app, pas dans le code ; (4) les PDF restent sur l'appareil ([ADR-003](003-pdf-par-appareil.md)) ; (5) les futurs instantanés et boîtes de réception ne vont pas dans le dépôt.

## Alternatives rejetées

- **Passer le dépôt en privé** : GitHub Pages sur un dépôt privé demande un compte payant (information non vérifiée) ; reste une option.
- **Un dépôt privé séparé pour les données** : un second dépôt à maintenir.
- **Chiffrer les fichiers avant commit** : une clé à gérer, et les métadonnées restent visibles.
- **Accepter la publication** : rejeté.

## Conséquences

- Hermes ne peut pas écrire de vrais résumés dans ce dépôt : il faut une autre destination (une table Supabase protégée, ou un dépôt privé) — **à concevoir**.
- Le [plan MCP](../plans/plan-mcp.md) est à revoir : l'instantané et la boîte de réception ne peuvent pas être dans le dépôt public.
- Si une donnée privée a été commitée par erreur, la considérer comme **publique** : retirer le fichier ne suffit pas (historique, copies) ; régénérer les secrets concernés.
- Règle rappelée dans [CONTRIBUTING](../CONTRIBUTING.md).

## Code concerné

- `data/summaries.json`
- `.gitignore`
- `js/ui/data-panel.js`
- `docs/CONTRIBUTING.md`
