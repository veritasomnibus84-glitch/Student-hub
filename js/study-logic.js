// Apprendre : fiches (4 styles x 4 longueurs), script de podcast, cartographie en couches. Prompts du catalogue ; l'IA est la tienne (copier / coller).
import { SYS } from './revision-logic.js';

export const STYLES = [
  ['exam', 'Révision d\'examen', 'Ce qui tombe, pièges et plans de réponse'], ['memo', 'Mémorisation', 'Mnémotechniques, acronymes et listes à retenir'],
  ['simple', 'Vulgarisation', 'Explications simples, avec des analogies'], ['full', 'Synthèse complète', 'Vue d\'ensemble structurée, de l\'essentiel aux détails'],
];
export const LENGTHS = [['cheat', 'Cheat sheet', 250], ['short', 'Courte', 500], ['medium', 'Moyenne', 900], ['long', 'Détaillée', 1600]];
const wordsOf = (k) => LENGTHS.find(([x]) => x === k)?.[2] ?? 900;
const lengthText = (k) => `${LENGTHS.find(([x]) => x === k)?.[1] ?? 'Moyenne'} (environ ${wordsOf(k)} mots)`;

const SHEET = {
  exam: (o) => `Tâche : fiche Révision d'examen, longueur ${lengthText(o.length)}.\nStructure imposée : 1) Ce qui tombe le plus souvent (tiré des chapitres les plus développés et des définitions/formules du cours) ; 2) Pièges et confusions classiques ; 3) Plans de réponse types pour questions ouvertes ; 4) Auto-test final : 8 questions SANS leur réponse (réponses en fin de fiche, repliées).\nRègles : listes courtes, termes clés en gras, pas de paragraphes de plus de 4 lignes. Ne prétends pas connaître les sujets réels de l'examen : formule en « probable » / « à maîtriser ».`,
  memo: () => 'Tâche : fiche Mémorisation.\n1) Extrais les listes, séquences, formules et termes à retenir.\n2) Pour chaque liste, propose UN acronyme, une phrase mnémonique ou une image mentale et demande à l\'élève de la modifier (laisse une ligne « Ma version : … » vide à remplir).\n3) Termine par un mini-test : l\'élève doit reconstituer chaque liste de mémoire ; donne la correction après.\nInterdit : mnémonique plus long que la liste qu\'il aide à retenir.',
  simple: (o) => `Tâche : fiche Vulgarisation pour ${o.level || 'un étudiant débutant'}, longueur ${lengthText(o.length)}.\nPour chaque concept clé :\n1) Explication en 2-3 phrases sans jargon, puis le terme technique exact.\n2) Une analogie dont tu précises le MAPPING de relations (ex. : A est à B ce que X est à Y), puis la LIMITE de l'analogie (là où elle devient fausse).\n3) Une question d'auto-explication : « Pourquoi cela fonctionne-t-il ainsi ? » ou « Que se passerait-il si… ».\n4) Une mini-vérification : 1 question de rappel sans réponse visible.\nInterdit : analogie basée sur une ressemblance superficielle ; simplification qui contredit la source.`,
  full: (o) => `Tâche : synthèse complète, de l'essentiel aux détails, longueur ${lengthText(o.length)}. N'insère aucune image.\nStructure : 1) Vue d'ensemble en 5 lignes ; 2) Sections courtes (titre = question ou affirmation, 200 mots maximum) ; 3) En gras les termes clés ; 4) Tableau comparatif quand des notions sont voisines ; 5) Récapitulatif en fin de section : 3 points + 1 question de rappel.`,
};
// Niveau estimé de la leçon (novice, intermediate, advanced) en texte pour le prompt ; un texte libre est conservé.
export const LEVEL_TEXT = { novice: 'un étudiant débutant', intermediate: 'un étudiant de niveau intermédiaire', advanced: 'un étudiant avancé' };

export function sheetPrompt({ style = 'full', length = 'medium', source = '', level = '', lang = 'français' }) {
  const who = LEVEL_TEXT[level] ?? level;
  return [SYS.replace(/ Ajoute à chaque item[\s\S]*$/, ''), (SHEET[style] ?? SHEET.full)({ length, level: who }), ...(who && style !== 'simple' ? [`Adapte le vocabulaire et la profondeur à ${who}.`] : []), `Écris en ${lang}, en texte simple : titres avec #, listes avec -, gras avec **.`, `<source>${source}</source>`].join('\n\n');
}

