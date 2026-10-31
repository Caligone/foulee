// Tests du domaine (node --test) : repères, statuts, comparaison, états des passages, recommandations.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { REPERES, statut, ecart, comparer, typique, libelle, dansBande } from '../js/domaine/reperes.js';
import { etat, appuis, aJour, ALGO } from '../js/domaine/passages.js';
import { bilan } from '../js/domaine/recommandations.js';
import { pace, fmt } from '../js/format.js';

test('statut : écart en écarts-types combinés √(sd² + marge²), dans le sens qui pose question', () => {
  assert.equal(statut('cadence', 164), 'ok');
  assert.equal(statut('cadence', 176), 'ok'); // une cadence haute n'est pas signalée
  assert.equal(statut('cadence', 156), 'ok');
  assert.equal(statut('cadence', 153), 'hors'); // 11 sous la moyenne > √(9² + 3²) ≈ 9,5
  assert.equal(statut('cadence', 140), 'loin');
  assert.equal(statut('trunk', 3), 'ok'); // 4,3° sous la moyenne < √(3,6² + 3²) ≈ 4,7
  assert.equal(statut('trunk', -1), 'hors');
  assert.equal(statut('trunk', -3), 'loin');
  assert.equal(statut('trunk', 16), 'hors');
});

test('repères selon l\'allure (Malisoux 2023) : moyenne et écart-type résiduel suivent la vitesse, bornée à 7–15 km/h', () => {
  const lent = { speed: 8 / 3.6 }, rapide = { speed: 14 / 3.6 }, sprint = { speed: 25 / 3.6 };
  assert.equal(statut('contact_ms', 330, lent), 'ok'); // ~322 ms attendus à 8 km/h
  assert.equal(statut('contact_ms', 300, rapide), 'loin'); // ~218 ms attendus à 14 km/h
  assert.equal(statut('contact_ms', 300), 'ok'); // sans vitesse : repère moyen
  assert.equal(statut('contact_ms', 220, sprint), statut('contact_ms', 220, { speed: 15 / 3.6 })); // pas d'extrapolation
});

test('libellé : les mots de la mesure, un libellé par couleur', () => {
  assert.equal(libelle('cadence', statut('cadence', 150), 150), 'Plus basse que la moyenne');
  assert.equal(libelle('cadence', statut('cadence', 140), 140), 'Nettement plus basse que la moyenne');
  assert.equal(libelle('cadence', statut('cadence', 180), 180), 'Plus élevée que la moyenne'); // côté sans souci : vert
  assert.equal(statut('cadence', 180), 'ok');
  assert.equal(libelle('trunk', statut('trunk', -1), -1), 'Plus droit que la moyenne');
  assert.equal(libelle('shank_deg', statut('shank_deg', 8), 8), 'Dans le seuil indicatif'); // marge de 4°
  assert.equal(libelle('shank_deg', statut('shank_deg', 12), 12), 'Plus penché vers l\'avant que le seuil indicatif');
  assert.equal(libelle('knee_max', statut('knee_max', 30), 30), 'Moins fléchi que le seuil indicatif');
});

test('repères par sexe : moyenne propre (Malisoux 2023), seuil du bassin (Barrett 2023)', async () => {
  const { seuil } = await import('../js/domaine/reperes.js');
  assert.equal(seuil(REPERES.drop, { sexe: 'homme' }), 5);
  assert.equal(seuil(REPERES.drop, { sexe: 'femme' }), 7);
  assert.equal(seuil(REPERES.drop, {}), 7);
  const v = { speed: 9 / 3.6 };
  assert.equal(statut('contact_ms', 330, { ...v, sexe: 'femme' }), 'ok'); // 299 ms attendus à 9 km/h
  assert.equal(statut('vosc_cm', 9.5, { sexe: 'femme' }), 'hors');
  assert.equal(statut('vosc_cm', 9.5, { sexe: 'homme' }), 'ok');
});

