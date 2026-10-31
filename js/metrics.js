// Calcul des métriques à partir des points de pose (coordonnées image, caméra fixe).
// Profil : appuis détectés par immobilité de la pointe du pied dans l'image (indépendant des étiquettes G/D).
// Face / dos : appuis = pied immobile ; côté attribué par la géométrie (le modèle inverse parfois G/D).

const L = { nose: 0, earL: 7, earR: 8, shL: 11, shR: 12, elL: 13, elR: 14, wrL: 15, wrR: 16, hipL: 23, hipR: 24,
  knL: 25, knR: 26, anL: 27, anR: 28, heL: 29, heR: 30, toL: 31, toR: 32 };
const med = (a) => { const b = a.filter((x) => Number.isFinite(x)).sort((x, y) => x - y); return b.length ? (b.length % 2 ? b[b.length >> 1] : (b[b.length / 2 - 1] + b[b.length / 2]) / 2) : NaN; };
const mean = (a) => a.reduce((s, x) => s + x, 0) / a.length;
const deg = (r) => r * 180 / Math.PI;
const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
const norm = (v) => Math.hypot(v[0], v[1]);
const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
function angBetween(u, w) { return deg(Math.acos(Math.max(-1, Math.min(1, (u[0] * w[0] + u[1] * w[1]) / (norm(u) * norm(w)))))); }
const kneeFlex = (h, k, a) => 180 - angBetween(sub(h, k), sub(a, k));
const angUp = (v) => deg(Math.atan2(v[0], -v[1]));   // / verticale vers le haut, + = vers l'avant
const angDown = (v) => deg(Math.atan2(v[0], v[1])); // / verticale vers le bas, + = vers l'avant

// interpolation des images manquantes + lissage Savitzky-Golay (ordre 2)
function prepare(frames, flipX) {
  const n = frames.length, out = new Array(n);
  const ok = frames.map((f) => !!f.lm);
  for (let j = 0; j < 33; j++) for (let c = 0; c < 3; c++) {
    const xs = [], ys = [];
    frames.forEach((f, i) => { if (f.lm) { xs.push(i); ys.push(f.lm[j][c]); } });
    for (let i = 0; i < n; i++) {
      out[i] ??= Array.from({ length: 33 }, () => [0, 0, 0]);
      let k = xs.findIndex((x) => x >= i);
      let val;
      if (k === -1) val = ys[ys.length - 1]; else if (xs[k] === i || k === 0) val = ys[k];
      else { const t = (i - xs[k - 1]) / (xs[k] - xs[k - 1]); val = ys[k - 1] * (1 - t) + ys[k] * t; }
      out[i][j][c] = (c === 0 && flipX) ? -val : val;
    }
  }
  return { raw: out, ok };
}
function savgol(arr, w) {
  // coefficients SG ordre 2 pour fenêtre impaire w
  const m = (w - 1) / 2, c = [];
  const norm2 = (4 * m * m - 1) * (2 * m + 3) / 3;
  for (let i = -m; i <= m; i++) c.push((3 * m * (m + 1) - 1 - 5 * i * i) / norm2);
  const n = arr.length;
  return arr.map((_, t) => {
    if (t < m || t >= n - m) return arr[t];
    let s = 0; for (let i = -m; i <= m; i++) s += c[i + m] * arr[t + i]; return s;
  });
}
function smoothAll(raw, w) {
  const n = raw.length, sm = raw.map((r) => r.map((p) => p.slice()));
  for (let j = 0; j < 33; j++) for (let c = 0; c < 2; c++) {
    const s = savgol(raw.map((r) => r[j][c]), w);
    for (let t = 0; t < n; t++) sm[t][j][c] = s[t];
  }
  return sm;
}
const P = (LM, t, j) => [LM[t][j][0], LM[t][j][1]];

