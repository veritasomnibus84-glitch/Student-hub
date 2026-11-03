// Objectifs (à x mois ou x années) et conseils (guide d'utilisation de Student Hub pré-rempli).
import { ymd } from './calendar-logic.js';
import { rollup, itemProgress, projectTodos } from './tasks-logic.js';

const str = (v, max = 5000) => (typeof v === 'string' ? v.slice(0, max) : '');
const objs = (x) => (Array.isArray(x) ? x.filter((i) => i && typeof i === 'object') : []);
const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);
export const UNITS = [['months', 'mois'], ['years', 'ans']];
// Comment un objectif avance : avec le temps (comme avant), à la main, ou à partir du travail relié (projets, cours, tâches).
export const MODES = [['time', 'Temps écoulé'], ['manual', 'Manuel'], ['auto', 'Automatique (travail relié)']];
export const LINK_KINDS = ['project', 'course', 'todo'];
export const MAX_LINKS = 100;

export function dueDate(start, amount, unit) {
  const d = new Date(`${start}T00:00:00`); const day = d.getDate();
  d.setDate(1); d.setMonth(d.getMonth() + (unit === 'years' ? amount * 12 : amount));
  d.setDate(Math.min(day, new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()));
  return ymd(d);
}
export const newGoal = (p = {}) => {
  const g = { id: uid(), title: '', detail: '', start: ymd(new Date()), amount: 3, unit: 'months', done: false, mode: 'time', manual: 0, links: [], ...p };
  return { ...g, due: dueDate(g.start, g.amount, g.unit) };
};
export function progress(goal, today) {
  const a = Date.parse(`${goal.start}T00:00:00`); const b = Date.parse(`${goal.due}T00:00:00`); const t = Date.parse(`${today}T00:00:00`);
  return { ratio: Math.min(1, Math.max(0, (t - a) / (b - a))), daysLeft: Math.round((b - t) / 86400000) };
}

// Liens d'un objectif automatique : type valide, identifiant court, sans doublon, 100 au plus.
function cleanLinks(x) {
  const seen = new Set();
  return objs(x).filter((l) => LINK_KINDS.includes(l.kind) && typeof l.id === 'string' && l.id.length > 0 && l.id.length <= 40)
    .filter((l) => { const k = `${l.kind}:${l.id}`; if (seen.has(k)) return false; seen.add(k); return true; })
    .slice(0, MAX_LINKS).map((l) => ({ kind: l.kind, id: l.id }));
}

// Avancement (0 à 1) d'un élément relié ; null si l'élément n'existe plus (lien cassé).
export function linkRatio(link, state) {
  const { todos = [], projects = [], courses = [] } = state;
  if (link.kind === 'project') return projects.some((p) => p.id === link.id) ? rollup(projectTodos(todos, link.id), todos) : null;
  if (link.kind === 'course') return courses.some((c) => c.id === link.id) ? rollup(todos.filter((t) => t.courseId === link.id), todos) : null;
  const t = todos.find((x) => x.id === link.id);
  return t ? itemProgress(t, todos) : null;
}

// Avancement d'un objectif et statut « à la Asana » : on compare le travail fait au temps écoulé.
export function goalProgress(goal, state, today) {
  const time = progress(goal, today);
  let work = time.ratio; let linked = 0; let broken = 0;
  if (goal.mode === 'manual') work = Math.min(100, Math.max(0, goal.manual ?? 0)) / 100;
  else if (goal.mode === 'auto') {
    const vals = (goal.links ?? []).map((l) => linkRatio(l, state));
    const ok = vals.filter((v) => v !== null);
    linked = ok.length; broken = vals.length - ok.length;
    work = ok.length ? ok.reduce((n, v) => n + v, 0) / ok.length : 0;
  }
  let status = '';
  if (goal.done || (goal.mode !== 'time' && work >= 1)) status = 'Atteint';
  else if (goal.mode !== 'time') {
    const gap = work - time.ratio;
    status = gap >= -0.1 ? 'Dans les temps' : gap >= -0.25 ? 'À risque' : 'En retard';
  }
  return { mode: goal.mode ?? 'time', work, time: time.ratio, daysLeft: time.daysLeft, status, linked, broken };
}

