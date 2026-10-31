// Analyse, Passage, Appui : le vocabulaire du domaine et les règles qui le définissent. Module pur.
//
// Analyse  = une vidéo d'un coureur : { id, date, height (m), fps, passes: [Passage], algo, … }
// Passage  = une traversée du champ : { kind: 'profil' | 'face' | 'dos', dir, t0, t1, frames, metrics }
//            Les points de pose (frames[].lm) font foi ; metrics est un cache calculé par la version ALGO.
// Appui    = un pied au sol : { debut, fin, milieu, cote?, mesures } (numéros d'images), quelle que soit la vue.

import { profileMetrics, frontalMetrics } from './mesures.js';

// à incrémenter à chaque changement de mesures.js qui modifie les résultats : les analyses plus anciennes sont recalculées
export const ALGO = 2;
export const MIN_APPUIS = 7; // moyenne d'au moins 7 pas pour une mesure 2D fiable (Dingenen 2018)

export const VUES = { profil: 'Profil', face: 'De face', dos: 'De dos' };

// état d'un passage, de la raison la plus fondamentale à la plus fine
export function etat(p) {
  const m = p.metrics;
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
export const profils = (a) => a.passes.filter((p) => p.kind === 'profil' && exploitable(p));
export const frontaux = (a) => a.passes.filter((p) => p.kind !== 'profil' && exploitable(p));

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
export function appuis(p) {
  const m = p.metrics || {};
  if (p.kind === 'profil') return (m.steps || []).map((s) => ({ debut: s.f_ic, fin: s.f_to, milieu: s.f_ic, mesures: s }));
  return (m.contacts || []).map((c) => ({ debut: c.f0, fin: c.f1, milieu: c.mt, cote: c.side, mesures: c }));
}
export const nbAppuis = (a) => profils(a).reduce((n, p) => n + p.metrics.nSteps, 0);

export function mesurer(p, fps, height) {
  try { return p.kind === 'profil' ? profileMetrics(p.frames, fps, height, p.dir) : frontalMetrics(p.frames, fps, p.kind); }
  catch (e) { console.error(e); return { error: String(e) }; }
}

// recalcule les mesures depuis les points de pose si elles viennent d'une version antérieure de l'algorithme
export function aJour(a) {
  if ((a.algo ?? 1) === ALGO) return a;
  const passes = a.passes.map((p) => p.frames?.some((f) => f.lm) ? { ...p, metrics: mesurer(p, a.fps, a.height) } : p);
  return { ...a, passes, algo: ALGO, recalcule: true };
}