// ajustement sinusoïdal (période du pas) + tendance quadratique → amplitude crête-crête
function sineAmp(y, per0) {
  const n = y.length; let best = null;
  for (let per = per0 * 0.85; per <= per0 * 1.15; per += per0 * 0.0125) {
    const w = 2 * Math.PI / per;
    const X = y.map((_, t) => [1, t, t * t, Math.sin(w * t), Math.cos(w * t)]);
    const c = lstsq(X, y); if (!c) continue;
    let r = 0; for (let t = 0; t < n; t++) { let e = -y[t]; for (let k = 0; k < 5; k++) e += X[t][k] * c[k]; r += e * e; }
    if (!best || r < best.r) best = { r, per, amp: 2 * Math.hypot(c[3], c[4]) };
  }
  return best;
}
function lstsq(X, y) {
  const k = X[0].length, A = Array.from({ length: k }, () => new Array(k + 1).fill(0));
  const sc = X[0].map((_, j) => Math.max(...X.map((r) => Math.abs(r[j]))) || 1);
  for (let t = 0; t < X.length; t++) for (let i = 0; i < k; i++) {
    for (let j = 0; j < k; j++) A[i][j] += X[t][i] / sc[i] * X[t][j] / sc[j];
    A[i][k] += X[t][i] / sc[i] * y[t];
  }
  for (let i = 0; i < k; i++) {
    let p = i; for (let r = i + 1; r < k; r++) if (Math.abs(A[r][i]) > Math.abs(A[p][i])) p = r;
    [A[i], A[p]] = [A[p], A[i]]; if (Math.abs(A[i][i]) < 1e-12) return null;
    for (let r = 0; r < k; r++) if (r !== i) { const f = A[r][i] / A[i][i]; for (let c = i; c <= k; c++) A[r][c] -= f * A[i][c]; }
  }
  return A.map((r, i) => r[k] / r[i] / sc[i]);
}

