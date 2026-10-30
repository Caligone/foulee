// Rapport : repères publiés, statut de chaque mesure, recommandations, jauges, images clés et lecteur.

export const REFS = {
  cadence: { label: 'Cadence', unit: 'pas/min', band: [155, 173], sc: [140, 195], rel: 'haute',
    ref: 'Préférée : 164 ± 9 pas/min chez ~900 coureurs loisirs (Malisoux 2023).',
    status: (v) => v < 150 ? 'warn' : 'ok' },
  contact_ms: { label: 'Temps de contact', unit: 'ms', band: [254, 324], sc: [180, 400], rel: 'haute (± 1 image)',
    ref: '289 ± 35 ms à allure préférée, environ −17 ms par km/h de plus (Malisoux 2023).',
    status: (v) => v > 324 ? 'warn' : 'ok' },
  duty: { label: 'Part du temps au sol', unit: '%', band: [35, 43], sc: [25, 55], rel: 'haute',
    ref: 'Duty factor : 39 ± 4 % (Malisoux 2023).', status: (v) => v > 43 ? 'warn' : 'ok' },
  vosc_cm: { label: 'Oscillation verticale (bassin)', unit: 'cm', band: [6.7, 9.3], sc: [3, 15], rel: 'moyenne',
    ref: '8,0 ± 1,3 cm chez les hommes, 7,7 ± 1,2 cm au global (Malisoux 2023).', status: (v) => v > 10 ? 'warn' : 'ok' },
  foot_deg: { label: 'Angle du pied au contact', unit: '°', band: [-1.6, 8], sc: [-15, 40], rel: 'moyenne (± 5°)',
    ref: 'Attaque talon au-delà de 8°, médio-pied entre −1,6 et 8°, avant-pied en dessous (Altman & Davis 2012). Aucun type d\'attaque n\'est « meilleur » en soi.',
    status: (v, m) => (v > 8 && m.shank_deg > 5) ? 'warn' : 'ok', fmtExtra: (v) => v > 8 ? 'talon' : v < -1.6 ? 'avant-pied' : 'médio-pied' },
  shank_deg: { label: 'Inclinaison du tibia au contact', unit: '°', band: [-5, 5], sc: [-10, 25], rel: 'moyenne (± 3 à 5°)',
    ref: 'Grille clinique : idéalement à moins de 5° de la verticale (Barrett 2023) ; au-delà, le pied se pose devant le genou (Souza 2016).',
    status: (v) => v > 10 ? 'bad' : v > 5 ? 'warn' : 'ok' },
  heel_hip_pct: { label: 'Talon devant le bassin au contact', unit: '% jambe', band: null, sc: [-5, 50], rel: 'moyenne',
    ref: 'Pas de norme publiée. Le freinage augmente avec cette distance et une cadence plus élevée la réduit (Lieberman 2015). Seuils indicatifs de l\'appli : 15 % et 25 % de la longueur de jambe.',
    status: (v) => v > 25 ? 'bad' : v > 15 ? 'warn' : 'ok' },
  knee_ic: { label: 'Flexion du genou au contact', unit: '°', band: [5.4, 15], sc: [0, 30], rel: 'moyenne',
    ref: 'Sains : 10,2 ± 4,8°, blessés : 6,0 ± 4,9° (Bramah 2018, 3D, 3,2 m/s).', status: (v) => v < 5 ? 'warn' : 'ok' },
  knee_max: { label: 'Flexion max du genou en appui', unit: '°', band: [40, 50], sc: [20, 75], rel: 'faible (jambes croisées)',
    ref: 'Environ 45° ; moins de 40° est associé à un sous-groupe de douleurs fémoro-patellaires (Souza 2016).', status: (v) => v < 38 ? 'warn' : 'ok' },
  thigh_to: { label: 'Cuisse derrière la verticale au décollage', unit: '°', band: null, sc: [-10, 35], rel: 'moyenne',
    ref: 'Pas de norme publiée en 2D ; reflète l\'amplitude de poussée.', status: (v) => v < 8 ? 'warn' : 'ok' },
  trunk: { label: 'Inclinaison du buste', unit: '°', band: [3.7, 10.9], sc: [-15, 20], rel: 'faible à moyenne',
    ref: 'Spontanée : 7,3 ± 3,6° vers l\'avant (Teng & Powers 2014, 3,4 m/s). Un buste plus droit augmente la contrainte fémoro-patellaire.',
    status: (v) => (v < 2 || v > 14) ? 'warn' : 'ok' },
  elbow: { label: 'Angle des coudes', unit: '°', band: null, sc: [40, 150], rel: 'moyenne',
    ref: 'Pas de norme. Le balancier des bras réduit le coût énergétique (Arellano & Kram 2014).', status: () => 'ok' },
};
export const PROFILE_KEYS = [
  ['Rythme et appuis', ['cadence', 'contact_ms', 'duty', 'vosc_cm']],
  ['Attaque du pied', ['foot_deg', 'shank_deg', 'heel_hip_pct', 'knee_ic']],
  ['Appui et poussée', ['knee_max', 'thigh_to']],
  ['Posture', ['trunk', 'elbow']],
];
export const STATUS = { ok: ['c-ok', 'Dans la norme'], warn: ['c-warn', 'À surveiller'], bad: ['c-bad', 'À travailler'], na: ['c-na', 'Non mesuré'] };
export const fmt = (x, d = 0) => Number.isFinite(x) ? x.toFixed(d).replace('.', ',').replace('-', '−') : '—';
export const pace = (p) => Number.isFinite(p) ? `${Math.floor(p)}:${String(Math.round((p % 1) * 60)).padStart(2, '0')}` : '—';
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
  const worst = (k) => prof.reduce((m, p) => Math.max(m, p.metrics[k] ?? -1e9), -1e9);
  const cards = [], plan = [];
  if (prof.length) {
    const sh = worst('shank_deg'), hh = worst('heel_hip_pct');
    if (sh > 5 || hh > 15) {
      cards.push({ st: sh > 10 || hh > 25 ? 'bad' : 'warn', href: '#m-shank_deg', t: 'Le pied se pose devant le bassin',
        d: `Tibia incliné jusqu'à ${fmt(sh)}° vers l'avant au contact et talon jusqu'à ${fmt(hh)} % de la longueur de jambe devant le bassin. C'est le signe d'une foulée qui freine (overstriding).` });
      const cad = slow?.cadence ?? prof[0].metrics.cadence;
      plan.push({ t: `Monter la cadence de 5 à 7 % en footing (≈ ${fmt(cad * 1.05)} à ${fmt(cad * 1.07)} pas/min)`,
        li: ['Métronome de la montre ou musique à ce tempo, par blocs de 2 min, puis sur toute la sortie.', 'Même allure : le pas raccourcit de lui-même et le pied revient sous le bassin.'],
        why: '+5 % de cadence réduit d\'environ 20 % l\'énergie absorbée par le genou (Heiderscheit 2011) et rapproche le pied du bassin au contact (Lieberman 2015).' });
    }
    const tr = Math.min(...prof.map((p) => p.metrics.trunk));
    if (tr < 2) {
      cards.push({ st: 'warn', href: '#m-trunk', t: 'Buste très droit', d: `Inclinaison mesurée jusqu'à ${fmt(tr)}° (l'inclinaison habituelle est d'environ 7° vers l'avant). Combiné au pied posé devant, cela favorise le freinage.` });
      plan.push({ t: 'Courir « grand et légèrement penché »', li: ['Légère inclinaison vers l\'avant venue des chevilles, pas de la taille.', 'Surtout aux allures lentes ; viser 5 à 10° sur la prochaine vidéo.'],
        why: 'Un buste plus incliné diminue la contrainte fémoro-patellaire ; un buste plus droit l\'augmente (Teng & Powers 2014). Contrepartie : plus de travail des extenseurs de hanche.' });
    }
    const vo = Math.max(...prof.map((p) => p.metrics.vosc_cm));
    if (vo > 10) cards.push({ st: 'warn', href: '#m-vosc_cm', t: 'Rebond vertical élevé', d: `Oscillation du bassin jusqu'à ${fmt(vo, 1)} cm (repère : 8 ± 1,3 cm).` });
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
    const m = prof[0].metrics;
    if (m.vosc_cm <= 10) good.push('rebond vertical');
    if (prof.every((p) => p.metrics.knee_ic >= 5)) good.push('flexion du genou au contact');
    if (prof.every((p) => p.metrics.cadence >= 155)) good.push('cadence');
    if (good.length) cards.push({ st: 'ok', t: 'Points forts', d: `Dans les repères : ${good.join(', ')}.` });
  }
  if (!fr.some((p) => p.kind === 'dos')) cards.push({ st: 'na', t: 'Vue de dos manquante', d: 'La chute du bassin et l\'alignement du genou se mesurent de dos, caméra dans l\'axe de course.' });
  return { cards, plan };
}

