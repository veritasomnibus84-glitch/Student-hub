export const STORAGE_KEY = 'studenthub:v1';
export const STATUSES = ['A faire', 'En cours', 'Terminés', 'Sans statut'];
export const STATUS_KEY = { 'A faire': 'todo', 'En cours': 'doing', 'Terminés': 'done', 'Sans statut': 'none' };
export const NEXT_STATUS = { 'A faire': 'En cours', 'En cours': 'Terminés', 'Sans statut': 'A faire' };
export const TYPES = ['Devoir', 'Travail de groupe', 'Examen', 'Lecture', 'Révision'];
export const SEMESTERS = ['Semestre 1', 'Semestre 2'];
export const SORTS = [
  ['deadline', 'Deadline'], ['name', 'Nom'], ['course', 'Cours'], ['status', 'Statut'], ['type', 'Type'],
];
export const SEED_COURSES = [
  'Français', 'Géométrie', 'Chimie', 'Analyse', 'Physique', 'Informatique', 'Dessin technique', 'Algèbre',
];
export const CAL_COLORS = [['blue', 'Bleu'], ['red', 'Rouge'], ['green', 'Vert'], ['amber', 'Ambre'], ['violet', 'Violet'], ['teal', 'Turquoise']];
export const REPEATS = [['none', 'Jamais'], ['daily', 'Tous les jours'], ['weekly', 'Toutes les semaines'], ['monthly', 'Tous les mois'], ['yearly', 'Tous les ans']];
export const REMINDERS = [['', 'Aucun'], ['0', 'À l\'heure'], ['5', '5 min avant'], ['15', '15 min avant'], ['30', '30 min avant'], ['60', '1 h avant'], ['1440', '1 jour avant']];
export const LOCK_KEY = 'studenthub:lock';
export const SESSION_KEY = 'studenthub:unlocked';