// ================= PROFIL =================
export function profileMetrics(allFrames, fps, heightM, dir) {
  const flip = dir < 0;
  // on ne garde que la plus longue portion où les pieds sont bien visibles (herbe, bordure, sortie de champ…)
  const vis = allFrames.map((f) => f.lm ? mean(f.lm.slice(27, 33).map((p) => p[2])) : 0);
  let best = [0, -1], s0 = -1, gap = 0;
  for (let i = 0; i <= allFrames.length; i++) {
    const ok = i < allFrames.length && vis[i] >= 0.85;
    if (ok) { if (s0 < 0) s0 = i; gap = 0; if (i - s0 > best[1] - best[0]) best = [s0, i]; }
    else if (s0 >= 0 && ++gap > Math.round(0.05 * fps)) { s0 = -1; gap = 0; }
  }
  const footsOk = best[1] - best[0] + 1 >= 0.7 * fps;
  const frames = footsOk ? allFrames.slice(best[0], best[1] + 1) : allFrames;
  const visibleShare = vis.filter((x) => x >= 0.85).length / allFrames.length;
  const { raw } = prepare(frames, flip);
  const T = raw.length; if (T < fps) return null;
  const w = Math.max(5, (Math.round(0.1 * fps) | 1));
  const LM = smoothAll(raw, w);
  const hip = LM.map((_, t) => mid(P(LM, t, L.hipL), P(LM, t, L.hipR)));
  const sh = LM.map((_, t) => mid(P(LM, t, L.shL), P(LM, t, L.shR)));
  const grad = (a) => a.map((_, t) => (a[Math.min(T - 1, t + 1)] - a[Math.max(0, t - 1)]) / ((t > 0 && t < T - 1) ? 2 : 1));
  const vx = med(grad(hip.map((h) => h[0])));
  if (!(vx > 0.5)) return { error: 'déplacement trop faible' };
  const legs = []; for (let t = 0; t < T; t++) for (const [h, k, a] of [[L.hipL, L.knL, L.anL], [L.hipR, L.knR, L.anR]])
    legs.push(norm(sub(P(LM, t, h), P(LM, t, k))) + norm(sub(P(LM, t, k), P(LM, t, a))));
  const legpx = med(legs), mpp = 0.491 * heightM / legpx;
  const speed = vx * fps * mpp;
  const FP = [L.heL, L.heR, L.toL, L.toR];
  const fx = FP.map((j) => LM.map((r) => r[j][0])), fy = FP.map((j) => LM.map((r) => r[j][1]));
  const dfx = fx.map(grad);
  const lowest = LM.map((_, t) => Math.max(...FP.map((_, i) => fy[i][t])));
  const gw = Math.round(0.25 * fps); // ±0,25 s : plus long qu'un pas, le sol est vu au moins une fois
  const ground = lowest.map((_, t) => { let m = -1e9; for (let u = Math.max(0, t - gw); u <= Math.min(T - 1, t + gw); u++) m = Math.max(m, lowest[u]); return m; });
  const still = FP.map((_, i) => LM.map((_, t) => Math.abs(dfx[i][t]) < 0.5 * vx && fy[i][t] > ground[t] - 0.14 * legpx));
  const footlen = med(LM.flatMap((_, t) => [Math.abs(fx[2][t] - fx[0][t]), Math.abs(fx[3][t] - fx[1][t])]));
  // regroupement des pointes immobiles par emplacement au sol
  const pts = []; for (let t = 0; t < T; t++) for (const i of [2, 3]) if (still[i][t]) pts.push([fx[i][t], t]);
  pts.sort((a, b) => a[0] - b[0]);
  const clusters = [];
  for (const p of pts) { const c = clusters[clusters.length - 1]; if (c && p[0] - c[c.length - 1][0] < 0.25 * footlen + 3) c.push(p); else clusters.push([p]); }
  const edge = Math.round(0.13 * fps);
  let stances = [];
  for (const c of clusters) {
    const ts = [...new Set(c.map((p) => p[1]))].sort((a, b) => a - b);
    if (ts.length < Math.max(3, Math.round(0.06 * fps))) continue;
    const xt = med(c.map((p) => p[0])), t0 = ts[0], to = ts[ts.length - 1];
    let ic = t0;
    for (let t = Math.max(0, t0 - Math.round(0.2 * fps)); t <= to; t++) for (const i of [0, 1])
      if (still[i][t] && fx[i][t] > xt - 1.6 * footlen && fx[i][t] < xt - 0.3 * footlen) ic = Math.min(ic, t);
    if (ic <= edge || to >= T - 2) continue;
    stances.push({ ic, to, xt });
  }
  stances.sort((a, b) => a.ic - b.ic);
  // appuis physiologiquement plausibles seulement (contact entre 120 et 450 ms)
  stances = stances.filter((st) => { const ms = (st.to - st.ic + 1) / fps * 1000; return ms >= 120 && ms <= 450; });
  if (!footsOk) stances = [];
  // un appui ne peut pas commencer avant la fin du précédent moins une marge : on écarte les doublons
  stances = stances.filter((s, i) => i === 0 || s.ic > stances[i - 1].ic + 0.15 * fps);
  const legAt = (t, xc) => { const c = [0, 1].map((s) => Math.abs(LM[t][L.toL + s][0] - xc) + 2 * Math.max(0, ground[t] - LM[t][L.toL + s][1])); return c[0] <= c[1] ? 0 : 1; };
  const ids = (s) => [L.hipL + s, L.knL + s, L.anL + s, L.heL + s, L.toL + s];
  const footAng = (he, to) => deg(Math.atan2(he[1] - to[1], to[0] - he[0]));
  const steps = stances.map((st, k) => {
    const { ic, to, xt } = st; const s = legAt(ic, xt);
    const [h, kn, an, he, toe] = ids(s).map((j) => P(LM, ic, j));
    let prev = an; const kf = [];
    for (let t = ic; t <= ic + Math.floor(0.5 * (to - ic)); t++) {
      const q = norm(sub(P(LM, t, L.anL), prev)) <= norm(sub(P(LM, t, L.anR), prev)) ? 0 : 1;
      prev = P(LM, t, L.anL + q); kf.push(kneeFlex(P(LM, t, L.hipL + q), P(LM, t, L.knL + q), P(LM, t, L.anL + q)));
    }
    const s2 = legAt(to, xt); const ht = P(LM, to, L.hipL + s2), kt = P(LM, to, L.knL + s2);
    const trunk = []; for (let t = ic; t <= to; t++) trunk.push(angUp(sub(sh[t], hip[t])));
    const r = {
      n: k + 1, f_ic: frames[ic].f, f_to: frames[to].f, i_ic: ic, i_to: to,
      contact_ms: (to - ic + 1) / fps * 1000,
      foot_deg: footAng(he, toe), shank_deg: angDown(sub(an, kn)), knee_ic: kneeFlex(h, kn, an), knee_max: Math.max(...kf),
      heel_hip_cm: (he[0] - hip[ic][0]) * mpp * 100, heel_hip_pct: (he[0] - hip[ic][0]) / legpx * 100,
      thigh_to: -angDown(sub(kt, ht)), trunk: mean(trunk),
    };
    if (k > 0) {
      const p = stances[k - 1], sm = (ic - p.ic) / fps * 1000;
      if (sm >= 250 && sm <= 600) { r.step_ms = sm; r.flight_ms = Math.max(0, (ic - p.to - 1) / fps * 1000); }
    }
    return r;
  });
  const stepMs = med(steps.map((s) => s.step_ms));
  // oscillation verticale du bassin (données brutes, ajustement sinusoïdal)
  const yr = raw.map((r) => -((r[L.hipL][1] + r[L.hipR][1]) / 2));
  const perFrames = Number.isFinite(stepMs) ? stepMs / 1000 * fps : 0.36 * fps;
  const fit = sineAmp(yr, perFrames);
  const cadenceFromFit = fit ? 60 * fps / fit.per : NaN;
  const cadence = Number.isFinite(stepMs) ? (60000 / stepMs + (cadenceFromFit || 60000 / stepMs)) / 2 : cadenceFromFit;
  // contrôle d'échelle : la longueur de jambe peut être faussée si les pieds sont masqués ; le tronc sert de garde-fou
  const torso = med(LM.map((_, t) => norm(sub(sh[t], hip[t]))));
  const mppTorso = 0.288 * heightM / torso;
  const scaleWarn = Math.abs(mppTorso / mpp - 1) > 0.2;
  const elbow = [[L.shL, L.elL, L.wrL], [L.shR, L.elR, L.wrR]].map(([a, b, c]) => med(LM.map((_, t) => angBetween(sub(P(LM, t, a), P(LM, t, b)), sub(P(LM, t, c), P(LM, t, b))))));
  const contact = med(steps.map((s) => s.contact_ms));
  const m = (k) => med(steps.map((s) => s[k]));
  const rng = (k) => { const a = steps.map((s) => s[k]).filter(Number.isFinite); return a.length ? [Math.min(...a), Math.max(...a)] : null; };
  return {
    view: 'profil', dir, frames: [frames[0].f, frames[T - 1].f], nSteps: steps.length, steps,
    footsOk, visibleShare, scaleWarn, analysed: [frames[0].f, frames[T - 1].f], total: [allFrames[0].f, allFrames[allFrames.length - 1].f],
    speed, pace: speed > 0 ? 1000 / speed / 60 : NaN, m_per_px: mpp, leg_px: legpx,
    cadence, step_len: speed * 60 / cadence, contact_ms: contact, flight_ms: med(steps.map((s) => s.flight_ms)),
    duty: contact / (2 * (60000 / cadence)) * 100,
    vosc_cm: fit ? fit.amp * mpp * 100 : NaN,
    foot_deg: m('foot_deg'), shank_deg: m('shank_deg'), heel_hip_cm: m('heel_hip_cm'), heel_hip_pct: m('heel_hip_pct'),
    knee_ic: m('knee_ic'), knee_max: m('knee_max'), thigh_to: m('thigh_to'),
    trunk: mean(LM.map((_, t) => angUp(sub(sh[t], hip[t])))), elbow: mean(elbow),
    ranges: Object.fromEntries(['contact_ms', 'foot_deg', 'shank_deg', 'heel_hip_cm', 'knee_ic', 'knee_max', 'thigh_to'].map((k) => [k, rng(k)])),
  };
}

