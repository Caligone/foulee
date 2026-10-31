// Rapport : repères publiés, statut de chaque mesure, recommandations, jauges, images clés et lecteur.

export const REFS = {
  cadence: { what: 'Nombre de pas par minute, les deux pieds comptés.', label: 'Cadence', unit: 'pas/min', band: [155, 173], sc: [140, 195], rel: 'haute',
    ref: 'Préférée : 164 ± 9 pas/min chez ~900 coureurs loisirs (Malisoux 2023).',
    status: (v) => v < 150 ? 'warn' : 'ok' },
  contact_ms: { what: 'Durée pendant laquelle le pied reste au sol à chaque pas.', label: 'Temps de contact', unit: 'ms', band: [254, 324], sc: [180, 400], rel: 'haute (± 1 image)',
    ref: '289 ± 35 ms à allure préférée, environ −17 ms par km/h de plus (Malisoux 2023).',
    status: (v) => v > 324 ? 'warn' : 'ok' },
  duty: { what: 'Part de chaque foulée passée au sol plutôt qu\'en l\'air.', label: 'Part du temps au sol', unit: '%', band: [35, 43], sc: [25, 55], rel: 'haute',
    ref: 'Duty factor : 39 ± 4 % (Malisoux 2023).', status: (v) => v > 43 ? 'warn' : 'ok' },
  vosc_cm: { what: 'De combien le bassin monte et descend à chaque pas.', label: 'Oscillation verticale (bassin)', unit: 'cm', band: [6.7, 9.3], sc: [3, 15], rel: 'moyenne',
    ref: '8,0 ± 1,3 cm chez les hommes, 7,7 ± 1,2 cm au global (Malisoux 2023).', status: (v) => v > 10 ? 'warn' : 'ok' },
  foot_deg: { what: 'Angle de la semelle avec le sol au moment où le pied le touche ; positif = talon en premier.', label: 'Angle du pied au contact', unit: '°', band: [-1.6, 8], sc: [-15, 40], rel: 'moyenne (± 5°)',
    ref: 'Attaque talon au-delà de 8°, médio-pied entre −1,6 et 8°, avant-pied en dessous (Altman & Davis 2012). Aucun type d\'attaque n\'est « meilleur » en soi.',
    status: (v, m) => (v > 8 && m.shank_deg > 5) ? 'warn' : 'ok', fmtExtra: (v) => v > 8 ? 'talon' : v < -1.6 ? 'avant-pied' : 'médio-pied' },
  shank_deg: { what: 'Angle du tibia avec la verticale au moment où le pied touche le sol ; positif = le pied arrive devant le genou.', label: 'Inclinaison du tibia au contact', unit: '°', band: [-5, 5], sc: [-10, 25], rel: 'moyenne (± 3 à 5°)',
    ref: 'Grille clinique : idéalement à moins de 5° de la verticale (Barrett 2023) ; au-delà, le pied se pose devant le genou (Souza 2016).',
    status: (v) => v > 10 ? 'bad' : v > 5 ? 'warn' : 'ok' },
  heel_hip_pct: { cuts: 'Pas de repère publié, seuils indicatifs de l\'appli : 15 et 25 %', what: 'Distance entre le talon et l\'aplomb du bassin au moment où le pied touche le sol, en part de la longueur de jambe.', label: 'Talon devant le bassin au contact', unit: '% jambe', band: null, sc: [-5, 50], rel: 'moyenne',
    ref: 'Pas de norme publiée. Le freinage augmente avec cette distance et une cadence plus élevée la réduit (Lieberman 2015). Seuils indicatifs de l\'appli : 15 % et 25 % de la longueur de jambe.',
    status: (v) => v > 25 ? 'bad' : v > 15 ? 'warn' : 'ok' },
  knee_ic: { what: 'Pliure du genou au moment où le pied touche le sol (0° = jambe tendue).', label: 'Flexion du genou au contact', unit: '°', band: [5.4, 15], sc: [0, 30], rel: 'moyenne',
    ref: 'Sains : 10,2 ± 4,8°, blessés : 6,0 ± 4,9° (Bramah 2018, 3D, 3,2 m/s).', status: (v) => v < 5 ? 'warn' : 'ok' },
  knee_max: { what: 'Pliure la plus forte du genou pendant l\'appui, quand il porte le poids du corps.', label: 'Flexion max du genou en appui', unit: '°', band: [40, 50], sc: [20, 75], rel: 'faible (jambes croisées)',
    ref: 'Environ 45° ; moins de 40° est associé à un sous-groupe de douleurs fémoro-patellaires (Souza 2016).', status: (v) => v < 38 ? 'warn' : 'ok' },
  thigh_to: { what: 'Angle de la cuisse derrière la verticale quand le pied quitte le sol : l\'amplitude de la poussée.', label: 'Cuisse derrière la verticale au décollage', unit: '°', band: null, sc: [-10, 35], rel: 'moyenne',
    ref: 'Pas de norme publiée en 2D ; reflète l\'amplitude de poussée.', status: (v) => v < 8 ? 'warn' : 'ok' },
  trunk: { what: 'Inclinaison du buste ; positif = vers l\'avant.', label: 'Inclinaison du buste', unit: '°', band: [3.7, 10.9], sc: [-15, 20], rel: 'faible à moyenne',
    ref: 'Spontanée : 7,3 ± 3,6° vers l\'avant (Teng & Powers 2014, 3,4 m/s). Un buste plus droit augmente la contrainte fémoro-patellaire.',
    status: (v) => (v < 2 || v > 14) ? 'warn' : 'ok' },
  elbow: { what: 'Ouverture du coude (90° = angle droit).', label: 'Angle des coudes', unit: '°', band: null, sc: [40, 150], rel: 'moyenne',
    ref: 'Pas de norme. Le balancier des bras réduit le coût énergétique (Arellano & Kram 2014).', status: () => 'ok' },
};
export const PROFILE_KEYS = [
  ['Rythme et appuis', ['cadence', 'contact_ms', 'duty', 'vosc_cm']],
  ['Attaque du pied', ['foot_deg', 'shank_deg', 'heel_hip_pct', 'knee_ic']],
  ['Appui et poussée', ['knee_max', 'thigh_to']],
  ['Posture', ['trunk', 'elbow']],
];
export const STATUS = { ok: ['c-ok', 'Dans la norme'], warn: ['c-warn', 'À surveiller'], bad: ['c-bad', 'À travailler'], na: ['c-na', 'Non mesuré'] };
export const fmt = (x, d = 0) => Number.isFinite(x) ? (+x.toFixed(d) || 0).toFixed(d).replace('.', ',').replace('-', '−') : '—';
export const pace = (p) => Number.isFinite(p) ? `${Math.floor(p)}:${String(Math.round((p % 1) * 60)).padStart(2, '0')}` : '—';
const med = (a) => { const b = a.filter(Number.isFinite).sort((x, y) => x - y); return b.length ? (b.length % 2 ? b[b.length >> 1] : (b[b.length / 2 - 1] + b[b.length / 2]) / 2) : NaN; };
// valeur retenue pour chaque mesure : médiane des passages de profil (un passage raté ne fait pas basculer le verdict)
export const typical = (prof) => Object.fromEntries([...Object.keys(REFS), 'heel_hip_cm'].map((k) => [k, med(prof.map((p) => p.metrics[k]))]));
const DEC = { vosc_cm: 1, cadence: 0, contact_ms: 0, duty: 0 };

