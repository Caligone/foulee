// Non-régression sur de vraies analyses (JSON exportés depuis l'appli) : les mesures recalculées depuis les points
// de pose doivent rester identiques à celles enregistrées. Les fichiers (données personnelles) restent hors dépôt :
// déposer des exports dans test/fixtures/ ; sans fichier, le test est ignoré.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { mesurer } from '../js/domaine/analyse.js';

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
