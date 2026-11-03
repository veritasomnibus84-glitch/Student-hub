# Documentation de Student Hub

Student Hub est une application web (HTML, CSS, JavaScript, sans framework) qui centralise la vie d'étudiant : cours et tâches, agenda, concentration (Focus), mémorisation par cartes, bibliothèque de PDF, notes, liens, objectifs. Les données restent sur l'appareil ; une synchronisation Supabase est possible en option.

## Par où commencer

| Je veux… | Je lis |
|---|---|
| comprendre le projet en 10 minutes | [ARCHITECTURE](ARCHITECTURE.md) |
| comprendre un mot du projet | [GLOSSAIRE](GLOSSAIRE.md) |
| installer, tester, publier, proposer une modification | [CONTRIBUTING](CONTRIBUTING.md) |
| modifier ou comprendre une fonctionnalité précise | [les fiches](features/README.md) |
| savoir pourquoi on a choisi X | [les décisions](decisions/README.md) |
| savoir ce qui reste à faire | [plan des tâches](plans/plan-taches.md) |
| lire la spécification d'origine | [SPEC](SPEC.md) |

## Contenu de `docs/`

| Chemin | Rôle | État |
|---|---|---|
| [ARCHITECTURE.md](ARCHITECTURE.md) | vue d'ensemble, flux, stack, arborescence commentée, modèle de données | rédigé |
| [GLOSSAIRE.md](GLOSSAIRE.md) | vocabulaire du domaine et du projet | rédigé |
| [CONTRIBUTING.md](CONTRIBUTING.md) | conventions, tests, workflow Git, revue | rédigé |
| [features/](features/README.md) | une fiche par fonctionnalité (gabarit en 11 sections, pseudo-code) : 37 fiches | rédigé |
| [decisions/](decisions/README.md) | une décision d'architecture par fichier (ADR) : 19 décisions | rédigé |
| [CHANGELOG.md](CHANGELOG.md) | historique reconstitué par jalons, défauts connus | rédigé |
| [DEPANNAGE.md](DEPANNAGE.md) | symptôme → cause → solution | rédigé |
| [SPEC.md](SPEC.md) | spécification d'origine et évolutions | conservé |
| [plans/](plans/plan-taches.md) | plans de travail : tâches, MCP, documentation | conservé |
| [fds-tutor.md](fds-tutor.md) | prompt système du tuteur IA (source de `js/tutor-prompt.js`) | conservé |

L'ordre de rédaction est décrit dans le [plan de documentation](plans/plan-documentation.md).

## Principes

- **Du général au particulier** : l'architecture d'abord, la fiche dont on a besoin ensuite.
- **Lier la doc au code** : chemins exacts, liens croisés ; un test vérifie qu'ils existent.
- **Montrer avant d'expliquer** : schéma, exemple concret, puis règles et pseudo-code.
- **Expliquer le « pourquoi »** : le code montre déjà le « comment ».