export function frontalStatus(fm) {
  const out = [];
  const drop = Math.max(fm.drop.gauche ?? -99, fm.drop.droite ?? -99);
  if (fm.view === 'dos' && !fm.obliqueWarn && Number.isFinite(drop)) out.push({ key: 'drop', v: drop, st: drop > 7 ? 'bad' : drop > 5 ? 'warn' : 'ok' });
  out.push({ key: 'cross', v: fm.crossings, st: fm.crossings > 0 ? 'warn' : 'ok' });
  return out;
}

// ---------- Synthèse et recommandations ----------
export function synthesize(passes) {
  const prof = passes.filter((p) => p.kind === 'profil' && p.metrics && !p.metrics.error && p.metrics.nSteps >= 2);
  const fr = passes.filter((p) => p.kind !== 'profil' && p.metrics);
  const slow = prof.slice().sort((a, b) => a.metrics.speed - b.metrics.speed)[0]?.metrics;
  const ty = typical(prof);
  const cards = [], plan = [];
  if (prof.length) {
    const sh = ty.shank_deg, hh = ty.heel_hip_pct;
    if (sh > 5 || hh > 15) {
      cards.push({ st: sh > 10 || hh > 25 ? 'bad' : 'warn', href: '#m-shank_deg', t: 'Le pied se pose devant le bassin',
        d: `Au contact, le tibia penche de ${fmt(sh)}° vers l'avant et le talon arrive ${fmt(ty.heel_hip_cm)} cm devant le bassin (${fmt(hh)} % de la longueur de jambe). C'est le signe d'une foulée qui freine (overstriding).` });
      const cad = slow?.cadence ?? prof[0].metrics.cadence;
      plan.push({ t: `Monter la cadence de 5 à 7 % en footing (≈ ${fmt(cad * 1.05)} à ${fmt(cad * 1.07)} pas/min)`,
        li: ['Métronome de la montre ou musique à ce tempo, par blocs de 2 min, puis sur toute la sortie.', 'Même allure : le pas raccourcit de lui-même et le pied revient sous le bassin.'],
        why: '+5 % de cadence réduit d\'environ 20 % l\'énergie absorbée par le genou (Heiderscheit 2011) et rapproche le pied du bassin au contact (Lieberman 2015).' });
    }
    const tr = ty.trunk;
    if (tr < 2) {
      cards.push({ st: 'warn', href: '#m-trunk', t: 'Buste très droit', d: `Inclinaison mesurée : ${fmt(tr)}° (l'inclinaison habituelle est d'environ 7° vers l'avant). Combiné au pied posé devant, cela favorise le freinage.` });
      plan.push({ t: 'Courir « grand et légèrement penché »', li: ['Légère inclinaison vers l\'avant venue des chevilles, pas de la taille.', 'Surtout aux allures lentes ; viser 5 à 10° sur la prochaine vidéo.'],
        why: 'Un buste plus incliné diminue la contrainte fémoro-patellaire ; un buste plus droit l\'augmente (Teng & Powers 2014). Contrepartie : plus de travail des extenseurs de hanche.' });
    }
    const vo = ty.vosc_cm;
    if (vo > 10) cards.push({ st: 'warn', href: '#m-vosc_cm', t: 'Rebond vertical élevé', d: `Oscillation du bassin de ${fmt(vo, 1)} cm (repère : 8 ± 1,3 cm).` });
  }
  for (const p of fr) {
    const m = p.metrics;
    if (m.crossings > 0) {
      cards.push({ st: 'warn', href: '#frontal', t: 'Appuis presque sur une ligne', d: `${m.crossings} appui(s) sur ${m.contacts.length} croisent la ligne médiane du bassin${m.obliqueWarn ? ' (vue de biais : mesure indicative)' : ''}.` });
      plan.push({ t: 'Élargir un peu l\'appui et renforcer les hanches', li: ['Deux fois par semaine : marche latérale avec élastique, gainage latéral, montée de marche sur une jambe, pont fessier sur une jambe.', 'En footing, quelques lignes droites avec un pied de chaque côté d\'une ligne au sol.'],
        why: 'Un pas plus large de 5 % de la longueur de jambe a réduit la contrainte estimée sur le tibia, y compris chez des coureurs qui croisent (Meardon & Derrick 2014). Le renforcement seul ne change pas forcément la mécanique : à combiner au travail de placement.' });
    }
    if (p.kind === 'dos' && !m.obliqueWarn) {
      const d = Math.max(m.drop.gauche ?? -9, m.drop.droite ?? -9);
      if (d > 5) {
        cards.push({ st: d > 7 ? 'bad' : 'warn', href: '#frontal', t: 'Chute du bassin en appui', d: `Jusqu'à ${fmt(d, 1)}° (sains : 3,7 ± 1,9°, blessés : 6,4 ± 2,1°, Bramah 2018).` });
        plan.push({ t: 'Contrôle du bassin', li: ['Renforcement des abducteurs de hanche (gainage latéral, pont sur une jambe, step-down).', 'Courir quelques minutes devant un repère (vitrine, vidéo) en gardant le bassin horizontal.'],
          why: 'La chute controlatérale du bassin est le facteur le plus associé aux blessures courantes dans Bramah et al. (2018).' });
      }
    }
  }
  if (!cards.some((c) => c.st !== 'ok') && prof.length) cards.push({ st: 'ok', t: 'Rien de marquant', d: 'Aucune mesure ne sort nettement des repères publiés.' });
  if (prof.length) {
    const good = [];
    if (ty.vosc_cm <= 10) good.push('rebond vertical');
    if (ty.knee_ic >= 5) good.push('flexion du genou au contact');
    if (ty.cadence >= 155) good.push('cadence');
    if (good.length) cards.push({ st: 'ok', t: 'Points forts', d: `Dans les repères : ${good.join(', ')}.` });
  }
  if (!fr.some((p) => p.kind === 'dos')) cards.push({ st: 'na', t: 'Vue de dos manquante', d: 'La chute du bassin et l\'alignement du genou se mesurent de dos, caméra dans l\'axe de course.' });
  return { cards, plan };
}

