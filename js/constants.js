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
