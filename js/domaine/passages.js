// Analyse, Passage, Appui : le vocabulaire du domaine et les règles qui le définissent. Module pur.
//
// Analyse  = une vidéo d'un coureur : { id, date, height (m), fps, passes: [Passage], algo, … }
// Passage  = une traversée du champ : { kind: 'profil' | 'face' | 'dos', dir, t0, t1, frames, metrics }
//            Les points de pose (frames[].lm) font foi ; metrics est un cache calculé par la version ALGO.
// Appui    = un pied au sol : { debut, fin, milieu, cote?, mesures } (numéros d'images), quelle que soit la vue.

import { profileMetrics, frontalMetrics } from './mesures.js';

/**
 * @typedef {[number, number, number]} Point           x, y en pixels vidéo, visibilité 0..1
 * @typedef {{ f: number, lm: Point[] | null, thumb?: Blob | null, view?: [number, number, number] }} Image
 * @typedef {{ n: number, f_ic: number, f_to: number, contact_ms: number, foot_deg: number, shank_deg: number,
 *   knee_ic: number, knee_max: number, heel_hip_cm: number, heel_hip_pct: number, thigh_to: number, trunk: number,
 *   step_ms?: number, flight_ms?: number }} PasProfil
 * @typedef {{ side: 'gauche' | 'droite', f0: number, f1: number, mt: number, lateral: number, drop: number }} ContactFrontal
 * @typedef {{ view: 'profil', nSteps: number, steps: PasProfil[], footsOk: boolean, visibleShare: number, cadence: number,
 *   speed: number, pace: number, contact_ms: number, duty: number, vosc_cm: number, leg_px: number, cameraMobile?: boolean,
 *   indicatifs?: string[], [mesure: string]: any }} MesuresProfil
 * @typedef {{ view: 'face' | 'dos', contacts: ContactFrontal[], crossings: number, lateralMed: number,
 *   drop: { gauche: number, droite: number }, obliqueWarn: boolean, unreliable: boolean, confused: number,
 *   masked: number, roll: number, [mesure: string]: any }} MesuresFrontal
 * @typedef {{ error: string }} EchecMesure
 * @typedef {{ kind: 'profil' | 'face' | 'dos', dir: number, t0: number, t1: number, frames: Image[],
 *   metrics: MesuresProfil | MesuresFrontal | EchecMesure | null, cameraMobile?: boolean, fond?: number }} Passage
 * @typedef {{ id: string, date: number, height: number, fps: number, algo?: number, passes: Passage[],
 *   size?: [number, number], decoder?: string, vfr?: boolean | null, mouvement?: { agite: number, fond?: number },
 *   legacy?: boolean, recalcule?: boolean, [champ: string]: any }} Analyse
 * @typedef {{ debut: number, fin: number, milieu: number, cote?: string, mesures: PasProfil | ContactFrontal }} Appui
 * @typedef {Passage & { metrics: MesuresProfil }} PassageProfil     passage de profil exploitable
 * @typedef {Passage & { metrics: MesuresFrontal }} PassageFrontal   passage de face ou de dos exploitable
 */

// à incrémenter à chaque changement de mesures.js qui modifie les résultats : les analyses plus anciennes sont recalculées
export const ALGO = 3; // 3 : mode caméra mobile décidé par passage (31/10)
export const MIN_APPUIS = 7; // moyenne d'au moins 7 pas pour une mesure 2D fiable (Dingenen 2018)

export const VUES = { profil: 'Profil', face: 'De face', dos: 'De dos' };

