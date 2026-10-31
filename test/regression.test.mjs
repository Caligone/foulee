// Non-régression sur de vraies analyses (JSON exportés depuis l'appli) : les mesures recalculées depuis les points
// de pose doivent rester identiques à celles enregistrées. Les fichiers (données personnelles) restent hors dépôt :
// déposer des exports dans test/fixtures/ ; sans fichier, le test est ignoré.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { mesurer } from '../js/domaine/passages.js';

const dir = new URL('./fixtures/', import.meta.url);
const fichiers = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith('.json')) : [];

test('mesures identiques aux exports de référence', { skip: !fichiers.length && 'aucun export dans test/fixtures/' }, () => {
  for (const f of fichiers) {
    const a = JSON.parse(fs.readFileSync(new URL(f, dir)));
    for (const [i, p] of a.passes.entries()) {
      const m = mesurer({ ...p, frames: p.landmarks ?? p.frames }, a.fps, a.height);
      for (const [k, v] of Object.entries(p.metrics || {})) {
        if (typeof v === 'number') assert.ok(Math.abs(v - m[k]) < 1e-9, `${f} passage ${i + 1} ${k} : ${v} → ${m[k]}`);
      }
    }
  }
});

test('caméra mobile : sur des vidéos à caméra fixe, la datation par rapport au bassin retrouve la cadence', { skip: !fichiers.length && 'aucun export dans test/fixtures/' }, () => {
  for (const f of fichiers) {
    const a = JSON.parse(fs.readFileSync(new URL(f, dir)));
    for (const p of a.passes.filter((x) => x.kind === 'profil')) {
      const fr = p.landmarks ?? p.frames, fixe = mesurer({ ...p, frames: fr }, a.fps, a.height), mob = mesurer({ ...p, frames: fr, cameraMobile: true }, a.fps, a.height);
      if (!(fixe?.nSteps >= 3) || !Number.isFinite(mob?.cadence)) continue;
      assert.ok(Math.abs(mob.cadence - fixe.cadence) <= 8, `${f} cadence ${fixe.cadence} → ${mob.cadence}`);
      assert.ok(Math.abs(mob.shank_deg - fixe.shank_deg) <= 4, `${f} tibia ${fixe.shank_deg} → ${mob.shank_deg}`);
      assert.ok(!Number.isFinite(mob.contact_ms) && !Number.isFinite(mob.vosc_cm));
    }
  }
});
