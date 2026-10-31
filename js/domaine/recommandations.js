// Recommandations : constats, pistes d'entraînement et « À retenir », tirés des statuts des repères. Module pur.
// Vocabulaire de technique et de performance : ni santé, ni charge sur une articulation, ni étude sur des blessés.
//
// Un constat : { role: 'ecart' | 'verifier' | 'comparer' | 'manque', st, label?, cle?, t, d }
//   - « ecart » : une mesure s'écarte d'un repère (st = 'hors' ou 'loin', toujours issu de statut()) ;
//   - « verifier » / « comparer » : à revoir sur une autre vidéo, sans repère publié (st = 'info') ;
//   - « manque » : une vue n'a pas pu être mesurée (st = 'na').

import { REPERES, statut, dansBande, typique, bande } from './reperes.js';
import { profils, frontaux } from './analyse.js';
import { fmt } from '../format.js';

const RANG = { ok: 0, hors: 1, loin: 2 };
const enEcart = (st) => (RANG[st] ?? 0) > 0; // « na » et « info » ne déclenchent rien
const pire = (a, b) => ((RANG[a] ?? 0) >= (RANG[b] ?? 0) ? a : b);
const plusGrand = (...v) => { const f = v.filter(Number.isFinite); return f.length ? Math.max(...f) : NaN; };
const plage = (k, ctx) => { const [a, b] = bande(REPERES[k], ctx); return `${fmt(a)} à ${fmt(b)} ${REPERES[k].unit}`; };
const pluriel = (n, mot) => `${n} ${mot}${n > 1 ? 's' : ''}`;