test('statut : repère sans écart-type, seuil indicatif, mesure sans repère', () => {
  assert.equal(statut('shank_deg', 4), 'ok');
  assert.equal(statut('shank_deg', 12), 'hors'); // pas de « loin » sans écart-type publié
  assert.equal(statut('shank_deg', 8), 'ok'); // 3° au-delà du seuil, marge de 4°
  assert.equal(statut('heel_hip_pct', 17), 'ok'); // seuil 15, marge 4
  assert.equal(statut('heel_hip_pct', 20), 'hors');
  assert.equal(libelle('heel_hip_pct', 'hors', 20), 'Plus en avant que le seuil indicatif');
  assert.equal(libelle('knee_max', statut('knee_max', 45), 45), 'Dans le seuil indicatif');
  assert.equal(statut('knee_max', 45), 'ok');
  assert.equal(statut('thigh_to', 2), 'info');
  assert.equal(statut('cadence', NaN), 'na');
});

test('aucun statut sans source : tout repère « publie » a une bande ou une moyenne', () => {
  for (const [k, R] of Object.entries(REPERES)) {
    if (R.nature === 'publie') assert.ok(R.band || (R.m !== undefined && R.sd), k);
    if (R.nature === 'indicatif') assert.ok(Number.isFinite(R.seuil) && /indicatif/.test(R.ref), k);
    assert.ok(R.ref, k);
  }
});

test('écart au repère', () => {
  assert.equal(ecart('cadence', 150), 155 - 150);
  assert.equal(ecart('cadence', 180), 0);
  assert.equal(ecart('heel_hip_pct', 25), 10);
  assert.ok(Math.abs(ecart('cadence', 150, { speed: 9.9 / 3.6 }) - (164 - 7.7 - 150)) < 1e-9); // écart-type résiduel à allure connue
});

test('comparaison : rien sous la marge de mesure, verdict par statut au-delà', () => {
  const l = (a, b, k) => comparer({ [k]: a }, { [k]: b })[0].verdict;
  assert.equal(l(9, 11, 'shank_deg'), 'stable'); // 2° < marge de 4°
  assert.equal(l(4, 10, 'shank_deg'), 'moins bien');
  assert.equal(l(28, 18, 'heel_hip_pct'), 'mieux'); // toujours hors seuil, mais plus près
  assert.equal(l(168, 176, 'cadence'), 'stable'); // dans le repère les deux fois
  assert.equal(l(14, 4, 'thigh_to'), 'sans repère');
});

test('médiane des passages', () => {
  assert.equal(typique([{ cadence: 160 }, { cadence: 170 }, { cadence: 200 }]).cadence, 170);
});

test('format', () => {
  assert.equal(pace(5.995), '6:00');
  assert.equal(pace(6.5), '6:30');
  assert.equal(fmt(-0.2), '0');
  assert.equal(fmt(-1.25, 1), '−1,3');
});

const profil = (m) => ({ kind: 'profil', dir: 1, t0: 0, t1: 1, frames: [], metrics: m });
test('états des passages', () => {
  assert.equal(etat({ kind: 'profil', metrics: null }), 'trop court');
  assert.equal(etat(profil({ error: 'déplacement trop faible' })), 'immobile');
  assert.equal(etat(profil({ footsOk: false })), 'pieds masqués');
  assert.equal(etat(profil({ footsOk: true, nSteps: 1 })), 'trop peu d\'appuis');
  assert.equal(etat(profil({ footsOk: true, nSteps: 3 })), 'exploitable');
  assert.equal(etat({ kind: 'dos', metrics: { unreliable: true, contacts: [] } }), 'jambes confondues');
});

test('appui : une seule forme pour toutes les vues', () => {
  assert.deepEqual(appuis(profil({ steps: [{ f_ic: 10, f_to: 30 }] })).map(({ debut, fin }) => [debut, fin]), [[10, 30]]);
  assert.deepEqual(appuis({ kind: 'dos', metrics: { contacts: [{ f0: 5, f1: 9, mt: 7, side: 'gauche' }] } })[0],
    { debut: 5, fin: 9, milieu: 7, cote: 'gauche', mesures: { f0: 5, f1: 9, mt: 7, side: 'gauche' } });
});

test('une analyse à jour n\'est pas recalculée', () => {
  const a = { algo: ALGO, passes: [] };
  assert.equal(aJour(a), a);
});