// ================= FACE / DOS =================
export function frontalMetrics(frames, fps, view) {
  const { raw, ok } = prepare(frames, false);
  const T = raw.length; if (T < 0.6 * fps) return null;
  // jambes visibles sur toute la durée de l'appui (genou, cheville, talon, pointe des deux côtés) ;
  // une jambe masquée (voiture, poteau) donne des positions inventées par le modèle
  const legsSeen = (t, u) => {
    for (let i = t; i <= u; i++) if (!ok[i]) return false;
    return [0, 1].every((q) => mean(raw.slice(t, u + 1).flatMap((r) => [L.knL, L.anL, L.heL, L.toL].map((j) => r[j + q][2]))) >= 0.5);
  };
  let masked = 0;
  const LM = smoothAll(raw, Math.max(5, (Math.round(0.1 * fps) | 1)));
  // côté anatomique par la géométrie : de dos, la hanche gauche est à gauche de l'image ; de face, à droite.
  const sideOf = (t) => {
    const lx = LM[t][L.hipL][0], rx = LM[t][L.hipR][0];
    const mpLeftIsImageLeft = lx < rx;
    const wantLeftImageLeft = view === 'dos';
    return mpLeftIsImageLeft === wantLeftImageLeft ? 0 : 1; // 0 : étiquettes correctes, 1 : à inverser
  };
  const hipw = med(LM.map((r) => Math.abs(r[L.hipL][0] - r[L.hipR][0])));
  // inclinaison du bassin dans l'image, + = hanche droite (anatomique) plus basse
  const tilt = LM.map((r, t) => {
    const sw = sideOf(t); const left = sw ? r[L.hipR] : r[L.hipL], right = sw ? r[L.hipL] : r[L.hipR];
    return deg(Math.atan2(right[1] - left[1], Math.abs(right[0] - left[0])));
  });
  const roll = med(tilt); // ≈ inclinaison de la caméra (les chutes G et D se compensent)
  const contacts = [];
  for (const q of [0, 1]) {
    const foot = LM.map((r) => mid([r[L.heL + q][0], r[L.heL + q][1]], [r[L.toL + q][0], r[L.toL + q][1]]));
    const sp = foot.map((p, t) => t ? norm(sub(p, foot[t - 1])) : 0);
    const still = sp.map((v) => v * fps < 4.2 * hipw); // moins de 4,2 largeurs de bassin par seconde (0,07 par image à 60 i/s)
    for (let t = 1; t < T - 1; t++) {
      if (!still[t] || still[t - 1]) continue;
      let u = t; while (u + 1 < T && still[u + 1]) u++;
      if (u - t + 1 >= Math.max(4, Math.round(0.08 * fps)) && u < T - 1 && !legsSeen(t, u)) masked++;
      else if (u - t + 1 >= Math.max(4, Math.round(0.08 * fps)) && u < T - 1) {
        const mt = Math.round((t + u) / 2), r = LM[mt], sw = sideOf(mt);
        const anat = q ^ sw; // 0 = gauche, 1 = droite
        const hm = mid(P(LM, mt, L.hipL), P(LM, mt, L.hipR));
        const leftImg = view === 'dos' ? -1 : 1; // signe de l'image vers lequel se trouve le côté gauche anatomique
        const sideSign = anat === 0 ? leftImg : -leftImg;
        const heel = [r[L.heL + q][0], r[L.heL + q][1]];
        const lateral = (heel[0] - hm[0]) * sideSign / hipw * 100; // % largeur de bassin, + = de son côté, − = croise la ligne
        // chute controlatérale : côté opposé à l'appui plus bas
        const drop = (anat === 0 ? 1 : -1) * (tilt[mt] - roll);
        // genou : déviation vers la ligne médiane par rapport à l'axe hanche-cheville (+ = vers l'intérieur)
        const h = P(LM, mt, L.hipL + q), k = P(LM, mt, L.knL + q), a = P(LM, mt, L.anL + q);
        const tt = (k[1] - h[1]) / ((a[1] - h[1]) || 1), lineX = h[0] + tt * (a[0] - h[0]);
        const kneeIn = (lineX - k[0]) * sideSign / hipw * 100;
        const fppa = (180 - angBetween(sub(h, k), sub(a, k))) * Math.sign(kneeIn); // angle genou dans le plan frontal, + = genou vers l'intérieur
        contacts.push({ side: anat ? 'droite' : 'gauche', f0: frames[t].f, f1: frames[u].f, mt: frames[mt].f, i_mt: mt, lateral, drop, fppa, kneeIn });
      }
      t = u;
    }
  }
  contacts.sort((a, b) => a.f0 - b.f0);
  // contrôle qualité : en course, jamais deux pieds au sol en même temps. Des appuis qui se chevauchent viennent
  // d'une confusion des jambes par le modèle (fréquent de dos). Au-delà d'un tiers (seuil de l'appli), passage non fiable.
  const overlap = (a, b) => Math.min(a.f1, b.f1) - Math.max(a.f0, b.f0) > 0.5 * Math.min(a.f1 - a.f0, b.f1 - b.f0);
  const confused = contacts.filter((a) => contacts.some((b) => b !== a && overlap(a, b))).length;
  const unreliable = contacts.length >= 3 && confused > contacts.length / 3;
  if (unreliable) contacts.length = 0;
  const by = (s, k) => med(contacts.filter((c) => c.side === s).map((c) => c[k]));
  const gap = med(contacts.map((c) => c.lateral));
  // dérive latérale (vue de biais) : déplacement horizontal du bassin rapporté à la croissance de taille
  const hx = LM.map((r) => (r[L.hipL][0] + r[L.hipR][0]) / 2);
  const oblique = Math.abs(hx[T - 1] - hx[0]) / hipw / (T / fps);
  return {
    view, frames: [frames[0].f, frames[T - 1].f], contacts, masked, confused, unreliable, roll, hipw_px: hipw, oblique,
    obliqueWarn: oblique > 1.2,
    drop: { gauche: by('gauche', 'drop'), droite: by('droite', 'drop') },
    lateral: { gauche: by('gauche', 'lateral'), droite: by('droite', 'lateral') },
    fppa: { gauche: by('gauche', 'fppa'), droite: by('droite', 'fppa') },
    crossings: contacts.filter((c) => c.lateral < 0).length, lateralMed: gap,
  };
}
