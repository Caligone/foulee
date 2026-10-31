// Recommandations : constats (« En bref ») et pistes d'entraînement tirés des statuts des repères. Module pur.
// Vocabulaire de technique et de performance : ni santé, ni charge sur une articulation, ni étude sur des blessés.

import { REPERES, statut, typique } from './reperes.js';
import { profils, frontaux } from './analyse.js';
import { fmt } from '../format.js';

const RANG = { ok: 0, hors: 1, loin: 2 };
const aSignaler = (st) => (RANG[st] ?? 0) > 0; // « na » et « info » ne déclenchent rien
const pire = (a, b) => ((RANG[a] ?? 0) >= (RANG[b] ?? 0) ? a : b);
const plusGrand = (...v) => { const f = v.filter(Number.isFinite); return f.length ? Math.max(...f) : NaN; };
const moy = (k, d = 1) => `${fmt(REPERES[k].m, d)} ± ${fmt(REPERES[k].sd, d)}`;

export function bilan(a) {
  const prof = profils(a), fr = frontaux(a);
  const ty = typique(prof.map((p) => p.metrics));
  const constats = [], exercices = [];

  if (prof.length) {
    const sTibia = statut('shank_deg', ty.shank_deg), sTalon = statut('heel_hip_pct', ty.heel_hip_pct);
    if (aSignaler(sTibia) || aSignaler(sTalon)) {
      constats.push({ st: pire(sTibia, sTalon), cle: 'shank_deg', t: 'Le pied se pose devant le bassin',
        d: `Au contact, le tibia penche de ${fmt(ty.shank_deg)}° vers l'avant et le talon arrive ${fmt(ty.heel_hip_cm)} cm devant le bassin (${fmt(ty.heel_hip_pct)} % de la longueur de jambe) : la foulée freine un peu à chaque pas.` });
      const cad = ty.cadence; // cadence habituelle (médiane), pas celle d'un passage isolé
      exercices.push({ cle: 'cadence', t: `Monter la cadence de 5 à 7 % en footing (≈ ${fmt(cad * 1.05)} à ${fmt(cad * 1.07)} pas/min)`,
        objectif: { k: 'cadence', min: cad * 1.05, max: cad * 1.07 },
        li: ['Métronome de la montre ou musique à ce tempo, par blocs de 2 min, puis sur toute la sortie.', 'Même allure : le pas raccourcit de lui-même et le pied revient sous le bassin.'],
        why: 'À vitesse égale, quelques pas de plus par minute raccourcissent la foulée et ramènent le pied plus près du bassin au contact. Dans un essai randomisé, la nouvelle cadence tenait encore un mois après 8 séances ; l\'effort perçu peut augmenter au début.',
        sources: [['Heiderscheit 2011', 20581720], ['Lieberman 2015', 26538175], ['Willy 2016', 25652871], ['Anderson 2022 (revue)', 36057913]] });
    }
    const sBuste = statut('trunk', ty.trunk);
    if (aSignaler(sBuste) && ty.trunk < REPERES.trunk.m) {
      constats.push({ st: sBuste, cle: 'trunk', t: 'Buste très droit',
        d: `Inclinaison mesurée : ${fmt(ty.trunk)}° (en moyenne ${moy('trunk')}° vers l'avant chez des coureurs loisirs).` });
      exercices.push({ cle: 'trunk', t: 'Courir « grand et légèrement penché »',
        li: ['Légère inclinaison vers l\'avant venue des chevilles, pas de la taille.', 'Surtout aux allures lentes ; viser 5 à 10° sur la prochaine vidéo.'],
        why: 'Une inclinaison de 5 à 10° vers l\'avant correspond à la posture spontanée de coureurs loisirs. Au-delà, la posture devient moins naturelle et plus coûteuse : rester modéré.',
        sources: [['Teng & Powers 2014', 25155651], ['Teng & Powers 2015', 25003780], ['Warrener 2021', 34000575]] });
    }
    const sRebond = statut('vosc_cm', ty.vosc_cm);
    if (aSignaler(sRebond)) constats.push({ st: sRebond, cle: 'vosc_cm', t: 'Rebond vertical élevé',
      d: `Le bassin monte et descend de ${fmt(ty.vosc_cm, 1)} cm à chaque pas (en moyenne ${moy('vosc_cm')} cm).` });
  }

  // pieds qui croisent : un seul constat pour toutes les vues ; pas d'exercice si la vue est de biais (mesure faussée)
  const croise = fr.reduce((n, p) => n + p.metrics.crossings, 0), total = fr.reduce((n, p) => n + p.metrics.contacts.length, 0);
  const biais = fr.some((p) => p.metrics.obliqueWarn);
  if (croise > 0 && biais) {
    constats.push({ st: 'na', label: 'À vérifier', cle: 'frontal', t: 'Appuis peut-être sur une ligne',
      d: `${croise} appui(s) sur ${total} semblent croiser la ligne médiane du bassin, mais la vue est prise de biais. Refilme de face ou de dos, dans l'axe exact du téléphone, pour vérifier.` });
  } else if (croise > 0) {
    constats.push({ st: 'hors', label: 'À comparer', cle: 'frontal', t: 'Appuis presque sur une ligne',
      d: `${croise} appui(s) sur ${total} croisent la ligne médiane du bassin. Pas de moyenne publiée : à comparer d'une vidéo à l'autre.` });
    exercices.push({ cle: 'frontal', t: 'Poser les pieds un peu plus écartés',
      li: ['En footing, quelques lignes droites avec un pied de chaque côté d\'une ligne au sol.', 'Deux fois par semaine, en préparation physique : marche latérale avec élastique, gainage latéral, pont fessier sur une jambe.'],
      why: 'En laboratoire, un appui légèrement plus large rapproche la trajectoire du pied de l\'axe de course. La préparation physique seule ne change pas la façon de courir : il faut aussi travailler le placement.',
      sources: [['Meardon & Derrick 2014', 24935171], ['Brindle 2014', 23831430], ['Willy & Davis 2011', 21765220]] });
  }
  const drops = fr.filter((p) => p.kind === 'dos' && !p.metrics.obliqueWarn).map((p) => plusGrand(p.metrics.drop.gauche, p.metrics.drop.droite));
  const d = plusGrand(...drops), sDrop = statut('drop', d);
  if (aSignaler(sDrop)) {
    constats.push({ st: sDrop, cle: 'frontal', t: 'Bassin qui penche en appui', d: `Jusqu'à ${fmt(d, 1)}° d'inclinaison latérale (moyenne chez des coureurs loisirs : ${moy('drop')}°).` });
    exercices.push({ cle: 'frontal', t: 'Gainage et stabilité du bassin',
      li: ['Gainage latéral, pont sur une jambe, descente de marche lente, deux fois par semaine.', 'Courir quelques minutes devant un repère (vitrine, vidéo) en gardant le bassin horizontal.'],
      why: 'Garder le bassin horizontal en appui fait partie des repères de technique les plus courants en analyse vidéo de la course. Le retour visuel (vitrine, vidéo) aide à fixer le geste ; la préparation physique seule ne suffit pas à le changer.',
      sources: [['Souza 2016 (revue)', 26616185], ['Willy & Davis 2011', 21765220]] });
  }

  if (prof.length && !constats.some((c) => aSignaler(c.st))) constats.push({ st: 'ok', t: 'Rien de marquant', d: 'Aucune mesure ne s\'écarte nettement des repères publiés.' });
  if (prof.length) {
    // une mesure visée par une piste d'entraînement n'est pas un « point fort », même dans le repère
    const visees = new Set(exercices.map((x) => x.objectif?.k));
    const forts = [['vosc_cm', 'rebond vertical'], ['knee_ic', 'flexion du genou au contact'], ['cadence', 'cadence'], ['contact_ms', 'temps au sol']]
      .filter(([k]) => !visees.has(k) && statut(k, ty[k], ty) === 'ok').map(([, t]) => t);
    if (forts.length) constats.push({ st: 'ok', t: 'Dans la moyenne', d: `${forts.join(', ').replace(/^./, (c) => c.toUpperCase())}.` });
  }
  if (!fr.some((p) => p.kind === 'dos')) {
    const filme = a.passes.some((p) => p.kind === 'dos');
    constats.push({ st: 'na', t: filme ? 'Vue de dos non exploitable' : 'Vue de dos manquante', d: filme
      ? 'Le passage de dos n\'a pas pu être chiffré (voir Vue de face / de dos). Téléphone à hauteur de hanche, arrêt à 10–15 m.'
      : 'L\'inclinaison du bassin et l\'alignement du genou se mesurent de dos, caméra dans l\'axe de course.' });
  }
  return { constats, exercices, typique: ty };
}
