// Repères : à quoi comparer chaque mesure, et le statut qui en découle. Module pur (testable en Node).
//
// Un repère a une nature :
//   - « publie »   : moyenne ± écart-type d'une population (m, sd) ou critère d'une grille publiée (bande) ;
//   - « indicatif » : seuil choisi par l'appli faute de norme, toujours affiché comme tel ;
//   - « aucun »    : pas de norme, la mesure est seulement décrite.
// et un sens : ce qui pose question est la valeur trop basse (« bas »), trop haute (« haut ») ou les deux.
// Statuts : « ok » dans le repère ; « hors » au-delà de la bande (1 écart-type) ou du seuil indicatif ;
// « loin » au-delà de 2 écarts-types (en dehors d'environ 95 % de la population de référence) ;
// « info » sans repère ; « na » non mesuré.

export const REPERES = {
  cadence: {
    label: 'Cadence', unit: 'pas/min', sc: [140, 195], fiabilite: 'haute',
    what: 'Nombre de pas par minute, les deux pieds comptés.',
    nature: 'publie', m: 164, sd: 9, sens: 'bas',
    ref: 'Cadence spontanée : 164 ± 9 pas/min chez ~860 coureurs loisirs (Malisoux 2023, tapis). Elle augmente avec la vitesse.',
  },
  contact_ms: {
    label: 'Temps de contact', unit: 'ms', sc: [180, 400], fiabilite: 'haute (± 1 image)',
    what: 'Durée pendant laquelle le pied reste au sol à chaque pas.',
    nature: 'publie', m: 289, sd: 35, sens: 'haut',
    ref: '289 ± 35 ms à allure spontanée, environ −17 ms par km/h de plus (Malisoux 2023, tapis).',
  },
  duty: {
    label: 'Part du temps au sol', unit: '%', sc: [25, 55], fiabilite: 'haute',
    what: 'Part de chaque foulée passée au sol plutôt qu\'en l\'air.',
    nature: 'publie', m: 39, sd: 4, sens: 'haut',
    ref: 'Duty factor : 39 ± 4 % (Malisoux 2023, tapis).',
  },
  vosc_cm: {
    label: 'Oscillation verticale (bassin)', unit: 'cm', sc: [3, 15], fiabilite: 'moyenne',
    what: 'De combien le bassin monte et descend à chaque pas.',
    nature: 'publie', m: 7.7, sd: 1.2, sens: 'haut',
    ref: '7,7 ± 1,2 cm au global, 8,0 ± 1,3 cm chez les hommes (Malisoux 2023, centre de masse sur tapis ; l\'appli suit le bassin).',
  },
  foot_deg: {
    label: 'Angle du pied au contact', unit: '°', sc: [-15, 40], fiabilite: 'moyenne (± 5°)',
    what: 'Angle de la semelle avec le sol au moment où le pied le touche ; positif = talon en premier.',
    nature: 'aucun', classes: [[-1.6, 'avant-pied'], [8, 'médio-pied'], [Infinity, 'talon']], band: [-1.6, 8],
    ref: 'Attaque talon au-delà de 8°, médio-pied entre −1,6 et 8°, avant-pied en dessous (Altman & Davis 2012). Aucun type d\'attaque n\'est « meilleur » en soi.',
  },
  shank_deg: {
    label: 'Inclinaison du tibia au contact', unit: '°', sc: [-10, 25], fiabilite: 'moyenne (± 3 à 5°)',
    what: 'Angle du tibia avec la verticale au moment où le pied touche le sol ; positif = le pied arrive devant le genou.',
    nature: 'publie', band: [-5, 5], sens: 'haut',
    ref: 'Repère de technique : à moins de 5° de la verticale (grille d\'analyse vidéo de Barrett 2023) ; au-delà, le pied se pose devant le genou.',
  },
  heel_hip_pct: {
    label: 'Talon devant le bassin au contact', unit: '% jambe', sc: [-5, 50], fiabilite: 'moyenne',
    what: 'Distance entre le talon et l\'aplomb du bassin au moment où le pied touche le sol, en part de la longueur de jambe.',
    nature: 'indicatif', seuil: 15, sens: 'haut',
    ref: 'Pas de norme publiée. Le freinage augmente avec cette distance, et une cadence plus élevée la réduit (Lieberman 2015). Seuil indicatif de l\'appli : 15 % de la longueur de jambe.',
  },
  knee_ic: {
    label: 'Flexion du genou au contact', unit: '°', sc: [0, 30], fiabilite: 'moyenne',
    what: 'Pliure du genou au moment où le pied touche le sol (0° = jambe tendue).',
    nature: 'publie', m: 10.2, sd: 4.8, sens: 'bas',
    ref: 'Moyenne : 10,2 ± 4,8° chez des coureurs loisirs (Bramah 2018, 3D, 3,2 m/s).',
  },
  knee_max: {
    label: 'Flexion max du genou en appui', unit: '°', sc: [20, 75], fiabilite: 'faible (jambes croisées)',
    what: 'Pliure la plus forte du genou pendant l\'appui, quand il porte le poids du corps.',
    nature: 'publie', band: [40, 50], sens: 'bas',
    ref: 'Environ 45° en moyenne (Souza 2016).',
  },
  thigh_to: {
    label: 'Cuisse derrière la verticale au décollage', unit: '°', sc: [-10, 35], fiabilite: 'moyenne',
    what: 'Angle de la cuisse derrière la verticale quand le pied quitte le sol : l\'amplitude de la poussée.',
    nature: 'aucun', ref: 'Pas de norme publiée en 2D.',
  },
  trunk: {
    label: 'Inclinaison du buste', unit: '°', sc: [-15, 20], fiabilite: 'faible à moyenne',
    what: 'Inclinaison du buste ; positif = vers l\'avant.',
    nature: 'publie', m: 7.3, sd: 3.6, sens: 'deux',
    ref: 'Spontanée : 7,3 ± 3,6° vers l\'avant (Teng & Powers 2014, 3,4 m/s). Un buste plus incliné reporte une partie du travail du genou vers la hanche.',
  },
  elbow: {
    label: 'Angle des coudes', unit: '°', sc: [40, 150], fiabilite: 'moyenne',
    what: 'Ouverture du coude (90° = angle droit).',
    nature: 'aucun', ref: 'Pas de norme publiée pour l\'angle du coude.',
  },
  // vue de dos
  drop: {
    label: 'Chute du bassin en appui', unit: '°', sc: [0, 12], fiabilite: 'modérée à bonne en 2D (Dingenen 2018)',
    what: 'Abaissement du côté du bassin opposé au pied d\'appui.',
    nature: 'publie', m: 3.7, sd: 1.9, sens: 'haut',
    ref: '3,7 ± 1,9° en moyenne chez des coureurs loisirs (Bramah 2018, 3D).',
  },
};