test('bilan : un passage en erreur ne bloque rien, la vue de dos ratée est signalée comme telle', () => {
  const b = bilan({ passes: [{ kind: 'dos', metrics: { error: 'x' } }] });
  assert.ok(b.constats.some((c) => c.t === 'Vue de dos non exploitable'));
});

test('bilan : aucune allégation médicale dans les textes', () => {
  const m = { footsOk: true, nSteps: 5, shank_deg: 12, heel_hip_pct: 30, heel_hip_cm: 25, trunk: -1, vosc_cm: 12, cadence: 150, knee_ic: 10, speed: 3, steps: [] };
  const dos = { kind: 'dos', metrics: { contacts: [{}, {}], crossings: 1, drop: { gauche: 9, droite: 4 }, obliqueWarn: false } };
  const b = bilan({ passes: [profil(m), dos] });
  const texte = JSON.stringify(b);
  assert.ok(b.exercices.length >= 3);
  assert.doesNotMatch(texte, /bless|douleur|prévien|prévention|guéri|soign|traitement|diagnos|contrainte|adduction|charge sur|impact/i);
});

test('qualité du tournage : signale ce qui est à changer, avec un conseil', async () => {
  const { qualite } = await import('../js/domaine/qualite.js');
  const m = { footsOk: true, nSteps: 3, leg_px: 100, visibleShare: 0.9 };
  const q = qualite({ fps: 30, decoder: 'webcodecs', passes: [profil(m)] });
  const ko = q.filter((x) => !x.ok).map((x) => x.texte);
  assert.ok(ko.some((t) => /images\/s/.test(t)));
  assert.ok(ko.some((t) => /appuis de profil/.test(t)));
  assert.ok(ko.some((t) => /petit à l'image/.test(t)));
  assert.ok(ko.some((t) => /vue de dos/i.test(t)));
  assert.ok(q.filter((x) => !x.ok).every((x) => x.conseil));
});

test('bilan : un côté du bassin manquant n\'efface pas la mesure ; une mesure non calculée ne déclenche rien', () => {
  const dos = { kind: 'dos', metrics: { contacts: [{}, {}], crossings: 0, drop: { gauche: 11, droite: NaN }, obliqueWarn: false } };
  assert.ok(bilan({ passes: [dos] }).constats.some((c) => /bassin/i.test(c.t) && /11,0/.test(c.d)));
  const m = { footsOk: true, nSteps: 5, shank_deg: 2, heel_hip_pct: 5, vosc_cm: NaN, trunk: 7, cadence: 165, knee_ic: 10, speed: 3, steps: [] };
  const b = bilan({ passes: [profil(m)] });
  assert.ok(!b.constats.some((c) => /Rebond/.test(c.t)));
  assert.equal(b.retenir.principal, null);
  assert.equal(b.retenir.aucunProfil, false);
});

test('bilan : pas de piste d\'entraînement tirée d\'une vue de biais ; la cadence visée n\'est pas un point fort', () => {
  const face = { kind: 'face', metrics: { contacts: [{}, {}, {}], crossings: 2, drop: {}, obliqueWarn: true } };
  const m = { footsOk: true, nSteps: 5, shank_deg: 12, heel_hip_pct: 25, heel_hip_cm: 20, trunk: 7, cadence: 168, knee_ic: 10, vosc_cm: 8, speed: 3, steps: [] };
  const b = bilan({ passes: [profil(m), face] });
  assert.ok(!b.exercices.some((x) => x.cle === 'frontal'));
  assert.ok(b.constats.some((c) => c.label === 'À vérifier'));
  assert.ok(!b.retenir.moyenne.includes('cadence')); // la cadence est visée par la piste
  assert.equal(b.retenir.principal.t, 'Le pied se pose devant le bassin');
});

test('qualité : la caméra qui bouge est signalée', async () => {
  const { qualite, cameraBouge } = await import('../js/domaine/qualite.js');
  assert.equal(cameraBouge({ agite: 0.05 }), false);
  assert.equal(cameraBouge({ agite: 0.6 }), true); // analyses anciennes : agitation globale
  assert.equal(cameraBouge({ agite: 0.7, fond: 0.01 }), false); // coureur proche ou tapis, caméra fixe
  assert.equal(cameraBouge({ agite: 0.3, fond: 0.2 }), true);
  assert.equal(cameraBouge(undefined), false); // analyses anciennes, sans la mesure
  const q = qualite({ fps: 60, mouvement: { agite: 0.6 }, passes: [] });
  assert.ok(q.some((x) => !x.ok && /bouge/.test(x.texte)));
});

test("À retenir : le constat le plus grave d'abord, rien de rassurant sans profil, « dans la moyenne » seulement dans la bande", () => {
  const m = { footsOk: true, nSteps: 8, shank_deg: 9, heel_hip_pct: 22, heel_hip_cm: 18, trunk: -4, cadence: 200, contact_ms: 290, duty: 39, vosc_cm: 8, speed: 2.75, steps: [] };
  const b = bilan({ passes: [profil(m)] });
  assert.equal(b.retenir.principal.st, 'loin'); // buste à −4° (fort écart) avant le pied devant le bassin (écart)
  const dos = { kind: 'dos', metrics: { contacts: [{}, {}], crossings: 0, drop: { gauche: 3, droite: 3 }, obliqueWarn: false } };
  assert.equal(bilan({ passes: [dos] }).retenir.aucunProfil, true);
  assert.equal(dansBande('cadence', 200, { speed: 2.75 }), false);
  assert.ok(!bilan({ passes: [profil({ ...m, shank_deg: 2, heel_hip_pct: 5, trunk: 7 })] }).retenir.moyenne.includes('cadence'));
});

test('caméra mobile : angles indicatifs sans piste, mesures liées au sol non rendues', () => {
  const m = { footsOk: true, nSteps: 6, cameraMobile: true, indicatifs: ['shank_deg', 'heel_hip_pct'], shank_deg: 14, heel_hip_pct: 30, heel_hip_cm: 25,
    trunk: 6, cadence: 170, contact_ms: NaN, vosc_cm: NaN, speed: NaN, steps: [] };
  const b = bilan({ passes: [profil(m)] });
  assert.equal(b.exercices.length, 0);
  assert.ok(b.constats.some((c) => c.role === 'verifier' && /semble/.test(c.t)));
  assert.equal(b.retenir.principal, null);
});

test("bilan : toute mesure en écart a un constat (jamais « Rien de marquant » au-dessus d'une jauge orange), et « Essaie » suit le constat principal", () => {
  const m = { footsOk: true, nSteps: 8, shank_deg: 2, heel_hip_pct: 5, trunk: 7, cadence: 140, contact_ms: 290, duty: 39, vosc_cm: 8, knee_max: 45, speed: 2.75, steps: [] };
  const b = bilan({ passes: [profil(m)] });
  assert.equal(b.retenir.principal?.cle, 'cadence');
  const dos = { kind: 'dos', metrics: { contacts: [{}, {}], crossings: 0, drop: { gauche: 12, droite: 12 }, obliqueWarn: false } };
  const b2 = bilan({ passes: [profil({ ...m, cadence: 168, shank_deg: 12, heel_hip_pct: 25, heel_hip_cm: 20 }), dos], sexe: 'homme' });
  assert.equal(b2.retenir.principal.cle, 'shank_deg'); // deux écarts simples : l'ordre d'origine est gardé
  assert.ok(b2.retenir.action.vise.includes('shank_deg')); // la piste du constat principal, pas une autre
  assert.ok(b2.constats.some((c) => c.cle === 'frontal' && c.role === 'ecart')); // bassin à 12° : seuil 5° (homme) + marge
  assert.equal(b2.exercices[b2.retenir.numeroAction - 1], b2.retenir.action);
});

test('caméra mobile décidée par passage, sur son agitation propre', async () => {
  const { fondPassage, cameraBouge } = await import('../js/domaine/passages.js');
  const mv = { fond: 0.02, serie: [[1, 0.01], [2, 0.01], [10, 0.3], [11, 0.4], [12, 0.35]] };
  assert.ok(fondPassage(mv, 0, 3) < 0.05);
  assert.ok(fondPassage(mv, 9, 13) > 0.05);
  assert.equal(cameraBouge(mv), false);
});
