# Student Hub

Une application web pour centraliser la vie d'étudiant : cours et tâches, agenda, concentration (Focus), mémorisation par cartes à répétition espacée, bibliothèque de PDF, notes, liens, objectifs. HTML, CSS et JavaScript, **sans framework ni build**. Les données restent sur ton appareil ; une synchronisation Supabase est possible en option. Application installable, qui marche hors ligne.

**12 onglets** : Home, Workspace, Agenda, Focus, Mémorisation, Biblio, Messages, Vidéos, Notes, Liens, Objectifs, Paramètres.

## Lancer en 5 minutes

```
git clone <ce dépôt> && cd student-hub
python3 -m http.server 8080        # puis ouvrir http://localhost:8080
npm install && npm test            # facultatif : les tests (tous doivent passer)
```

Les modules ES ne fonctionnent pas en ouvrant `index.html` directement : il faut un petit serveur.

## Publier (GitHub Pages)

Envoie **tous** les fichiers et dossiers du dépôt (`js`, `css`, `assets`, `icons`, `vendor`, `docs`, `scripts`…), puis active GitHub Pages sur la branche `main`. Après toute modification d'un fichier de l'app, lance `npm run build:sw` (sinon le mode hors ligne sert l'ancienne version). Un dépôt privé exige un compte GitHub payant pour Pages.

> Dépôt public : ne mets aucune donnée privée dans le dépôt (vrais résumés d'e-mails ou de messages, sauvegardes exportées, clés secrètes).

## Documentation

Tout est dans [`docs/`](docs/README.md) :

- [ARCHITECTURE](docs/ARCHITECTURE.md) : vue d'ensemble, flux de données, stack, arborescence commentée.
- [GLOSSAIRE](docs/GLOSSAIRE.md) : le vocabulaire du projet.
- [CONTRIBUTING](docs/CONTRIBUTING.md) : conventions, tests, workflow Git, publication.
- [Fiches de fonctionnalités](docs/features/README.md) : une fiche détaillée par fonctionnalité.
- [Décisions d'architecture](docs/decisions/README.md) et [plans de travail](docs/plans/plan-taches.md).
