// Historique local (IndexedDB) : les analyses restent dans ce navigateur, sur cette machine.
// Les vignettes d'un passage sont rangées dans un seul Blob, avec leurs positions : Chrome plante (SIGTRAP)
// en supprimant ou réécrivant un enregistrement de plusieurs milliers de Blobs (≈ 9 700 images à 240 i/s).
const DB = 'foulee', VER = 1;
function open() {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB, VER);
    r.onupgradeneeded = () => { r.result.createObjectStore('analyses', { keyPath: 'id' }); };
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  });
}
// une connexion par opération, refermée ensuite : sinon deleteDatabase reste bloqué
async function tx(mode, fn) {
  const db = await open();
  return new Promise((res, rej) => {
    const t = db.transaction('analyses', mode); const req = fn(t.objectStore('analyses'));
    t.oncomplete = () => { db.close(); res(req?.result); }; t.onerror = () => { db.close(); rej(t.error); };
  });
}
const pack = (a) => ({ ...a, passes: a.passes.map(({ frames, ...p }) => {
  const toff = [0]; for (const f of frames) toff.push(toff[toff.length - 1] + (f.thumb?.size ?? 0));
  return { ...p, thumbs: new Blob(frames.map((f) => f.thumb).filter(Boolean), { type: 'image/jpeg' }), toff, frames: frames.map(({ thumb, ...f }) => f) };
}) });
const unpack = (a) => ({ ...a, passes: a.passes.map(({ thumbs, toff, ...p }) => !thumbs ? p
  : { ...p, frames: p.frames.map((f, i) => ({ ...f, thumb: thumbs.slice(toff[i], toff[i + 1], 'image/jpeg') })) }) });

export const saveAnalysis = (a) => tx('readwrite', (s) => s.put(pack(a)));
export const getAnalysis = async (id) => { const a = await tx('readonly', (s) => s.get(id)); return a && { ...unpack(a), legacy: isLegacy(a) }; };
// analyse enregistrée avant le 31/10 (une vignette par Blob) : au-delà de quelques milliers d'images,
// la supprimer seule fait planter Chrome ; seule la suppression de toute la base passe
const isLegacy = (a) => a.passes.reduce((n, p) => n + (p.thumbs ? 0 : p.frames.filter((f) => f.thumb).length), 0) > 2000;
export const deleteAnalysis = (id) => tx('readwrite', (s) => s.delete(id));
export const deleteAll = () => new Promise((res, rej) => {
  const r = indexedDB.deleteDatabase(DB); r.onsuccess = res; r.onerror = () => rej(r.error);
});
export async function listAnalyses() {
  const db = await open();
  return new Promise((res, rej) => {
    const out = []; const r = db.transaction('analyses').objectStore('analyses').openCursor();
    r.onsuccess = () => { const c = r.result; if (c) { const { passes, ...meta } = c.value; out.push({ ...meta, summary: passes.map((p) => ({ kind: p.kind, metrics: p.metrics })) }); c.continue(); } else { db.close(); res(out.sort((a, b) => b.date - a.date)); } };
    r.onerror = () => { db.close(); rej(r.error); };
  });
}
