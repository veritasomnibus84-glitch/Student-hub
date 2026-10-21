// Objectifs (à x mois ou x années) et conseils (guide d'utilisation de Student Hub pré-rempli).
import { ymd } from './calendar-logic.js';

const str = (v, max = 5000) => (typeof v === 'string' ? v.slice(0, max) : '');
const objs = (x) => (Array.isArray(x) ? x.filter((i) => i && typeof i === 'object') : []);
const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);
export const UNITS = [['months', 'mois'], ['years', 'ans']];

export function dueDate(start, amount, unit) {
  const d = new Date(`${start}T00:00:00`); const day = d.getDate();
  d.setDate(1); d.setMonth(d.getMonth() + (unit === 'years' ? amount * 12 : amount));
  d.setDate(Math.min(day, new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()));
  return ymd(d);
}
export const newGoal = (p = {}) => {
  const g = { id: uid(), title: '', detail: '', start: ymd(new Date()), amount: 3, unit: 'months', done: false, ...p };
  return { ...g, due: dueDate(g.start, g.amount, g.unit) };
};
export function progress(goal, today) {
  const a = Date.parse(`${goal.start}T00:00:00`); const b = Date.parse(`${goal.due}T00:00:00`); const t = Date.parse(`${today}T00:00:00`);
  return { ratio: Math.min(1, Math.max(0, (t - a) / (b - a))), daysLeft: Math.round((b - t) / 86400000) };
}

export function sanitizeGoals(r) {
  const goals = objs(r.goals).filter((g) => /^\d{4}-\d{2}-\d{2}$/.test(g.start)).map((g) => {
    const amount = Math.min(120, Math.max(1, Math.round(typeof g.amount === 'number' && Number.isFinite(g.amount) ? g.amount : 1)));
    const unit = g.unit === 'years' ? 'years' : 'months';
    return { id: str(g.id, 40) || uid(), title: str(g.title, 300) || 'Objectif', detail: str(g.detail, 5000), start: g.start, amount, unit, due: dueDate(g.start, amount, unit), done: g.done === true };
  });
  let tips = objs(r.tips).map((t) => ({ id: str(t.id, 40) || uid(), title: str(t.title, 300) || 'Conseil', body: str(t.body, 20000) }));
  // Le guide est ajouté une seule fois ; si tu supprimes un conseil, il ne revient pas.
  if (r.tipsSeeded !== true) tips = [...guideTips().filter((g) => !tips.some((t) => t.id === g.id)), ...tips];
  return { goals, tips, tipsSeeded: true };
}

