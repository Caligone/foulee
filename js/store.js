// Historique local (IndexedDB) : les analyses restent dans ce navigateur, sur cette machine.
const DB = 'foulee', VER = 1;
function open() {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB, VER);
    r.onupgradeneeded = () => { r.result.createObjectStore('analyses', { keyPath: 'id' }); };
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  });
}
async function tx(mode, fn) {
  const db = await open();
  return new Promise((res, rej) => {
    const t = db.transaction('analyses', mode); const st = t.objectStore('analyses');
    const out = fn(st); t.oncomplete = () => res(out?.result ?? out); t.onerror = () => rej(t.error);
  });
}
export const saveAnalysis = (a) => tx('readwrite', (s) => s.put(a));
export const deleteAnalysis = (id) => tx('readwrite', (s) => s.delete(id));
export async function getAnalysis(id) {
  const db = await open();
  return new Promise((res, rej) => { const r = db.transaction('analyses').objectStore('analyses').get(id); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
}
export async function listAnalyses() {
  const db = await open();
  return new Promise((res, rej) => {
    const out = []; const r = db.transaction('analyses').objectStore('analyses').openCursor();
    r.onsuccess = () => { const c = r.result; if (c) { const { passes, ...meta } = c.value; out.push({ ...meta, summary: passes.map((p) => ({ kind: p.kind, metrics: p.metrics })) }); c.continue(); } else res(out.sort((a, b) => b.date - a.date)); };
    r.onerror = () => rej(r.error);
  });
}
