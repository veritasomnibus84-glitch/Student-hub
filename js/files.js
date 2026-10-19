// Stockage des PDF et des couvertures dans IndexedDB (par appareil, hors localStorage).
const DB = 'studenthub-files';

function open() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') { reject(new Error('IndexedDB indisponible')); return; }
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => { req.result.createObjectStore('pdf'); req.result.createObjectStore('cover'); };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function run(store, mode, fn) {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, mode);
    const out = fn(tx.objectStore(store));
    tx.oncomplete = () => { db.close(); resolve(out.result); };
    tx.onerror = () => { db.close(); reject(tx.error); };
    tx.onabort = () => { db.close(); reject(tx.error); };
  });
}

export const putFile = (id, blob) => run('pdf', 'readwrite', (s) => s.put(blob, id));
export const getFile = (id) => run('pdf', 'readonly', (s) => s.get(id));
export const putCover = (id, dataUrl) => run('cover', 'readwrite', (s) => s.put(dataUrl, id));
export const getCover = (id) => run('cover', 'readonly', (s) => s.get(id));
export const listFileIds = () => run('pdf', 'readonly', (s) => s.getAllKeys());
export async function deleteFile(id) {
  await run('pdf', 'readwrite', (s) => s.delete(id));
  await run('cover', 'readwrite', (s) => s.delete(id));
}
export async function keepStorage() {
  try { await navigator.storage?.persist?.(); } catch { /* sans importance */ }
}