// état d'un passage, de la raison la plus fondamentale à la plus fine
/** @param {Passage} p @returns {string} */
export function etat(p) {
  const m = /** @type {any} */ (p.metrics); // état : on lit chaque forme possible des mesures
  if (!m) return 'trop court';
  if (m.error) return m.error === 'déplacement trop faible' ? 'immobile' : 'erreur';
  if (p.kind === 'profil') {
    if (!m.footsOk) return 'pieds masqués';
    return m.nSteps >= 2 ? 'exploitable' : 'trop peu d\'appuis';
  }
  if (m.unreliable) return 'jambes confondues';
  return m.contacts?.length ? 'exploitable' : 'aucun appui';
}
export const exploitable = (p) => etat(p) === 'exploitable';
/** @type {(a: { passes: Passage[] }) => PassageProfil[]} */
export const profils = (a) => /** @type {PassageProfil[]} */ (a.passes.filter((p) => p.kind === 'profil' && exploitable(p)));
/** @type {(a: { passes: Passage[] }) => PassageFrontal[]} */
export const frontaux = (a) => /** @type {PassageFrontal[]} */ (a.passes.filter((p) => p.kind !== 'profil' && exploitable(p)));

export const ETATS = {
  'trop court': 'passage trop court, ignoré',
  immobile: 'coureur immobile, ignoré',
  erreur: 'calcul impossible',
  'pieds masqués': 'pieds peu visibles, ignoré',
  'trop peu d\'appuis': 'trop peu d\'appuis, ignoré',
  'jambes confondues': 'jambes confondues par le modèle, non chiffré',
  'aucun appui': 'aucun appui repéré',
};

// appuis d'un passage, sous une seule forme quelle que soit la vue
/** @param {Passage} p @returns {Appui[]} */
export function appuis(p) {
  const m = /** @type {any} */ (p.metrics || {});
  if (p.kind === 'profil') return (m.steps || []).map((s) => ({ debut: s.f_ic, fin: s.f_to, milieu: s.f_ic, mesures: s }));
  return (m.contacts || []).map((c) => ({ debut: c.f0, fin: c.f1, milieu: c.mt, cote: c.side, mesures: c }));
}
export const nbAppuis = (a) => profils(a).reduce((n, p) => n + p.metrics.nSteps, 0);

// caméra qui bouge : part du fond (coureur exclu) qui diffère de l'image de fond, en médiane. Seuil de l'appli, calibré
// le 31/10 : ≤ 1,6 % sur des vidéos téléphone fixe, 7,8 à 48 % sur 8 clips à caméra mobile. Analyses plus anciennes,
// sans cette mesure : agitation globale (qui compte aussi le couloir du coureur).
export const FOND_MAX = 0.05, AGITATION_MAX = 0.25;
export const cameraBouge = (mv) => (mv?.fond !== undefined ? mv.fond > FOND_MAX : (mv?.agite ?? 0) > AGITATION_MAX);
/** médiane de l'agitation du fond sur la fenêtre d'un passage */
export function fondPassage(mv, t0, t1) {
  const v = (mv?.serie ?? []).filter(([t]) => t >= t0 && t <= t1).map(([, x]) => x).sort((a, b) => a - b);
  return v.length ? v[v.length >> 1] : mv?.fond;
}
// mode caméra mobile d'un passage : d'après son agitation propre si on l'a, sinon le drapeau enregistré
const mobile = (p) => (p.fond !== undefined ? p.fond > FOND_MAX : !!p.cameraMobile);

/** @param {Passage} p @param {number} fps @param {number} height en mètres @returns {any} */
export function mesurer(p, fps, height) {
  try { return p.kind === 'profil' ? profileMetrics(p.frames, fps, height, p.dir, { cameraMobile: mobile(p) }) : frontalMetrics(p.frames, fps, p.kind); }
  catch (e) { console.error(e); return { error: String(e) }; }
}

// recalcule les mesures depuis les points de pose si elles viennent d'une version antérieure de l'algorithme
/** @param {Analyse} a @returns {Analyse} */
export function aJour(a) {
  if ((a.algo ?? 1) === ALGO) return a;
  // sans points de pose, rien ne peut être recalculé : l'analyse garde sa version (et ses anciennes mesures)
  if (!a.passes.some((p) => p.frames?.some((f) => f.lm))) return a;
  const passes = a.passes.map((p) => p.frames?.some((f) => f.lm) ? { ...p, metrics: mesurer(p, a.fps, a.height) } : p);
  return { ...a, passes, algo: ALGO, recalcule: true };
}
