// Recommandations : constats (« En bref ») et exercices (« Quoi travailler ») tirés des statuts des repères.
// Module pur. Les textes restent sur le terrain de la technique de course : ni diagnostic, ni prévention de blessure.

import { REPERES, statut, typique } from './reperes.js';
import { profils, frontaux } from './analyse.js';
import { fmt as f0 } from '../format.js';

const RANG = { ok: 0, hors: 1, loin: 2 };
const pire = (a, b) => ((RANG[a] ?? 0) >= (RANG[b] ?? 0) ? a : b);

export function bilan(a) {
  const prof = profils(a), fr = frontaux(a);
  const ty = typique(prof.map((p) => p.metrics));
  const lent = prof.slice().sort((x, y) => x.metrics.speed - y.metrics.speed)[0]?.metrics;
  const constats = [], exercices = [];

  if (prof.length) {
    const sTibia = statut('shank_deg', ty.shank_deg), sTalon = statut('heel_hip_pct', ty.heel_hip_pct);
    if (sTibia !== 'ok' || sTalon !== 'ok') {
      constats.push({ st: pire(sTibia, sTalon), cle: 'shank_deg', t: 'Le pied se pose devant le bassin',
        d: `Au contact, le tibia penche de ${f0(ty.shank_deg)}° vers l'avant et le talon arrive ${f0(ty.heel_hip_cm)} cm devant le bassin (${f0(ty.heel_hip_pct)} % de la longueur de jambe). C'est le signe d'une foulée qui freine (overstriding).` });
      const cad = lent?.cadence ?? ty.cadence;
      exercices.push({ cle: 'cadence', t: `Monter la cadence de 5 à 7 % en footing (≈ ${f0(cad * 1.05)} à ${f0(cad * 1.07)} pas/min)`,
        li: ['Métronome de la montre ou musique à ce tempo, par blocs de 2 min, puis sur toute la sortie.', 'Même allure : le pas raccourcit de lui-même et le pied revient sous le bassin.'],
        why: 'À vitesse égale, ajouter 5 à 10 % de cadence rapproche le pied du bassin au contact et diminue l\'impact et le travail du genou à chaque pas (−20 % d\'énergie absorbée au genou à +5 %, mesuré sur tapis). Dans un essai randomisé, les effets se maintenaient un mois après 8 séances ; l\'effort perçu peut augmenter au début.',
        sources: [['Heiderscheit 2011', 20581720], ['Lieberman 2015', 26538175], ['Willy 2016', 25652871], ['Anderson 2022 (méta-analyse)', 36057913]] });
    }
    const sBuste = statut('trunk', ty.trunk);
    if (sBuste !== 'ok' && ty.trunk < REPERES.trunk.m) {
      constats.push({ st: sBuste, cle: 'trunk', t: 'Buste très droit',
        d: `Inclinaison mesurée : ${f0(ty.trunk)}° (en moyenne, environ 7° vers l'avant chez des coureurs loisirs).` });
      exercices.push({ cle: 'trunk', t: 'Courir « grand et légèrement penché »',
        li: ['Légère inclinaison vers l\'avant venue des chevilles, pas de la taille.', 'Surtout aux allures lentes ; viser 5 à 10° sur la prochaine vidéo.'],
        why: 'Une inclinaison de 5 à 10° vers l\'avant correspond à la posture spontanée de coureurs loisirs et reporte une partie du travail du genou vers la hanche. Au-delà, l\'impact et le travail de la hanche augmentent nettement : rester modéré.',
        sources: [['Teng & Powers 2014', 25155651], ['Teng & Powers 2015', 25003780], ['Warrener 2021', 34000575]] });
    }
    const sRebond = statut('vosc_cm', ty.vosc_cm);
    if (sRebond !== 'ok') constats.push({ st: sRebond, cle: 'vosc_cm', t: 'Rebond vertical élevé',
      d: `Oscillation du bassin de ${f0(ty.vosc_cm, 1)} cm (en moyenne : 7,7 ± 1,2 cm).` });
  }

  // pieds qui croisent : un seul constat pour toutes les vues de face et de dos
  const croise = fr.reduce((n, p) => n + p.metrics.crossings, 0), total = fr.reduce((n, p) => n + p.metrics.contacts.length, 0);
  if (croise > 0) {
    constats.push({ st: 'hors', label: 'À suivre', cle: 'frontal', t: 'Appuis presque sur une ligne',
      d: `${croise} appui(s) sur ${total} croisent la ligne médiane du bassin${fr.some((p) => p.metrics.obliqueWarn) ? ' (vue de biais : mesure indicative)' : ''}. Pas de norme publiée : à suivre d'une vidéo à l'autre.` });
    exercices.push({ cle: 'frontal', t: 'Élargir un peu l\'appui et renforcer les hanches',
      li: ['Deux fois par semaine : marche latérale avec élastique, gainage latéral, montée de marche sur une jambe, pont fessier sur une jambe.', 'En footing, quelques lignes droites avec un pied de chaque côté d\'une ligne au sol.'],
      why: 'En laboratoire, élargir légèrement l\'appui diminue les contraintes estimées sur le tibia et l\'adduction de la hanche. Renforcer les hanches gagne de la force mais ne change pas à lui seul la façon de courir : il faut aussi travailler le placement.',
      sources: [['Meardon & Derrick 2014', 24935171], ['Brindle 2014', 23831430], ['Willy & Davis 2011', 21765220], ['Neal 2016 (méta-analyse)', 26979886]] });
  }
  const drops = fr.filter((p) => p.kind === 'dos' && !p.metrics.obliqueWarn).map((p) => Math.max(p.metrics.drop.gauche ?? -9, p.metrics.drop.droite ?? -9));
  const d = drops.length ? Math.max(...drops) : NaN, sDrop = statut('drop', d);
  if (sDrop === 'hors' || sDrop === 'loin') {
    constats.push({ st: sDrop, cle: 'frontal', t: 'Chute du bassin en appui', d: `Jusqu'à ${f0(d, 1)}° (moyenne chez des coureurs loisirs : 3,7 ± 1,9°, Bramah 2018).` });
    exercices.push({ cle: 'frontal', t: 'Contrôle du bassin',
      li: ['Renforcement des muscles du côté de la hanche (gainage latéral, pont sur une jambe, descente de marche).', 'Courir quelques minutes devant un repère (vitrine, vidéo) en gardant le bassin horizontal.'],
      why: 'Garder le bassin horizontal en appui est l\'un des repères de technique les plus étudiés en course. Le renforcement des hanches gagne de la force ; dans les études, ce sont un peu plus de cadence et un retour visuel (vitrine, vidéo) qui ont changé la mécanique.',
      sources: [['Bramah 2018', 30193080], ['Willy 2016', 25652871], ['Noehren 2011', 20584755], ['Willy & Davis 2011', 21765220]] });
  }

  if (prof.length && !constats.some((c) => c.st !== 'ok')) constats.push({ st: 'ok', t: 'Rien de marquant', d: 'Aucune mesure ne sort nettement des repères publiés.' });
  if (prof.length) {
    const forts = [['vosc_cm', 'rebond vertical'], ['knee_ic', 'flexion du genou au contact'], ['cadence', 'cadence']]
      .filter(([k]) => statut(k, ty[k]) === 'ok').map(([, t]) => t);
    if (forts.length) constats.push({ st: 'ok', t: 'Points forts', d: `Dans les repères : ${forts.join(', ')}.` });
  }
  if (!fr.some((p) => p.kind === 'dos')) {
    const filme = a.passes.some((p) => p.kind === 'dos');
    constats.push({ st: 'na', t: filme ? 'Vue de dos non exploitable' : 'Vue de dos manquante', d: filme
      ? 'Le passage de dos n\'a pas pu être chiffré (voir Vue de face / de dos). Téléphone à hauteur de hanche, arrêt à 10–15 m.'
      : 'La chute du bassin et l\'alignement du genou se mesurent de dos, caméra dans l\'axe de course.' });
  }
  return { constats, exercices, typique: ty };
}
