// Verrou d'accès (nom + mot de passe) : empreinte PBKDF2 stockée localement.
// Il masque l'app derrière un écran de connexion ; il ne chiffre pas les données.
import { LOCK_KEY, SESSION_KEY } from './constants.js';

const enc = new TextEncoder();
const b64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));
const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const ITERATIONS = 210000;

async function derive(password, salt, iterations) {
  const key = await crypto.subtle.importKey('raw', enc.encode(password.normalize('NFKC')), 'PBKDF2', false, ['deriveBits']);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, key, 256));
}

export async function makeLock(name, password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return { v: 1, name: name.trim(), salt: b64(salt), iterations: ITERATIONS, hash: b64(await derive(password, salt, ITERATIONS)) };
}

export async function verifyLock(lock, name, password) {
  const salt = unb64(lock.salt);
  const got = await derive(password, salt, lock.iterations);
  const want = unb64(lock.hash);
  let diff = got.length ^ want.length;
  for (let i = 0; i < want.length; i += 1) diff |= (got[i] ?? 0) ^ want[i];
  const sameName = name.trim().toLowerCase() === lock.name.toLowerCase();
  return diff === 0 && sameName;
}

export function loadLock(storage) {
  try {
    const l = JSON.parse(storage.getItem(LOCK_KEY));
    return l && typeof l.name === 'string' && typeof l.salt === 'string' && typeof l.hash === 'string' && Number.isInteger(l.iterations) ? l : null;
  } catch { return null; }
}
export const saveLock = (storage, lock) => storage.setItem(LOCK_KEY, JSON.stringify(lock));
export const clearLock = (storage) => storage.removeItem(LOCK_KEY);
export const isUnlocked = (session) => session.getItem(SESSION_KEY) === '1';
export const markUnlocked = (session) => session.setItem(SESSION_KEY, '1');
export const markLocked = (session) => session.removeItem(SESSION_KEY);