// Objectifs automatiques reliés à un élément (pour la page d'un projet).
export const goalsLinkedTo = (goals, kind, id) => goals.filter((g) => g.mode === 'auto' && (g.links ?? []).some((l) => l.kind === kind && l.id === id));

export function sanitizeGoals(r) {
  const goals = objs(r.goals).filter((g) => /^\d{4}-\d{2}-\d{2}$/.test(g.start)).map((g) => {
    const amount = Math.min(120, Math.max(1, Math.round(typeof g.amount === 'number' && Number.isFinite(g.amount) ? g.amount : 1)));
    const unit = g.unit === 'years' ? 'years' : 'months';
    return {
      id: str(g.id, 40) || uid(), title: str(g.title, 300) || 'Objectif', detail: str(g.detail, 5000), start: g.start, amount, unit, due: dueDate(g.start, amount, unit), done: g.done === true,
      mode: MODES.some(([k]) => k === g.mode) ? g.mode : 'time',
      manual: Math.min(100, Math.max(0, Math.round(typeof g.manual === 'number' && Number.isFinite(g.manual) ? g.manual : 0))),
      links: cleanLinks(g.links),
    };
  });
  let tips = objs(r.tips).map((t) => ({ id: str(t.id, 40) || uid(), title: str(t.title, 300) || 'Conseil', body: str(t.body, 20000) }));
  // Le guide s'ajoute une seule fois ; un conseil supprimé ne revient pas. Une nouvelle version n'ajoute que les nouveaux conseils.
  const stored = typeof r.guideVersion === 'number' ? r.guideVersion : r.tipsSeeded === true ? 1 : 0;
  if (stored < GUIDE_VERSION) tips = [...allGuide().filter((g) => g.since > stored && !tips.some((t) => t.id === g.id)).map(({ since, ...tip }) => tip), ...tips];
  return { goals, tips, tipsSeeded: true, guideVersion: GUIDE_VERSION };
}

export const GUIDE_VERSION = 6; // monte quand on ajoute des conseils au guide : seuls les nouveaux s'ajoutent aux données existantes

