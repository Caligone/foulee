// Qualité du tournage : ce qui rend les mesures fiables ou non, vérifié après coup sur l'analyse. Module pur.
// Chaque point dit ce qui va, ou ce qu'il faut changer à la prochaine vidéo.

import { profils, frontaux, nbAppuis, MIN_APPUIS } from './analyse.js';
import { mediane } from './reperes.js';

// seuils de l'appli (pas de norme publiée) : en dessous de ~150 px de jambe, 1 px vaut près de 1 cm à l'échelle du coureur
export const JAMBE_MIN_PX = 150;
export const FPS_MIN = 50;
// caméra qui bouge : part de l'image « toujours agitée » pendant le repérage. Seuil de l'appli, calibré le 31/10 :
// ≤ 5 % sur des vidéos filmées téléphone fixe, 36 à 90 % sur des clips à caméra mobile ou plans serrés.
export const AGITATION_MAX = 0.25;
export const cameraBouge = (mv) => (mv?.agite ?? 0) > AGITATION_MAX;

export function qualite(a) {
  const prof = profils(a), fr = frontaux(a), points = [];
  const ok = (texte) => points.push({ ok: true, texte });
  const ko = (texte, conseil) => points.push({ ok: false, texte, conseil });

  if (a.fps >= FPS_MIN) ok(`${Math.round(a.fps)} images/s`);
  else ko(`${Math.round(a.fps)} images/s : temps de contact et de vol à ± ${Math.round(1000 / a.fps)} ms`, 'Filme à 60 images/s ou plus (120 ou 240 en ralenti, transféré en original).');
  if (cameraBouge(a.mouvement)) ko(`L'image bouge sur ${Math.round(a.mouvement.agite * 100)} % de sa surface : caméra qui tremble ou suit le coureur ; appuis et angles peu fiables`, 'Pose le téléphone sur un support fixe ; ne le tiens pas à la main et ne suis pas le coureur.');
  if (a.vfr) ko('Cadence d\'images irrégulière : temps de contact et de vol moins fiables', 'Désactive le mode basse lumière ou le ralenti automatique, ou filme avec plus de lumière.');
  if (a.size?.[1] > a.size?.[0]) ko('Vidéo en portrait : le champ est étroit, peu d\'appuis par passage', 'Tourne le téléphone à l\'horizontale (paysage).');
  if (a.decoder === 'seek') ko('Décodage par sauts : temps moins précis', 'Ouvre l\'appli dans Chrome ou Safari, ou exporte la vidéo en MP4 H.264.');

  if (!prof.length) ko('Aucun passage de profil exploitable', 'Passe de profil à 3–4 m du téléphone, pieds visibles en entier, au moins 1 s dans le champ.');
  else {
    const n = nbAppuis(a);
    if (n >= MIN_APPUIS) ok(`${n} appuis de profil (au moins ${MIN_APPUIS} recommandés, Dingenen 2018)`);
    else ko(`${n} appuis de profil seulement (au moins ${MIN_APPUIS} recommandés, Dingenen 2018)`, 'Fais un ou deux passages de profil de plus.');
    const jambe = mediane(prof.map((p) => p.metrics.leg_px));
    if (jambe >= JAMBE_MIN_PX) ok(`Coureur assez grand à l'image (jambe ≈ ${Math.round(jambe)} px)`);
    else ko(`Coureur petit à l'image (jambe ≈ ${Math.round(jambe)} px, seuil indicatif ${JAMBE_MIN_PX} px) : quelques centimètres d'erreur possibles`, 'Rapproche le téléphone : 3–4 m de ta ligne de course.');
    const vis = Math.min(...prof.map((p) => p.metrics.visibleShare ?? 1));
    // la part compte aussi l'entrée et la sortie du champ : ~0,5 sur des passages bien filmés
    if (vis < 0.35) ko('Pieds souvent mal visibles sur un passage de profil', 'Évite l\'herbe haute et les obstacles devant les pieds ; garde les pieds entiers dans l\'image.');
  }

  const dos = fr.filter((p) => p.kind === 'dos');
  if (dos.some((p) => !p.metrics.obliqueWarn)) ok('Vue de dos exploitable');
  else if (a.passes.some((p) => p.kind === 'dos')) ko('Vue de dos non exploitable ou de biais', 'Téléphone à hauteur de hanche dans l\'axe de course, éloigne-toi tout droit sur 10–15 m.');
  else ko('Pas de vue de dos', 'Ajoute un passage où tu t\'éloignes de la caméra : c\'est la seule vue qui mesure la chute du bassin.');
  if (fr.some((p) => p.metrics.obliqueWarn)) ko('Vue de face ou de dos prise de biais : largeur d\'appui faussée', 'Cours dans l\'axe exact du téléphone.');
  return points;
}