// ---------- Jauges ----------
const pos = (x, sc) => Math.max(0, Math.min(100, (x - sc[0]) / (sc[1] - sc[0]) * 100));
export function gaugesHTML(prof) {
  const ty = typical(prof), n = prof.length;
  let h = '';
  for (const [g, keys] of PROFILE_KEYS) {
    h += `<h3 class="grp">${g}</h3>`;
    for (const k of keys) {
      const R = REFS[k], d = DEC[k] ?? 0, v = ty[k], u = R.unit;
      const st = Number.isFinite(v) ? R.status(v, ty) : 'na';
      const vals = prof.map((p) => p.metrics[k]).filter(Number.isFinite);
      const spread = n > 1 && vals.length ? `médiane de ${n} passages, de ${fmt(Math.min(...vals), d)} à ${fmt(Math.max(...vals), d)}` : '1 passage';
      const extra = R.fmtExtra && Number.isFinite(v) ? ` <span>${R.fmtExtra(v)}</span>` : k === 'heel_hip_pct' ? ` <span>soit ${fmt(ty.heel_hip_cm)} cm</span>` : '';
      const band = R.band ? `Repère publié : ${fmt(R.band[0], d)} à ${fmt(R.band[1], d)} ${u}` : R.cuts ?? 'Pas de repère publié';
      const rk = { heel_hip_pct: 'heel_hip_cm' }[k] ?? k;
      const rows = prof.map((p, i) => { const r = p.metrics.ranges?.[rk]; return `<tr><td>Passage ${i + 1}</td><td class="num">${pace(p.metrics.pace)}/km</td><td class="num">${fmt(p.metrics[k], d)} ${u}</td>${k !== 'heel_hip_pct' ? `<td class="num muted">${r ? `${fmt(r[0])} à ${fmt(r[1])}` : ''}</td>` : ''}</tr>`; }).join('');
      // une ligne par mesure ; le détail (passages, source, fiabilité) ne s'ouvre d'office que pour ce qui sort de la norme
      h += `<details class="metric" id="m-${k}"${st !== 'ok' ? ' open' : ''}><summary>
        <div class="name"><h4>${R.label} <span class="chip ${STATUS[st][0]}">${STATUS[st][1]}</span></h4>
        <div class="vals"><b>${fmt(v, d)} ${u}</b>${extra}</div><p class="what">${R.what}</p></div>
        <div><div class="gauge" role="img" aria-label="${R.label} : ${fmt(v, d)} ${u}. ${band}"><div class="track"></div>
        ${R.band ? `<div class="bandz" style="left:${pos(R.band[0], R.sc)}%;width:${pos(R.band[1], R.sc) - pos(R.band[0], R.sc)}%"></div>` : ''}
        ${n > 1 ? vals.map((x) => `<div class="pt" style="left:${pos(x, R.sc)}%"></div>`).join('') : ''}
        ${Number.isFinite(v) ? `<div class="dot ${STATUS[st][0]}" style="left:${pos(v, R.sc)}%"></div>` : ''}
        <div class="ticks"><span>${fmt(R.sc[0])}</span><span>${fmt(R.sc[1])} ${u}</span></div></div>
        <p class="rel">${band} · ${spread}</p></div></summary>
        <div class="more"><div>${PHOTO[k] ? `<figure class="mphoto"><canvas width="420" height="420" data-k="${k}"></canvas><figcaption></figcaption></figure>` : ''}<div class="tablewrap"><table><thead><tr><th>Passage</th><th>Allure</th><th>Valeur</th>${k !== 'heel_hip_pct' ? '<th>Plage des appuis</th>' : ''}</tr></thead><tbody>${rows}</tbody></table></div></div>
        <div><p class="ref">${R.ref}</p><p class="rel">Fiabilité ${R.rel}</p></div></div></details>`;
    }
  }
  return h;
}