export function bilan(a) {
  const prof = profils(a), fr = frontaux(a);
  const ty = typique(prof.map((p) => p.metrics));
  const constats = [], exercices = [];

  const mobile = prof.some((p) => p.metrics.cameraMobile);
  if (prof.length && mobile) {
    // caméra mobile : angles au contact indicatifs ; on signale, sans piste d'entraînement
    const sTibia = statut('shank_deg', ty.shank_deg, ty), sTalon = statut('heel_hip_pct', ty.heel_hip_pct, ty);
    if (enEcart(sTibia) || enEcart(sTalon)) constats.push({ role: 'verifier', st: 'info', label: 'À vérifier', cle: 'shank_deg', t: 'Le pied semble se poser devant le bassin',
      d: `Tibia à ${fmt(ty.shank_deg)}° au contact environ, mais la caméra bouge : appuis datés approximativement. Refilme téléphone posé pour confirmer.` });
  }
  if (prof.length && !mobile) {
    const sTibia = statut('shank_deg', ty.shank_deg, ty), sTalon = statut('heel_hip_pct', ty.heel_hip_pct, ty);
    if (enEcart(sTibia) || enEcart(sTalon)) {
      constats.push({ role: 'ecart', st: pire(sTibia, sTalon), cle: 'shank_deg', t: 'Le pied se pose devant le bassin',
        d: `Au contact, le tibia penche de ${fmt(ty.shank_deg)}° vers l'avant et le talon arrive ${fmt(ty.heel_hip_cm)} cm devant le bassin : la foulée freine un peu à chaque pas.` });
      const cad = ty.cadence; // cadence habituelle (médiane), pas celle d'un passage isolé
      exercices.push({ cle: 'cadence', vise: ['shank_deg', 'heel_hip_pct', 'cadence'],
        t: `Pour ramener le pied sous le bassin : monter la cadence de 5 à 7 % (≈ ${fmt(cad * 1.05)} à ${fmt(cad * 1.07)} pas/min)`,
        objectif: { k: 'cadence', min: cad * 1.05, max: cad * 1.07 },
        li: ['Métronome de la montre ou musique à ce tempo, par blocs de 2 min, puis sur toute la sortie.', 'Même allure : le pas raccourcit de lui-même et le pied revient sous le bassin.'],
        why: 'À vitesse égale, quelques pas de plus par minute raccourcissent la foulée et ramènent le pied plus près du bassin au contact. Dans un essai randomisé, la nouvelle cadence tenait encore un mois après 8 séances ; l\'effort perçu peut augmenter au début.',
        sources: [['Heiderscheit 2011', 20581720], ['Lieberman 2015', 26538175], ['Willy 2016', 25652871], ['Anderson 2022 (revue)', 36057913]] });
    }
    const sBuste = statut('trunk', ty.trunk, ty);
    if (enEcart(sBuste) && ty.trunk < REPERES.trunk.m) {
      constats.push({ role: 'ecart', st: sBuste, cle: 'trunk', t: 'Buste très droit',
        d: `Inclinaison mesurée : ${fmt(ty.trunk)}° ; la plupart des coureurs loisirs sont entre ${plage('trunk', ty)} vers l'avant.` });
      exercices.push({ cle: 'trunk', vise: ['trunk'], t: 'Pour un buste moins droit : courir « grand et légèrement penché »',
        li: ['Légère inclinaison vers l\'avant venue des chevilles, pas de la taille.', 'Surtout aux allures lentes ; viser 5 à 10° sur la prochaine vidéo.'],
        why: 'Une inclinaison de 5 à 10° vers l\'avant correspond à la posture spontanée de coureurs loisirs. Beaucoup plus penché, la foulée change nettement (plus courte, plus rapide) : rester modéré.',
        sources: [['Teng & Powers 2014', 25155651], ['Warrener 2021', 34000575]] });
    }
    const sRebond = statut('vosc_cm', ty.vosc_cm, ty);
    if (enEcart(sRebond)) constats.push({ role: 'ecart', st: sRebond, cle: 'vosc_cm', t: 'Rebond vertical élevé',
      d: `Le bassin monte et descend de ${fmt(ty.vosc_cm, 1)} cm à chaque pas ; la plupart des coureurs sont entre ${fmt(bande(REPERES.vosc_cm, ty)[0], 1)} et ${fmt(bande(REPERES.vosc_cm, ty)[1], 1)} cm.` });
  }

  // pieds qui croisent : un seul constat pour toutes les vues ; pas de piste si la vue est de biais (mesure faussée)
  const croise = fr.reduce((n, p) => n + p.metrics.crossings, 0), total = fr.reduce((n, p) => n + p.metrics.contacts.length, 0);
  if (croise > 0 && fr.some((p) => p.metrics.obliqueWarn)) {
    constats.push({ role: 'verifier', st: 'info', label: 'À vérifier', cle: 'frontal', t: 'Appuis peut-être sur une ligne',
      d: `${croise} appui${croise > 1 ? 's' : ''} sur ${total} semblent croiser la ligne médiane du bassin, mais la vue est prise de biais. Refilme de face ou de dos, dans l'axe exact du téléphone, pour vérifier.` });
  } else if (croise > 0) {
    constats.push({ role: 'comparer', st: 'info', label: 'À comparer', cle: 'frontal', t: 'Appuis presque sur une ligne',
      d: `${croise} appui${croise > 1 ? 's' : ''} sur ${total} croisent la ligne médiane du bassin. Pas de moyenne publiée : à comparer d'une vidéo à l'autre.` });
    exercices.push({ cle: 'frontal', vise: [], t: 'Pour des appuis moins alignés : poser les pieds un peu plus écartés',
      li: ['En footing, quelques lignes droites avec un pied de chaque côté d\'une ligne au sol.', 'Garder la même allure et la même cadence.'],
      why: 'En laboratoire, un appui légèrement plus large rapproche la trajectoire du pied de l\'axe de course. Le travail du placement en course est ce qui change le geste.',
      sources: [['Meardon & Derrick 2014', 24935171], ['Brindle 2014', 23831430]] });
  }
  const drops = fr.filter((p) => p.kind === 'dos' && !p.metrics.obliqueWarn).map((p) => plusGrand(p.metrics.drop.gauche, p.metrics.drop.droite));
  const d = plusGrand(...drops), sDrop = statut('drop', d);
  if (enEcart(sDrop)) {
    constats.push({ role: 'ecart', st: sDrop, cle: 'frontal', t: 'Bassin qui penche en appui', d: `Jusqu'à ${fmt(d, 1)}° d'inclinaison latérale, au-delà du seuil indicatif de ${fmt(REPERES.drop.seuil)}°.` });
    exercices.push({ cle: 'frontal', vise: [], t: 'Pour un bassin plus horizontal : courir devant un repère',
      li: ['Quelques minutes devant une vitrine ou en te filmant, en gardant le bassin horizontal à chaque appui.', 'En renfort musculaire général, du gainage latéral deux fois par semaine.'],
      why: 'Garder le bassin horizontal en appui fait partie des critères de technique observés en analyse vidéo de la course. C\'est le travail du geste en course, avec un retour visuel, qui le fait évoluer.',
      sources: [['Souza 2016 (analyse vidéo)', 26616185]] });
  }

  if (!fr.some((p) => p.kind === 'dos')) {
    const filme = a.passes.some((p) => p.kind === 'dos');
    constats.push({ role: 'manque', st: 'na', t: filme ? 'Vue de dos non exploitable' : 'Vue de dos manquante', d: filme
      ? 'Le passage de dos n\'a pas pu être chiffré (voir Vue de face / de dos). Téléphone à hauteur de hanche, arrêt à 10–15 m.'
      : 'L\'inclinaison du bassin et la position des genoux se mesurent de dos, caméra dans l\'axe de course.' });
  }
  // les écarts d'abord, du plus fort au plus faible
  constats.sort((x, y) => (RANG[y.st] ?? -1) - (RANG[x.st] ?? -1));
  return { constats, exercices, typique: ty, retenir: retenir(prof, ty, constats, exercices) };
}

// « À retenir » : ce qu'un coureur doit lire en 10 secondes, calculé ici pour être testable
function retenir(prof, ty, constats, exercices) {
  const principal = constats.find((c) => c.role === 'ecart');
  const visees = new Set(exercices.flatMap((x) => x.vise));
  // « dans la moyenne » : valeur dans la bande publiée, et pas une mesure qu'une piste cherche à faire bouger
  const moyenne = prof.length ? [['cadence', 'cadence'], ['contact_ms', 'temps de contact'], ['duty', 'temps au sol'], ['vosc_cm', 'rebond vertical']]
    .filter(([k]) => !visees.has(k) && dansBande(k, ty[k], ty)).map(([, t]) => t) : [];
  return {
    aucunProfil: !prof.length,
    principal: principal ?? null,
    action: exercices[0] ?? null,
    moyenne,
    resume: prof.length ? { pace: ty.pace, cadence: ty.cadence, contact: ty.contact_ms } : null,
    appuis: prof.length ? pluriel(prof.reduce((n, p) => n + p.metrics.nSteps, 0), 'appui') : '',
  };
}