export function guideTips() {
  const t = (n, title, body) => ({ id: `guide-${n}`, title, body: body.trim() });
  return [
    t(1, 'Guide : bien démarrer', `
Student Hub est une page web unique, pensée pour le téléphone. Les onglets sont en bas de l'écran (en haut sur ordinateur) : Home, Workspace, Agenda, Focus, Mémorisation, Biblio, Messages, Vidéos, Notes, Liens, Objectifs.
• Tes données (cours, to-dos, événements, notes, liens, cartes, objectifs) restent dans le navigateur de l'appareil. Elles ne sont envoyées nulle part.
• Pour l'ouvrir plus vite : menu du navigateur → « Ajouter à l'écran d'accueil » (c'est un raccourci, pas une application installée).
• Chaque onglet a, en bas, un panneau « Données » pour exporter ou importer ses seules données. La sauvegarde complète est dans Home.`),
    t(2, 'Guide : Home', `
Home est ton tableau de bord. Tu y trouves la salutation et l'heure, une recherche globale (cours, to-dos, événements, notes, livres, liens), ce qui est prévu aujourd'hui, les 7 jours à venir, un mini-calendrier, tes tâches en cours, tes éléments récents, ton temps de Focus du jour, tes messages non lus et le bloc Mémorisation (cartes à réviser, série, tâches du planning).
• Boutons rapides : + To-do, + Événement, + Note, Note du jour.
• Pour terminer une tâche, touche le ✓ à côté d'elle.
• « Sauvegarde et données » (en bas) : tout exporter ou importer, définir un verrou, réinitialiser.`),
    t(3, 'Guide : Workspace (cours et to-dos)', `
Workspace reprend la structure du template Notion « Student Ultimate ».
• Cours : une page par cours avec code, année, prof, travaux, examen, bureau, horaire, e-mail, salle, notes, lectures, questions et syllabus. Les 8 cours de MPC1 sont déjà créés ; tu peux en ajouter ou en supprimer.
• To-dos : un tableau à 4 colonnes (À faire, En cours, Terminés, Sans statut). Le bouton → fait avancer le statut. Tu peux chercher, filtrer, trier et supprimer.
• Une date d'examen saisie dans un cours apparaît automatiquement dans l'Agenda.
• « Planifier dans l'agenda » transforme une tâche en événement, à sa date limite.`),
    t(4, 'Guide : Agenda', `
L'Agenda s'inspire de l'application Agenda de Linux Mint.
• Trois vues : semaine, mois, année.
• Créer vite : touche un créneau de la semaine, fais un double-clic sur un jour du mois, ou utilise « + Événement ».
• Un événement a un titre, un lieu, une description, des heures (ou journée entière), une répétition (jour, semaine, mois, an) et un rappel.
• Plusieurs agendas colorés, que tu peux afficher ou masquer.
• Les dates limites des to-dos et les examens s'affichent tout seuls.
• Limites : les rappels ne sonnent que si l'app est ouverte ; il n'y a pas de synchronisation Google (importe ou exporte un fichier .ics) ; un événement tient sur un seul jour.`),
    t(5, 'Guide : Focus', `
Focus est un minuteur de concentration : pendant la session, un arbre pousse en 5 étapes.
• Si tu quittes la page plus de 10 secondes (autre application, écran verrouillé), l'arbre meurt. Seuls les arbres réussis comptent dans ton temps total.
• Donne un titre, un tag, et si tu veux une tâche ou un événement liés. À la fin, un clic marque la tâche terminée.
• Les statistiques (jour, semaine, mois, année) montrent arbres plantés et morts, temps total, ton meilleur jour et ta meilleure heure, et la répartition par tag.
• Le chronomètre suit l'heure réelle : il reste exact même si le navigateur ralentit la page.`),
    t(6, 'Guide : Mémorisation (vue d\'ensemble)', `
Mémorisation t'aide à retenir tes cours avec des cartes et la répétition espacée.
1. Touche « + Leçon » : donne un nom, un cours et, si tu veux, ta date d'examen.
2. Dans la leçon, trois sous-onglets :
• Apprendre : colle le texte de ton cours (source), règle la date d'examen, la note visée, le format d'examen et ton temps maximum par jour. Le planning optimal s'affiche.
• Retenir : tes cartes (6 types : question/réponse, définition, mot/traduction, QCM, vrai/faux, à trous), la barre maîtrisées / en cours / à étudier, le bouton Réviser, l'import CSV et la génération par IA.
• S'exercer : examens chronométrés, historique de tes notes, et journal de tes blocages.
3. La série compte les jours où tu as révisé au moins une carte ou passé un examen.`),
    t(7, 'Guide : Mémorisation, créer des cartes', `
Trois façons d'ajouter des cartes :
• À la main : « + Carte ». Choisis le type, écris la question et la réponse, et une explication (le pourquoi) : c'est elle qui t'aide quand tu te trompes. Tu peux classer la carte en noyau, pilier ou détail.
• Avec une IA : « Générer avec une IA ». L'app ne contient aucune clé. Colle ton cours, choisis le type et le nombre, touche « Copier le prompt », colle-le dans Claude ou ChatGPT, puis colle sa réponse (du JSON) dans l'app et importe.
• Par fichier : « Importer » accepte un CSV, un TSV ou un export texte d'Anki (une carte par ligne : question ; réponse).
Avant de garder des cartes générées, relis-les : une IA peut se tromper. Supprime celles que ton cours ne soutient pas.`),
    t(8, 'Guide : Mémorisation, réviser', `
Touche « Réviser » pour lancer une session : d'abord les cartes dues, puis des nouvelles (20 au maximum), les noyaux avant les détails.
• Réponse libre : réfléchis, touche « Révéler », puis note-toi : À revoir (revient très vite), Moyen (revient plus tard dans la session), Bien (la carte sort de la session). Sous chaque bouton, l'app affiche quand la carte reviendra.
• QCM et vrai/faux : touche ta réponse, la correction est immédiate et la note automatique.
• À trous : écris le mot manquant, puis « Vérifier ».
• Clavier : Espace pour révéler, 1, 2, 3 pour noter.
• Le calendrier de révision est calculé par l'algorithme FSRS-6 : plus tu réussis une carte, plus elle revient tard.
Règle d'or : essaie toujours de répondre AVANT de révéler. Relire donne l'impression de savoir ; se tester fait vraiment retenir.`),
    t(9, 'Guide : Mémorisation, examens et planning', `
S'exercer → « Commencer un examen » : choisis l'affichage (toutes les questions ou une par une), la durée (5 min à 1 h), les types de cartes, le nombre de questions, et ta note prédite. Le minuteur démarre.
• QCM, vrai/faux et trous sont corrigés automatiquement. Pour les réponses libres, tu te corriges toi-même (faux, partiel, juste) ou tu copies un prompt de correction pour une IA et tu colles ses scores.
• Résultat : note sur 20, écart avec ta prédiction, notions les plus faibles. Les cartes ratées repassent « à étudier ».
• Note ensuite tes blocages dans le journal : l'app peut générer le prompt de rattrapage.
Planning (onglet Apprendre) : avec une date d'examen, l'app répartit les nouvelles cartes jusqu'à environ 60 % du délai, réserve la fin aux révisions et place des examens blancs 7 et 2 jours avant. Plus la note visée est haute, plus il y a de cartes à couvrir. Les jauges sont des estimations, pas des promesses.`),
    t(10, 'Guide : Bibliothèque (PDF)', `
Ta bibliothèque de cours et d'exercices, inspirée de Librera.
• Sections : Bibliothèque, Dossiers, Récents, Favoris, Signets. Vues : couvertures, grille, liste, condensée.
• Recherche, tri et regroupement (auteur, tag, dossier).
• Lecteur intégré : zoom, signets, reprise à la dernière page, progression.
• Les PDF restent dans le navigateur de CHAQUE appareil et ne partent jamais sur GitHub (droits d'auteur). Seul le catalogue (titres, tags, favoris, signets) s'exporte.
• Sur un autre appareil : importe le catalogue, touche un livre « Fichier absent de cet appareil » et choisis le même PDF : il est reconnu (nom et taille).`),
    t(11, 'Guide : Messages', `
Messages regroupe les résumés de tes e-mails (Gmail) et de tes conversations (WhatsApp) écrits par Hermes.
• Hermes écrit le fichier data/summaries.json du dépôt ; l'app le lit.
• Chaque résumé a une source, un expéditeur, un sujet facultatif, le texte et la date. Home affiche le nombre de messages non lus.
• Tu peux aussi importer à la main un fichier summaries.json.
• Les deux exemples « demo » sont à supprimer quand Hermes écrit pour de vrai.`),
    t(12, 'Guide : Vidéos', `
Vidéos affiche les dernières vidéos des chaînes YouTube que tu choisis.
• Liste tes chaînes dans data/channels.json : [{ "name": "Nom", "channelId": "UC…" }] (l'identifiant fait 24 caractères et commence par UC).
• Chaque jour, une Action GitHub lit les flux des chaînes et met à jour data/videos.json ; l'app affiche ce fichier.
• Tu peux aussi importer un videos.json à la main.`),
    t(13, 'Guide : Notes et Liens', `
Notes : crée des morceaux de notes et range-les où tu veux (dans un cours ou dans Général), épingle-les, réordonne-les, et rattache-les à un événement. « Note du jour » (dans Home) crée la note datée d'aujourd'hui.
Liens : tes liens utiles avec une description et une catégorie. Seules les adresses http et https s'ouvrent.`),
    t(14, 'Guide : Objectifs et conseils', `
Objectifs : « Établir un objectif », donne un titre, une date de début et une durée en mois ou en années. L'app calcule l'échéance et affiche une barre de progression du temps et le nombre de jours restants. Touche « Terminé » quand tu l'as atteint.
Conseils : « Ajouter un conseil » crée ta propre fiche. Ce guide est un ensemble de conseils comme les autres : tu peux les modifier ou les supprimer, ils ne reviennent pas.`),
    t(15, 'Guide : sauvegarder et changer d\'appareil', `
Tes données vivent dans le navigateur : si tu vides ses données ou changes de téléphone, elles disparaissent. Exporte régulièrement.
• Home → « Sauvegarde et données » → « Tout exporter » : un fichier JSON avec tous les onglets (sans les PDF).
• Sur le nouvel appareil : Home → « Tout importer » (fusionner ou remplacer).
• Chaque onglet peut aussi exporter et importer ses seules données ; un fichier d'un autre onglet est refusé.`),
    t(16, 'Guide : verrou et confidentialité', `
Home → « Sauvegarde et données » → « Définir un verrou » : choisis un nom et un mot de passe, demandés à chaque session.
• C'est un écran de connexion local : il ne chiffre PAS tes données et ne remplace pas un vrai compte.
• « Mot de passe oublié » efface le verrou ET les données de l'appareil : garde une sauvegarde.
• L'app n'utilise aucun token GitHub dans le navigateur et n'envoie pas tes données à un serveur.`),
    t(17, 'Guide : mettre à jour le site sur GitHub Pages', `
Pour publier une nouvelle version : décompresse le zip, puis envoie TOUS les fichiers et dossiers dans ton dépôt GitHub (js, css, assets, vendor, data, tests…). Si un dossier manque, le site garde l'ancienne version ou s'affiche à moitié.
• Après l'envoi, attends une minute puis recharge la page sans cache (ou ouvre-la en navigation privée).
• Vérifie que tu vois bien tous les onglets, dont Mémorisation et Objectifs.
• Un dépôt privé exige un compte GitHub payant pour GitHub Pages.`),
    t(18, 'Conseil d\'étude : se tester plutôt que relire', `
Les études sur la mémoire sont constantes : se tester (rappel actif) fait retenir bien plus longtemps que relire, même si relire donne plus confiance. Ferme ton cours, réponds de tête, puis compare. Les cartes de Mémorisation sont faites pour ça.
Vise aussi l'espacement : revoir un peu chaque jour vaut mieux qu'une longue séance la veille de l'examen.`),
    t(19, 'Conseil d\'étude : séances et pauses', `
Choisis la durée de séance selon ton énergie : une séance courte (15 minutes) quand tu es fatigué ou que le sujet est difficile ; 30 à 45 minutes en temps normal ; 45 à 90 minutes seulement si tu es en forme et que le sujet t'est familier, avec une pause. Ne dépasse pas 60 minutes d'affilée sans pause.
Ces durées sont des valeurs de départ : observe combien de cartes tu maîtrises par heure et ajuste. Donne-toi un objectif précis par séance (par exemple « répondre à 12 questions sur le noyau 2 »), et lance un Focus pour la tenir.`),
  ];
}