// ---------- Dessin : squelette, images clés ----------
const EDGES = [[11, 12], [11, 23], [12, 24], [23, 24], [11, 13], [13, 15], [12, 14], [14, 16], [23, 25], [25, 27], [27, 29], [29, 31], [27, 31], [24, 26], [26, 28], [28, 30], [30, 32], [28, 32]];
const LEFT = new Set([11, 13, 15, 23, 25, 27, 29, 31]), RIGHT = new Set([12, 14, 16, 24, 26, 28, 30, 32]);
export function css(name) { return getComputedStyle(document.documentElement).getPropertyValue(name).trim(); }
// opts.zoom = [x, y, côté] en pixels vidéo : n'affiche que cette zone de la vignette
export async function drawFrame(ctx, fr, S, opts = {}) {
  const img = await createImageBitmap(fr.thumb), [VX, VY, vs] = fr.view, [TX, TY, ts] = opts.zoom ?? fr.view, q = img.width / vs;
  ctx.drawImage(img, (TX - VX) * q, (TY - VY) * q, ts * q, ts * q, 0, 0, S, S); img.close?.();
  if (!fr.lm) return;
  const k = S / ts;
  const T = (p) => [(p[0] - TX) * k, (p[1] - TY) * k];
  ctx.lineCap = 'round'; ctx.lineWidth = Math.max(2, S / 160);
  for (const [a, b] of EDGES) {
    ctx.strokeStyle = LEFT.has(a) && LEFT.has(b) ? '#f0b93a' : RIGHT.has(a) && RIGHT.has(b) ? '#5aa9ee' : '#eef2f4';
    const [x1, y1] = T(fr.lm[a]), [x2, y2] = T(fr.lm[b]);
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
  }
  ctx.fillStyle = '#fff';
  for (const i of [11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32]) { const [x, y] = T(fr.lm[i]); ctx.beginPath(); ctx.arc(x, y, ctx.lineWidth * 1.2, 0, 7); ctx.fill(); }
  if (opts.label) tag(ctx, opts.label, 10, 26, S);
  if (opts.stance) tag(ctx, 'Appui', S - 70, 26, S, '#55b883', '#0f1418');
}
function tag(ctx, txt, x, y, S, bg = 'rgba(15,20,24,.85)', fg = '#fff') {
  ctx.font = `600 ${Math.round(S / 26)}px "Source Sans 3", system-ui, sans-serif`;
  const w = ctx.measureText(txt).width; ctx.fillStyle = bg; ctx.fillRect(x - 6, y - S / 26 - 4, w + 12, S / 26 + 12);
  ctx.fillStyle = fg; ctx.fillText(txt, x, y);
}

