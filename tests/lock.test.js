import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeLock, verifyLock, loadLock, saveLock, clearLock, isUnlocked, markUnlocked, markLocked } from '../js/lock.js';

const mem = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v), removeItem: (k) => m.delete(k) }; };

test('verrou : bon couple accepté, mauvais refusé, nom insensible à la casse', async () => {
  const lock = await makeLock('Emmanuel', 'mot-de-passe-1');
  assert.ok(!JSON.stringify(lock).includes('mot-de-passe'));
  assert.equal(await verifyLock(lock, 'emmanuel ', 'mot-de-passe-1'), true);
  assert.equal(await verifyLock(lock, 'Emmanuel', 'mot-de-passe-2'), false);
  assert.equal(await verifyLock(lock, 'Autre', 'mot-de-passe-1'), false);
});

test('verrou : deux verrous du même mot de passe ont des empreintes différentes (sel)', async () => {
  const a = await makeLock('x', 'abcdef'); const b = await makeLock('x', 'abcdef');
  assert.notEqual(a.hash, b.hash);
});

test('verrou : stockage, données corrompues, session', async () => {
  const st = mem(); const ss = mem();
  assert.equal(loadLock(st), null);
  saveLock(st, await makeLock('x', 'abcdef'));
  assert.equal(loadLock(st).name, 'x');
  st.setItem('studenthub:lock', '{pas json');
  assert.equal(loadLock(st), null);
  saveLock(st, { name: 1 }); assert.equal(loadLock(st), null);
  clearLock(st);
  assert.equal(isUnlocked(ss), false); markUnlocked(ss); assert.equal(isUnlocked(ss), true); markLocked(ss); assert.equal(isUnlocked(ss), false);
});