// ---------- Jauges ----------
const pos = (x, sc) => Math.max(0, Math.min(100, (x - sc[0]) / (sc[1] - sc[0]) * 100));
export function gaugesHTML(prof) {
  const col = ['var(--accent)', 'var(--left)', 'var(--right)', 'var(--fg)'];
  let h = `<div class="keyrow">${prof.map((p, i) => `<span><span class="mk" style="background:${col[i % 4]}"></span>Passage ${i + 1} · ${pace(p.metrics.pace)}/km</span>`).join('')}<span><span class="bandkey"></span>repère publié</span></div>`;
  for (const [g, keys] of PROFILE_KEYS) {
    h += `<h3 class="grp">${g}</h3>`;
    for (const k of keys) {
      const R = REFS[k]; const vals = prof.map((p) => p.metrics[k]);
      const sts = prof.map((p) => R.status(p.metrics[k], p.metrics));
      const st = sts.includes('bad') ? 'bad' : sts.includes('warn') ? 'warn' : 'ok';
      const d = DEC[k] ?? 0;
      const extra = R.fmtExtra ? ` (${prof.map((p) => R.fmtExtra(p.metrics[k])).join(' · ')})` : '';
      const rk = { heel_hip_pct: 'heel_hip_cm' }[k] ?? k;
      const ranges = prof.map((p) => p.metrics.ranges?.[rk]).filter(Boolean);
      const cm = k === 'heel_hip_pct' ? ` <span>soit ${prof.map((p) => fmt(p.metrics.heel_hip_cm)).join(' · ')} cm</span>` : '';
      // une ligne par mesure ; le détail (repère, fiabilité, appuis) ne s'ouvre d'office que pour ce qui sort de la norme
      h += `<details class="metric" id="m-${k}"${st !== 'ok' ? ' open' : ''}><summary>
        <div class="name"><h4>${R.label} <span class="chip ${STATUS[st][0]}">${STATUS[st][1]}</span></h4>
        <div class="vals">${vals.map((v) => fmt(v, d)).join(' · ')} ${R.unit}${extra}${cm}</div></div>
        <div class="gauge" role="img" aria-label="${R.label}"><div class="track"></div>
        ${R.band ? `<div class="bandz" style="left:${pos(R.band[0], R.sc)}%;width:${pos(R.band[1], R.sc) - pos(R.band[0], R.sc)}%"></div>` : ''}
        ${vals.map((v, i) => Number.isFinite(v) ? `<div class="dot" style="left:${pos(v, R.sc)}%;background:${col[i % 4]}"></div>` : '').join('')}
        <div class="ticks"><span>${fmt(R.sc[0])}</span><span>${fmt(R.sc[1])} ${R.unit}</span></div></div></summary>
        <div class="more"><p class="ref">${R.ref}</p>
        <p class="rel">Fiabilité ${R.rel}${ranges.length && k !== 'heel_hip_pct' ? ` · appuis : ${ranges.map((r) => `${fmt(r[0])}–${fmt(r[1])}`).join(' · ')}` : ''}</p></div></details>`;
    }
  }
  return h;
}

// ---------- Dessin : squelette, images clés ----------
const EDGES = [[11, 12], [11, 23], [12, 24], [23, 24], [11, 13], [13, 15], [12, 14], [14, 16], [23, 25], [25, 27], [27, 29], [29, 31], [27, 31], [24, 26], [26, 28], [28, 30], [30, 32], [28, 32]];
const LEFT = new Set([11, 13, 15, 23, 25, 27, 29, 31]), RIGHT = new Set([12, 14, 16, 24, 26, 28, 30, 32]);
export function css(name) { return getComputedStyle(document.documentElement).getPropertyValue(name).trim(); }
export async function drawFrame(ctx, fr, S, opts = {}) {
  const img = await createImageBitmap(fr.thumb);
  ctx.drawImage(img, 0, 0, S, S); img.close?.();
  if (!fr.lm) return;
  const [TX, TY, ts] = fr.view, k = S / ts;
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