// ---------- Photo « toi / cible » d'une mesure ----------
// segment mesuré (A → B) et direction du zéro z ; la cible est l'éventail du repère tourné autour de A.
// sens de rotation selon la direction de course (dir), pour que l'angle dessiné ait le signe de la mesure
export const PHOTO = {
  shank_deg: 'ton tibia', foot_deg: 'ton pied', knee_ic: 'ta jambe sous le genou', trunk: 'ton buste', heel_hip_pct: 'l\'écart talon-bassin',
};
export async function drawTarget(canvas, fr, k, v, dir, col) {
  const S = canvas.width, ctx = canvas.getContext('2d'), R = REFS[k];
  const lm = fr.lm; if (!lm) return;
  // zoom sur la zone utile : bassin et jambes, plus les épaules pour le buste
  const ids = [23, 24, 25, 26, 27, 28, 29, 30, 31, 32, ...(k === 'trunk' ? [0, 11, 12] : [])];
  const xs = ids.map((j) => lm[j][0]), ys = ids.map((j) => lm[j][1]);
  const side0 = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)) * 1.3;
  const zs = Math.min(fr.view[2], side0), zoom = [(Math.max(...xs) + Math.min(...xs) - zs) / 2, (Math.max(...ys) + Math.min(...ys) - zs) / 2, zs];
  await drawFrame(ctx, fr, S, { zoom });
  const [TX, TY, ts] = zoom, sc = S / ts, T = (p) => [(p[0] - TX) * sc, (p[1] - TY) * sc];
  const avg = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const side = (dir * lm[31][0] >= dir * lm[32][0]) ? 0 : 1; // pied avant dans le sens de course
  const kn = T(lm[25 + side]), an = T(lm[27 + side]), he = T(lm[29 + side]), to = T(lm[31 + side]);
  const hp = T(avg(lm[23], lm[24])), sh = T(avg(lm[11], lm[12]));
  const dist = (a, b) => Math.hypot(b[0] - a[0], b[1] - a[1]);
  const unit = (a, b) => { const d = dist(a, b) || 1; return [(b[0] - a[0]) / d, (b[1] - a[1]) / d]; };
  const rot = (z, a) => { const r = a * Math.PI / 180; return [z[0] * Math.cos(r) - z[1] * Math.sin(r), z[0] * Math.sin(r) + z[1] * Math.cos(r)]; };
  const green = css('--ok') || '#55b883';
  ctx.lineCap = 'round';
  if (k === 'heel_hip_pct') {
    // aplomb du bassin jusqu'au sol, zone sous le seuil de l'appli (15 % de la jambe), écart réel du talon
    const leg = dist(hp, kn) + dist(kn, an), gy = Math.max(he[1], to[1]) + 6;
    ctx.fillStyle = 'rgba(85,184,131,.45)'; ctx.fillRect(Math.min(hp[0], hp[0] + dir * 0.15 * leg), gy - 7, 0.15 * leg, 14);
    ctx.strokeStyle = green; ctx.lineWidth = 3; ctx.setLineDash([8, 6]); ctx.beginPath(); ctx.moveTo(...hp); ctx.lineTo(hp[0], gy); ctx.stroke(); ctx.setLineDash([]);
    ctx.strokeStyle = col; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(hp[0], gy); ctx.lineTo(he[0], gy); ctx.stroke();
    for (const p of [hp, he]) { ctx.fillStyle = col; ctx.beginPath(); ctx.arc(...p, 7, 0, 7); ctx.fill(); }
  } else {
    const G = { shank_deg: [kn, an, [0, 1], -dir], foot_deg: [he, to, [dir, 0], -dir], knee_ic: [kn, an, unit(hp, kn), dir], trunk: [hp, sh, [0, -1], dir] }[k];
    const [A, B, z, s] = G, L = dist(A, B) * 1.15;
    if (R.band) {
      const a0 = Math.atan2(...rot(z, s * R.band[0]).reverse()), a1 = Math.atan2(...rot(z, s * R.band[1]).reverse());
      ctx.fillStyle = 'rgba(85,184,131,.45)'; ctx.strokeStyle = green; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(...A); ctx.arc(...A, L, a0, a1, ((a1 - a0 + 2 * Math.PI) % (2 * Math.PI)) > Math.PI); ctx.closePath(); ctx.fill(); ctx.stroke();
    }
    ctx.strokeStyle = col; ctx.lineWidth = 7; ctx.beginPath(); ctx.moveTo(...A); ctx.lineTo(...B); ctx.stroke();
    ctx.fillStyle = col; ctx.beginPath(); ctx.arc(...A, 7, 0, 7); ctx.fill();
  }
  const lab = k === 'heel_hip_pct' ? `Toi : talon ${fmt(v)} % de jambe devant` : `Toi : ${fmt(v)}°`;
  const cib = k === 'heel_hip_pct' ? 'Seuil de l\'appli : moins de 15 %' : R.band ? `Cible : ${fmt(R.band[0], 1).replace(',0', '')} à ${fmt(R.band[1], 1).replace(',0', '')}°` : '';
  tag(ctx, lab, 10, 26, S, col, '#111');
  if (cib) tag(ctx, cib, 10, 26 + S / 26 + 16, S, green, '#111');
}

