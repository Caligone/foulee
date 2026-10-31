// Tests du domaine (node --test) : repères, statuts, comparaison, états des passages, recommandations.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { REPERES, statut, ecart, comparer, typique, libelle } from '../js/domaine/reperes.js';
import { etat, appuis, aJour, ALGO } from '../js/domaine/analyse.js';
import { bilan } from '../js/domaine/recommandations.js';
import { pace, fmt } from '../js/format.js';

test('statut : bande à 1 écart-type, « loin » au-delà de 2, dans le sens qui pose question', () => {
  assert.equal(statut('cadence', 164), 'ok');
  assert.equal(statut('cadence', 176), 'ok'); // une cadence haute n'est pas signalée
  assert.equal(statut('cadence', 150), 'hors');
  assert.equal(statut('cadence', 140), 'loin');
  assert.equal(statut('trunk', -1), 'loin');
  assert.equal(statut('trunk', 2), 'hors');
  assert.equal(statut('trunk', 13), 'hors');
  assert.equal(statut('trunk', 16), 'loin');
});

test('statut : repère sans écart-type, seuil indicatif, mesure sans repère', () => {
  assert.equal(statut('shank_deg', 4), 'ok');
  assert.equal(statut('shank_deg', 12), 'hors'); // pas de « loin » sans écart-type publié
  assert.equal(statut('heel_hip_pct', 20), 'hors');
  assert.equal(libelle('heel_hip_pct', 'hors'), 'Au-delà du seuil indicatif');
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
  assert.doesNotMatch(texte, /bless|douleur|prévien|prévention|guéri|soign|traitement|diagnos/i);
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