function allGuide() {
  const t = (n, title, body, since = 1) => ({ id: `guide-${n}`, title, body: body.trim(), since });
  return [
    t(1, 'Guide : bien démarrer', `
Student Hub est une page web unique, pensée pour le téléphone. Les onglets sont en bas de l'écran (en haut sur ordinateur) : Home, Workspace, Agenda, Focus, Mémorisation, Biblio, Messages, Vidéos, Notes, Liens, Objectifs, Paramètres.
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
• Limites : les rappels ne sonnent que si l'app est ouverte ; il n'y a pas de synchronisation Google (importe ou exporte un fichier .ics).`),
    t(5, 'Guide : Focus', `
Focus est un minuteur de concentration : pendant la session, un arbre pousse en 5 étapes.
• Si tu quittes la page plus de 10 secondes (autre application, écran verrouillé), l'arbre meurt. 10 secondes est la valeur par défaut : elle se règle dans Paramètres → Focus, et l'écran de la session affiche la valeur réglée. Seuls les arbres réussis comptent dans ton temps total.
• Donne un titre, un tag, et si tu veux UNE tâche OU UN événement lié (pas les deux). Tu peux aussi planifier une session à l'avance. À la fin, un clic marque la tâche terminée.
• Les statistiques (jour, semaine, mois, année) montrent arbres plantés et morts, temps total, ton meilleur jour et ta meilleure heure, et la répartition par tag.
• Le chronomètre suit l'heure réelle : il reste exact même si le navigateur ralentit la page.`),
    t(6, 'Guide : Mémorisation (vue d\'ensemble)', `
Mémorisation t'aide à retenir tes cours avec des cartes et la répétition espacée.
1. Touche « + Leçon » : donne un nom, un cours et, si tu veux, ta date d'examen.
2. Dans la leçon, quatre sous-onglets :
• Apprendre : colle le texte de ton cours (source), règle la date d'examen, la note visée, le format d'examen et ton temps maximum par jour. Le planning optimal s'affiche.
• Retenir : tes cartes (6 types : question/réponse, définition, mot/traduction, QCM, vrai/faux, à trous), la barre maîtrisées / en cours / à étudier, le bouton Réviser, l'import CSV et la génération par IA.
• S'exercer : examens chronométrés, historique de tes notes, et journal de tes blocages.
• Tuteur : une session guidée avec ton IA (voir le conseil dédié).
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
    t(20, 'Guide : Paramètres et synchronisation', `
L'onglet Paramètres regroupe la synchronisation, les widgets et « À propos ».
Synchroniser tes appareils (facultatif) utilise un compte Supabase, un service en ligne gratuit à configurer toi-même :
1. Crée un projet sur supabase.com, puis crée la table user_state avec sa règle de sécurité (voir les instructions de ton assistant).
2. Dans Paramètres, renseigne l'adresse du projet et la clé « anon public » (jamais la clé « service_role »).
3. Crée un compte (e-mail et mot de passe) puis connecte-toi.
Boutons :
• Synchroniser maintenant : récupère les données du cloud, les fusionne avec celles de l'appareil, puis envoie le résultat.
• Remplacer le cloud : le cloud devient une copie exacte de cet appareil.
• Remplacer cet appareil : cet appareil devient une copie exacte du cloud.
Les suppressions sont synchronisées (marqueurs de suppression) : ce que tu supprimes sur un appareil disparaît des autres à leur prochaine synchronisation. « Remplacer le cloud » et « Remplacer cet appareil » restent là pour repartir d'une copie exacte.
Les PDF ne sont jamais envoyés. Ton mot de passe n'est pas enregistré ; la session de connexion reste dans le navigateur. Tes données sont stockées chez Supabase : à ne faire que si ça te convient.`, 2),
    t(21, 'Guide : menu contextuel (clic droit, appui long)', `
Sur la plupart des éléments (to-dos, cours, événements de l'Agenda, notes, liens, livres, messages, leçons, cartes, objectifs, conseils), un menu d'actions s'ouvre :
• sur ordinateur : clic droit ;
• sur téléphone : appui long (une demi-seconde) ;
• partout : le bouton « ⋯ » quand il est affiché.
Tu y trouves modifier, dupliquer, copier le texte, supprimer (avec confirmation), et des actions propres à chaque onglet : changer le statut d'un to-do, planifier dans l'agenda, démarrer un Focus lié à une tâche ou à un événement, changer la couche d'une carte, etc. Échap ou un appui ailleurs ferme le menu.`, 2),
    t(22, 'Guide : widgets', `
Les blocs de Home (Aujourd'hui, À venir, Mini-calendrier, Tâches, Récents, Focus, Mémorisation, Messages, Objectif en cours, Conseil du jour) sont des widgets. En bas de chaque onglet, une barre de widgets repliables affiche ceux que tu choisis, sauf ceux qui sont déjà le contenu de l'onglet.
Touche « Personnaliser » (sur Home, en bas d'un onglet ou dans Paramètres) : choisis l'onglet concerné, coche les widgets et change leur ordre avec les flèches ↑ ↓. Les choix sont enregistrés avec tes données.`, 2),
    t(23, 'Guide : Mémorisation, le tuteur IA', `
L'onglet Tuteur prépare une session guidée avec ton IA (Claude, ChatGPT…). L'app ne contient aucune clé : tout passe par copier-coller.
1. Dans Apprendre, colle le texte de ton cours (la source). Tu peux ajouter les corrigés validés par ton enseignant.
2. Dans Tuteur, choisis la durée (micro 15 min, standard 30 min, approfondi 60 min) puis copie le prompt du tuteur : colle-le en premier message dans une nouvelle conversation de ton IA.
3. Copie le contexte (ton profil, le plan de la session avec les notions à travailler dans l'ordre noyau, pilier, détail, et ta source) et colle-le en second message.
4. Travaille avec le tuteur. Il te guide sans te donner la solution d'emblée, il te fait rappeler ce que tu sais, et il clôt par un bilan.
5. Colle sa dernière réponse dans l'app : elle lit le bloc caché session_log, met à jour ton niveau, tes notions maîtrisées et faibles, ton journal des blocages, et garde les questions de rappel pour la session suivante.
Le tuteur suit le plan fourni : il ne décide pas à ta place de ce qui compte à l'examen. S'il n'y a pas de plan, il te demande ce qui est le plus urgent.`, 3),
    t(24, 'Guide : Apprendre (couches, fiche, podcast)', `
Tout part de la source du cours que tu colles dans Apprendre. Pour chaque outil, tu copies un prompt, tu le donnes à ton IA, puis tu colles sa réponse.
• Cartographie en couches : noyaux (les 3 à 5 idées sans lesquelles le reste n'a pas de sens), piliers, détails, un résumé en 2 minutes et des questions de rappel que tu peux transformer en cartes. Le planning et le tuteur travaillent d'abord les noyaux.
• Fiche : 4 styles (révision d'examen, mémorisation, vulgarisation, synthèse complète) et 4 longueurs (de la cheat sheet à la fiche détaillée).
• Podcast : un script à deux voix (Hôte et Experte) que la voix de ton navigateur lit, avec vitesse réglable. Si ton navigateur n'a pas de voix, le script reste lisible.
Relis toujours ce que l'IA produit : elle peut se tromper ou inventer.`, 3),
    t(25, 'Guide : XP et niveaux', `
Les XP récompensent la régularité : 1 à 3 XP par carte révisée (À revoir, Moyen, Bien), 10 XP et plus pour un examen terminé selon ta note, 10 XP par arbre planté dans Focus, 20 XP par session de tuteur enregistrée.
Le niveau monte de plus en plus lentement. Un plafond de 300 XP par jour évite de « farmer » : mieux vaut revenir chaque jour. Ton niveau apparaît dans Mémorisation et dans le widget « Niveau et XP ».`, 3),
    t(26, 'Guide : Agenda, événements longs, une seule occurrence, glisser pour créer', `
• Événement sur plusieurs jours : dans le formulaire, remplis « Se termine le ». Il s'affiche chaque jour (le premier jour jusqu'à minuit, les jours du milieu en « journée », le dernier jour depuis minuit).
• Événement répété : en le touchant, choisis « Cet événement seulement » (titre, jour, heures, lieu, description, ou suppression de cette occurrence seule) ou « Toute la série ». Dans l'écran d'une occurrence modifiée, « Revenir à la série » annule l'exception.
• Créer par glisser : dans la vue semaine, glisse sur une colonne pour tracer l'événement (pas de 15 minutes). À la souris, c'est immédiat ; au doigt, maintiens d'abord une demi-seconde, puis glisse. Un simple appui crée un événement de la durée réglée dans Paramètres (une heure au départ).
• Planning de Mémorisation : avec une date d'examen dans une leçon, les tâches du jour (nouvelles cartes, révisions, examens blancs) apparaissent dans l'Agenda. Tu peux les masquer dans « Agendas et réglages ».
• Glisser sur plusieurs colonnes crée un événement sur plusieurs jours ; glisser un événement d'un jour (souris ou stylet) le déplace.
L'export .ics reprend les événements longs et les exceptions de série.`, 3),
    t(27, 'Guide : tâche liée à un événement, plages de travail', `
Une tâche liée à un événement (champ « Événement lié » de sa fiche) peut être planifiée dans cet événement : « Planifier mon travail… » (fiche de la tâche, menu ⋯, ou menu d'une tâche de l'Agenda).
• Fin : « Un jour précis de l'événement » (utile pour un événement sur plusieurs jours) ou « La fin de l'événement » (pour une série : jusqu'à sa dernière occurrence ; une série sans fin demande un jour précis).
• Plages horaires : une ou plusieurs par jour (par exemple 9 h–9 h 30 et 14 h–15 h). Elles sont créées chaque jour où l'événement a lieu.
• Dans la vue semaine de l'Agenda, chaque plage s'affiche DANS le bloc de l'événement (☐ à faire, ☑ fait) ; hors des heures de l'événement, elle a son propre bloc.
• Touche une plage pour ouvrir la tâche ; son menu permet de la marquer faite, de la supprimer, ou de démarrer un Focus. Replanifier garde les plages déjà faites.`, 4),
    t(28, 'Guide : sessions Focus planifiées', `
Dans l'onglet Focus, « Planifier une session » (ou « Planifier un Focus… » dans le menu d'une tâche ou d'un événement) réserve un créneau : jour, heure, durée, tag.
Une session est liée à UNE tâche OU UN événement, jamais aux deux. Elle apparaît dans l'Agenda (« Focus : … ») et dans la liste « Sessions planifiées » de Focus, où « ▶ Lancer » prépare la session. Quand l'arbre est planté, la session planifiée est marquée faite.`, 4),
    t(29, 'Guide : Paramètres', `
L'onglet Paramètres regroupe :
• Apparence : thème clair, sombre ou automatique, taille du texte.
• Langues : langue des cartes, fiches et podcasts générés par ton IA, et voix de lecture. L'interface reste en français.
• Compte et sécurité : le verrou.
• Notifications : rappels d'événements (app ouverte) et autorisation du navigateur.
• Application : installation et mode hors ligne.
• Agenda : premier jour de la semaine, durée d'un nouvel événement, agenda par défaut (heures en 24 h).
• Focus : durée par défaut et délai avant que l'arbre meure.
• Mémorisation : rétention visée (plus elle est haute, plus les cartes reviennent souvent) et nombre de nouvelles cartes par session.
• Synchronisation et widgets.
Les réglages sont enregistrés avec tes données ; à la fusion entre appareils, chaque appareil garde les siens.`, 4),
    t(30, 'Guide : application installable et hors ligne', `
Student Hub peut s'installer comme une application : Paramètres → Application → « Installer l'application », ou menu du navigateur → « Installer l'application » / « Ajouter à l'écran d'accueil » (iPhone : Partager → Sur l'écran d'accueil).
Après un premier chargement complet, l'app s'ouvre sans réseau : tes données (stockées sur l'appareil) restent consultables et modifiables ; la synchronisation reprend au retour du réseau. Les vignettes YouTube et les données récentes de Hermes demandent du réseau.
Quand une nouvelle version est publiée, un message t'invite à recharger la page.
Limite importante : les rappels ne sonnent que si l'app est ouverte. Un site sans serveur ne peut pas t'envoyer de notification application fermée : ce serait possible avec un petit serveur de notifications, pas encore en place.`, 4),
    t(31, 'Guide : synchronisation automatique', `
Dans Paramètres → Synchronisation, coche « Synchroniser automatiquement » : l'app se synchronise à l'ouverture, au retour sur l'app et toutes les 5 minutes. Elle attend si une fenêtre d'édition est ouverte, ne dit rien quand tout va bien, et ne signale une erreur qu'une fois toutes les 10 minutes.
Ce qui est fusionné : tes listes (cours, to-dos, événements, notes, cartes…), les XP (le plus élevé gagne) et les suppressions. Ce qui reste propre à chaque appareil : les réglages (« Remplacer cet appareil » les reprend du cloud).
Attention aux conflits : si le même élément a été modifié sur deux appareils, la version déjà présente dans le cloud l'emporte à la fusion (voir le conseil « Synchronisation : conflits »).`, 4),
    t(32, 'Guide : Agenda, déplacer et exporter', `
• Dans la vue semaine, glisser sur plusieurs colonnes crée un événement sur plusieurs jours (début au jour et à l'heure de départ, fin au jour et à l'heure d'arrivée).
• Glisser un événement d'un seul jour le déplace (souris et stylet, pas au doigt : au téléphone, ouvre la fiche). Pour une série, seule l'occurrence déplacée change, et un message le rappelle.
• L'export .ics reprend désormais les événements sur plusieurs jours, les occurrences supprimées (EXDATE) et les occurrences modifiées ou déplacées (RECURRENCE-ID). L'import les relit.`, 4),
    t(33, 'Guide : synchronisation, conflits', `
Ce conseil précise et corrige le conseil « Guide : synchronisation automatique ».
À la fusion, les listes sont fusionnées élément par élément (par identifiant). Un élément qui n'existe que d'un côté est gardé. Si le MÊME élément a été modifié sur deux appareils, la version qui est déjà dans le cloud l'emporte et la modification locale non synchronisée est perdue : il n'y a ni double ni avertissement.
Pour t'en protéger : synchronise avant de commencer à modifier sur un autre appareil, et garde la synchronisation automatique activée. Les ajouts et les suppressions, eux, ne se perdent pas.
En cas de doute, exporte d'abord une sauvegarde (Home → Sauvegarde et données).`, 5),
    t(34, 'Guide : sous-tâches et dépendances', `
Dans Workspace, une tâche peut avoir des sous-tâches (un seul niveau).
• Ajouter : menu de la carte (clic droit ou appui long) → « Ajouter une sous-tâche », ou, quand la tâche en a déjà, le champ sous la carte. Une sous-tâche reprend le cours de sa tâche et garde sa propre deadline.
• La carte de la tâche affiche « 3/5 » et une barre d'avancement. Terminer la dernière sous-tâche termine la tâche ; en rouvrir une la remet « En cours ». Terminer une tâche demande si on termine aussi ses sous-tâches. Ce comportement se règle dans Paramètres → Travail.
• Dépendances : dans la fenêtre d'une tâche, « Bloquée par » liste les tâches à finir avant elle. Une tâche bloquée est grisée avec une pastille « Bloquée ». Tu peux quand même la démarrer en confirmant (ou l'interdire dans Paramètres). Un blocage qui ferait une boucle est refusé.
• Terminer une tâche te dit ce qu'elle débloque. Le widget « Prêtes à démarrer » (Home) liste ce que tu peux faire maintenant, les plus urgentes d'abord.`, 6),
    t(35, 'Guide : projets et rapports', `
Un projet regroupe des to-dos pour un travail précis (un dossier, la révision d'un partiel). Dans Workspace, le sélecteur en haut propose Tableau, Projets et Rapports.
• Projets : crée un projet (avec un cours et une échéance facultatifs) ; sa page montre l'avancement, un « Ordre conseillé » quand des tâches dépendent les unes des autres, et ses to-dos. Supprimer un projet garde ses to-dos.
• Rapports : statut des tâches (faites, en cours, à faire, en retard), tâches en retard, charge des 14 prochains jours, avancement par cours, tâches terminées par semaine.
• La charge compte tes plages de travail et tes sessions Focus planifiées, plus l'effort estimé (en minutes, dans la fenêtre du to-do) des tâches sans plage. La capacité par jour se règle dans Paramètres → Travail.
• La courbe « terminées par semaine » commence au jour où tu as installé cette version : les tâches terminées avant n'ont pas de date de fin.`, 6),
    t(36, 'Guide : objectifs reliés au travail', `
Un objectif peut avancer de trois façons (champ « Progression »).
• Temps écoulé : comme avant, la barre suit le temps entre le début et l'échéance.
• Manuel : tu règles l'avancement avec un curseur.
• Automatique : tu relies des projets, des cours ou des to-dos ; l'avancement est la moyenne du leur. Si un élément relié est supprimé, le lien est signalé « Lien cassé » et ignoré.
• Le statut compare le travail fait au temps écoulé : « Dans les temps », « À risque » (de 10 à 25 points de retard), « En retard » (plus de 25 points) ou « Atteint ».
• La page d'un projet liste les objectifs qui le suivent.`, 6),
  ];
}

export const guideTips = () => allGuide().map(({ since, ...tip }) => tip);