// image clé de contact : tibia, pied, verticale du bassin, distance talon-bassin
export async function drawContact(canvas, fr, step, dir, title) {
  const S = canvas.width, ctx = canvas.getContext('2d');
  await drawFrame(ctx, { ...fr, lm: null }, S);
  const [TX, TY, ts] = fr.view, k = S / ts, T = (p) => [(p[0] - TX) * k, (p[1] - TY) * k];
  const lm = fr.lm; if (!lm) return;
  const hip = [(lm[23][0] + lm[24][0]) / 2, (lm[23][1] + lm[24][1]) / 2];
  const side = (dir * lm[31][0] >= dir * lm[32][0]) ? 0 : 1; // pied avant dans le sens de course
  const kn = lm[25 + side], an = lm[27 + side], he = lm[29 + side], to = lm[31 + side];
  const line = (a, b, c, w) => { ctx.strokeStyle = c; ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(...T(a)); ctx.lineTo(...T(b)); ctx.stroke(); };
  line(hip, [hip[0], he[1] + 4], '#55b883', 2);
  line(kn, an, '#f0b93a', 5);
  line(he, to, '#e070e0', 5);
  ctx.setLineDash([6, 5]); line([kn[0], kn[1]], [kn[0], an[1]], '#cfd6da', 1.5); ctx.setLineDash([]);
  line([hip[0], he[1] + 10], [he[0], he[1] + 10], '#55b883', 3);
  for (const p of [hip, kn, an, he, to]) { const [x, y] = T(p); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x, y, 4, 0, 7); ctx.fill(); }
  tag(ctx, title, 10, 26, S);
  const y0 = S - 3 * (S / 26 + 16);
  tag(ctx, `Tibia ${fmt(step.shank_deg)}°`, 10, y0, S, '#f0b93a', '#111');
  tag(ctx, `Pied ${fmt(step.foot_deg)}°`, 10, y0 + S / 26 + 16, S, '#e070e0', '#111');
  tag(ctx, `Talon/bassin ${fmt(step.heel_hip_cm)} cm`, 10, y0 + 2 * (S / 26 + 16), S, '#55b883', '#111');
}