// bande « dans le repère » : publiée telle quelle, ou moyenne ± 1 écart-type
export const bande = (R) => R.band ?? (R.sd ? [R.m - R.sd, R.m + R.sd] : null);
export const classe = (R, v) => R.classes?.find(([lim]) => v < lim)?.[1];

export function statut(k, v) {
  const R = REPERES[k];
  if (!R || !Number.isFinite(v)) return 'na';
  if (R.nature === 'aucun') return 'info';
  const bas = R.sens !== 'haut', haut = R.sens !== 'bas';
  if (R.nature === 'indicatif') return (haut && v > R.seuil) || (bas && v < R.seuil) ? 'hors' : 'ok';
  if (R.sd) {
    const z = (v - R.m) / R.sd;
    if ((haut && z > 2) || (bas && z < -2)) return 'loin';
  }
  const [b0, b1] = bande(R);
  return (haut && v > b1) || (bas && v < b0) ? 'hors' : 'ok';
}

// écart au repère dans le sens qui pose question (0 dans le repère) : sert à dire si une mesure se rapproche du repère
export function ecart(k, v) {
  const R = REPERES[k];
  if (!R || R.nature === 'aucun' || !Number.isFinite(v)) return 0;
  const [b0, b1] = R.nature === 'indicatif' ? [R.seuil, R.seuil] : bande(R);
  return Math.max(R.sens !== 'haut' ? b0 - v : 0, R.sens !== 'bas' ? v - b1 : 0, 0);
}

export const LIBELLES = {
  ok: 'Dans le repère', hors: 'Hors repère', loin: 'Nettement hors repère', info: 'Sans repère', na: 'Non mesuré',
};
// pour un seuil de l'appli, on ne parle pas de « repère »
export const libelle = (k, st) => REPERES[k]?.nature === 'indicatif' && st === 'hors' ? 'Au-delà du seuil indicatif' : LIBELLES[st];

const med = (a) => {
  const b = a.filter(Number.isFinite).sort((x, y) => x - y);
  return b.length ? (b.length % 2 ? b[b.length >> 1] : (b[b.length / 2 - 1] + b[b.length / 2]) / 2) : NaN;
};
export { med as mediane };

// valeur retenue pour chaque mesure de profil : médiane des passages (un passage raté ne fait pas basculer le verdict)
export const typique = (mesures) => Object.fromEntries(
  [...Object.keys(REPERES), 'heel_hip_cm', 'pace', 'speed'].map((k) => [k, med(mesures.map((m) => m[k]))]));

// ---------- Comparaison de deux analyses ----------
// marge de mesure : seuil de l'appli, d'après l'écart observé entre deux modèles de pose sur une même vidéo
export const BRUIT = { cadence: 3, contact_ms: 25, duty: 3, vosc_cm: 1, foot_deg: 4, shank_deg: 4, heel_hip_pct: 4,
  knee_ic: 4, knee_max: 4, thigh_to: 4, trunk: 3 };
const RANG = { ok: 0, hors: 1, loin: 2 };

// verdict seulement au-delà de la marge : changement de statut, ou à statut égal hors repère, rapprochement du repère
export function comparer(avant, apres) {
  return Object.keys(BRUIT).filter((k) => Number.isFinite(avant[k]) && Number.isFinite(apres[k])).map((k) => {
    const sa = statut(k, avant[k]), sb = statut(k, apres[k]), diff = apres[k] - avant[k];
    let verdict = 'stable';
    if (REPERES[k].nature !== 'aucun' && Math.abs(diff) >= BRUIT[k]) {
      const gain = ecart(k, avant[k]) - ecart(k, apres[k]);
      if (RANG[sb] < RANG[sa] || (RANG[sb] === RANG[sa] && RANG[sb] > 0 && gain > 0)) verdict = 'mieux';
      else if (RANG[sb] > RANG[sa] || (RANG[sb] === RANG[sa] && RANG[sb] > 0 && gain < 0)) verdict = 'moins bien';
    }
    if (REPERES[k].nature === 'aucun') verdict = 'sans repère';
    return { k, avant: avant[k], apres: apres[k], diff, statutAvant: sa, statutApres: sb, verdict };
  });
}