export function podcastPrompt({ minutes = 8, source = '', lang = 'français' }) {
  return [SYS.replace(/ Ajoute à chaque item[\s\S]*$/, ''),
    `Tâche : script de podcast de ${minutes} minutes, deux voix : Hôte (curieux) et Experte (claire).\nRègles : ton conversationnel, phrases courtes, pas de lecture de listes ; 1 idée par segment d'environ 90 secondes, chaque segment finit par une question posée à l'auditeur avec une pause de 3 secondes avant la réponse ; ouverture = enjeu concret, clôture = 3 points à retenir. Aucune information absente de la source. Langue du script : ${lang}.\nSortie : lignes « HÔTE: » / « EXPERTE: » + marqueurs [PAUSE 3s]. Compatible lecture vocale : pas de symboles ni d'abréviations non prononçables.`,
    `<source>${source}</source>`].join('\n\n');
}

// Script de podcast -> segments à lire : {who, text} ou {pause: ms}.
export function parsePodcast(text) {
  const out = [];
  for (const raw of String(text).split(/\r?\n/)) {
    const line = raw.trim(); if (!line) continue;
    const m = line.match(/^(H[ÔO]TE|EXPERTE?)\s*:\s*(.*)$/i);
    const who = m ? (m[1].toUpperCase().startsWith('H') ? 'host' : 'expert') : out.findLast?.((x) => x.who)?.who ?? 'host';
    let rest = m ? m[2] : line;
    for (const part of rest.split(/(\[PAUSE\s*\d+\s*s\])/i)) {
      const p = part.match(/^\[PAUSE\s*(\d+)\s*s\]$/i);
      if (p) out.push({ pause: Math.min(10, Number(p[1])) * 1000 });
      else if (part.trim()) out.push({ who, text: part.trim() });
    }
  }
  return out;
}

export function layersPrompt({ source = '', lang = 'français' }) {
  return [SYS.replace(/ Ajoute à chaque item[\s\S]*$/, ''),
    `Tâche : cartographie le cours en couches.\n1) NOYAUX (3 à 5 maximum) : les idées sans lesquelles le reste n\'a pas de sens ; formule-les en une phrase chacune.\n2) PILIERS : pour chaque noyau, 2 à 4 notions qui en dépendent.\n3) DÉTAILS : le reste, rattaché à un pilier.\n4) Résumé d\'explication en 2 minutes (environ 250 mots, vocabulaire simple) qui ne contient que les noyaux.\n5) Pour chaque noyau, 2 questions de rappel qui testent la compréhension, pas la mémoire des mots.\nRègles : n\'invente aucun lien absent de la source ; signale les passages ambigus. Rédige en ${lang}.\nSortie : JSON {cores:[{id, text}], pillars:[{id, core_id, text}], details:[{id, pillar_id, text}], two_minute_summary, recall_questions:[{core_id, q, a}]}. Réponds uniquement avec le JSON.`,
    `<source>${source}</source>`].join('\n\n');
}

const txt = (x) => (typeof x === 'string' ? x : typeof x?.text === 'string' ? x.text : '').trim();
export function parseLayers(text) {
  let o; try { o = JSON.parse(String(text).replace(/```(?:json)?/g, '').trim()); } catch { throw new Error('Réponse illisible : ce n\'est pas du JSON.'); }
  // On garde pour chaque pilier son noyau (core_id) et pour chaque détail son pilier (pillar_id), sous forme d'indice (-1 : inconnu).
  const items = (x, max) => (Array.isArray(x) ? x : []).map((e) => ({ text: txt(e), id: String(e?.id ?? ''), parent: String(e?.core_id ?? e?.pillar_id ?? '') })).filter((e) => e.text).slice(0, max);
  const cores = items(o.cores, 40); const pillars = items(o.pillars, 120); const details = items(o.details, 200);
  const at = (list, id) => (id ? list.findIndex((c) => c.id === id) : -1);
  const layers = {
    core: cores.map((e) => e.text), pillar: pillars.map((e) => e.text), detail: details.map((e) => e.text),
    parents: { pillar: pillars.map((p) => at(cores, p.parent)), detail: details.map((d) => at(pillars, d.parent)) },
  };
  if (!layers.core.length) throw new Error('Aucun noyau trouvé : le JSON doit contenir « cores ».');
  const recall = (Array.isArray(o.recall_questions) ? o.recall_questions : []).filter((r) => r && typeof r.q === 'string' && r.q.trim()).slice(0, 40).map((r) => ({ q: r.q.trim().slice(0, 500), a: String(r.a ?? '').slice(0, 1000) }));
  return { layers, summary: String(o.two_minute_summary ?? '').slice(0, 5000), recall };
}

// Texte d'une fiche -> blocs simples (titre, puce, paragraphe) pour l'afficher sans innerHTML.
export function sheetBlocks(text) {
  return String(text).split(/\r?\n/).map((l) => l.trimEnd()).filter((l) => l.trim()).map((l) => {
    const h = l.match(/^(#{1,4})\s+(.*)$/); if (h) return { t: 'h', level: h[1].length, text: h[2] };
    const li = l.match(/^\s*(?:[-*•]|\d+[.)])\s+(.*)$/); if (li) return { t: 'li', text: li[1] };
    return { t: 'p', text: l };
  });
}