export async function drawFrontal(canvas, fr, c, view) {
  const S = canvas.width, ctx = canvas.getContext('2d');
  await drawFrame(ctx, fr, S);
  const [TX, TY, ts] = fr.view, k = S / ts, T = (p) => [(p[0] - TX) * k, (p[1] - TY) * k];
  const lm = fr.lm; if (!lm) return;
  const hm = [(lm[23][0] + lm[24][0]) / 2, (lm[23][1] + lm[24][1]) / 2];
  const foot = Math.max(lm[31][1], lm[32][1]);
  ctx.strokeStyle = '#55b883'; ctx.lineWidth = 2; ctx.setLineDash([6, 5]);
  ctx.beginPath(); ctx.moveTo(...T(hm)); ctx.lineTo(...T([hm[0], foot + 6])); ctx.stroke(); ctx.setLineDash([]);
  tag(ctx, `Appui ${c.side}`, 10, 26, S);
  tag(ctx, `Pied ${c.lateral >= 0 ? 'de son côté' : 'croise'} (${fmt(c.lateral)} %)`, 10, S - 20, S, c.lateral < 0 ? '#e0a52c' : '#55b883', '#111');
  if (view === 'dos') tag(ctx, `Bassin ${fmt(c.drop, 1)}°`, 10, S - 20 - (S / 26 + 16), S);
}
