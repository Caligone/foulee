// Moteur d'analyse : lecture image par image, fond médian, détection du coureur, estimation de pose.
// Tout tourne dans le navigateur : la vidéo ne quitte jamais la machine.

const CDN_VERSION = '0.10.14';
const CDN_BASE = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${CDN_VERSION}`;
const MODEL_REMOTE = {
  full: 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task',
  heavy: 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_heavy/float16/1/pose_landmarker_heavy.task',
};
const V = (p) => new URL('../vendor/' + p, import.meta.url).href;
const MODEL_LOCAL = { full: V('models/pose_landmarker_full.task'), heavy: V('models/pose_landmarker_heavy.task') };

async function exists(url) {
  try { const r = await fetch(url, { method: 'HEAD' }); return r.ok; } catch { return false; }
}

export async function loadPose(variant = 'heavy', overrideModel = null, onStatus = () => {}) {
  let vision;
  onStatus('Chargement de MediaPipe…');
  const localBundle = await exists(V('vision_bundle.mjs'));
  vision = await import(localBundle ? V('vision_bundle.mjs') : `${CDN_BASE}/vision_bundle.mjs`);
  const wasmBase = (await exists(V('wasm/vision_wasm_internal.wasm'))) ? V('wasm') : `${CDN_BASE}/wasm`;
  const fileset = await vision.FilesetResolver.forVisionTasks(wasmBase);
  let modelPath = overrideModel;
  if (!modelPath) modelPath = (await exists(MODEL_LOCAL[variant])) ? MODEL_LOCAL[variant] : MODEL_REMOTE[variant];
  onStatus(`Chargement du modèle de pose (${variant})…`);
  let lm, delegate = 'GPU';
  try {
    lm = await vision.PoseLandmarker.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: modelPath, delegate: 'GPU' }, runningMode: 'IMAGE', numPoses: 1,
      minPoseDetectionConfidence: 0.3, minPosePresenceConfidence: 0.3,
    });
  } catch (e) {
    delegate = 'CPU';
    lm = await vision.PoseLandmarker.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: modelPath, delegate: 'CPU' }, runningMode: 'IMAGE', numPoses: 1,
      minPoseDetectionConfidence: 0.3, minPosePresenceConfidence: 0.3,
    });
  }
  return { landmarker: lm, delegate, modelPath };
}

// ---------- Vidéo ----------
export async function openVideo(file) {
  const v = document.createElement('video');
  v.muted = true; v.playsInline = true; v.preload = 'auto';
  v.src = URL.createObjectURL(file);
  await new Promise((res, rej) => {
    v.onloadedmetadata = res;
    v.onerror = () => rej(new Error("Le navigateur ne sait pas décoder cette vidéo. Les .MOV d'iPhone (HEVC) se lisent dans Safari et dans Chrome sur Mac. Sinon, convertis-la en MP4 H.264."));
  });
  if (!v.videoWidth) throw new Error("Vidéo illisible (aucune image décodée). Essaie Safari, ou convertis-la en MP4 H.264.");
  await seek(v, Math.min(0.05, v.duration / 2));
  return v;
}

export function seek(v, t) {
  return new Promise((res) => {
    const done = () => { v.removeEventListener('seeked', done); res(); };
    v.addEventListener('seeked', done);
    v.currentTime = t;
  });
}

const STD_FPS = [23.976, 24, 25, 29.97, 30, 47.95, 48, 50, 59.94, 60, 100, 119.88, 120, 239.76, 240];
export async function estimateFps(v) {
  if (!('requestVideoFrameCallback' in HTMLVideoElement.prototype)) return null;
  const times = [];
  await seek(v, 0);
  await new Promise((res) => {
    let n = 0;
    const cb = (_, meta) => { times.push(meta.mediaTime); if (++n < 40 && !v.ended) v.requestVideoFrameCallback(cb); else res(); };
    v.requestVideoFrameCallback(cb);
    v.playbackRate = 1; v.play().catch(res);
    setTimeout(res, 2500);
  });
  v.pause();
  // le premier écart (juste après le saut) est souvent tronqué
  let d = []; for (let i = 2; i < times.length; i++) { const x = times[i] - times[i - 1]; if (x > 0.001) d.push(x); }
  if (d.length < 5) return null;
  d.sort((a, b) => a - b);
  d = d.filter((x) => x > 0.3 * d[d.length >> 1]);
  // Firefox n'appelle pas le rappel à chaque image : les écarts valent 1, 2, 3… périodes.
  // Le plus petit sert de base, puis chaque écart est ramené à une période (médiane).
  const ps = d.map((x) => x / Math.round(x / d[0])).sort((a, b) => a - b);
  const fps = 1 / ps[ps.length >> 1];
  return STD_FPS.reduce((b, s) => Math.abs(s - fps) < Math.abs(b - fps) ? s : b, STD_FPS[0]);
}

// ---------- Fond médian + détection du coureur (basse résolution) ----------
const LW = 320; // largeur de travail pour la détection de mouvement

export async function scanVideo(v, fps, onProgress, source) {
  const W = v.videoWidth, H = v.videoHeight, LH = Math.round(H * LW / W);
  const cv = new OffscreenCanvas(LW, LH), cx = cv.getContext('2d', { willReadFrequently: true });
  const step = 0.1;
  const frames = [], times = [];
  const grab = (t, src = v) => { cx.drawImage(src, 0, 0, LW, LH); frames.push(cx.getImageData(0, 0, LW, LH).data.slice()); times.push(t); };
  if (source?.kind === 'webcodecs') {
    // décodage de toutes les images, une prélevée toutes les 0,1 s : même résultat à chaque lancement
    for await (const { t, src } of source.frames(0, v.duration, step)) { grab(t, src); onProgress?.(t / v.duration); }
  } else if ('requestVideoFrameCallback' in HTMLVideoElement.prototype) {
    // lecture accélérée : on prélève une image tous les 0,1 s de temps vidéo (bien plus rapide que des sauts)
    await seek(v, 0);
    await new Promise((res) => {
      let next = 0;
      const cb = (_, meta) => {
        if (meta.mediaTime >= next) { grab(meta.mediaTime); next = meta.mediaTime + step; onProgress?.(meta.mediaTime / v.duration); }
        if (v.ended || v.currentTime >= v.duration - 0.02) return res();
        v.requestVideoFrameCallback(cb);
      };
      v.requestVideoFrameCallback(cb);
      v.onended = () => res();
      v.playbackRate = 4;
      v.play().catch(() => res());
    });
    v.pause(); v.playbackRate = 1; v.onended = null;
  }
  if (frames.length < v.duration / step * 0.6) {
    // repli : sauts image par image
    frames.length = 0; times.length = 0;
    const N = Math.floor(v.duration / step);
    for (let i = 0; i < N; i++) { await seek(v, i * step + 0.5 / fps); grab(i * step); onProgress?.(i / N); }
  }
  // fond = médiane par pixel sur ~45 images réparties
  const pick = []; const K = Math.min(45, frames.length);
  for (let k = 0; k < K; k++) pick.push(frames[Math.floor(k * frames.length / K)]);
  const bg = new Uint8ClampedArray(LW * LH * 4); const tmp = new Uint8Array(K);
  for (let p = 0; p < LW * LH * 4; p++) {
    if ((p & 3) === 3) { bg[p] = 255; continue; }
    for (let k = 0; k < K; k++) tmp[k] = pick[k][p];
    tmp.sort(); bg[p] = tmp[K >> 1];
  }
  // masque de premier plan par image, puis zones « toujours en mouvement » (feuillage, reflets) exclues
  const masks = frames.map((f) => fgMask(f, bg, LW, LH));
  const freq = new Float32Array(LW * LH);
  for (const m of masks) for (let i = 0; i < m.length; i++) freq[i] += m[i];
  for (let i = 0; i < freq.length; i++) freq[i] /= masks.length;
  const clutter = new Uint8Array(LW * LH);
  for (let i = 0; i < freq.length; i++) clutter[i] = freq[i] > 0.12 ? 1 : 0;
  const cands = masks.map((m) => blobs(m, clutter, LW, LH));
  // suivi : on garde le candidat cohérent avec la position précédente, sinon le plus gros
  const boxes = []; let prev = null;
  for (let i = 0; i < frames.length; i++) {
    const c = cands[i]; let pick = null;
    if (c.length) {
      if (prev && times[i] - prev.t < 0.6) {
        const h = prev.y1 - prev.y0;
        const near = c.filter((b) => Math.abs(b.cx - prev.cx) < 1.6 * h + 4 && Math.abs((b.y1) - prev.y1) < 0.8 * h + 4);
        pick = near.sort((a, b) => b.n - a.n)[0] || null;
      }
      if (!pick) pick = c.slice().sort((a, b) => b.n - a.n)[0];
    }
    const box = pick ? { t: times[i], ok: true, ...pick } : { t: times[i], ok: false };
    boxes.push(box); if (pick) prev = box;
  }
  const scale = W / LW;
  for (const b of boxes) if (b.ok) { b.x0 *= scale; b.x1 *= scale; b.y0 *= scale; b.y1 *= scale; b.cx *= scale; }
  return { boxes, bg, freq, cands, times, LW, LH, W, H };
}

function fgMask(f, bg, W, H) {
  const m = new Uint8Array(W * H);
  for (let i = 0, p = 0; i < W * H; i++, p += 4) {
    const d = Math.max(Math.abs(f[p] - bg[p]), Math.abs(f[p + 1] - bg[p + 1]), Math.abs(f[p + 2] - bg[p + 2]));
    m[i] = d > 32 ? 1 : 0;
  }
  return m;
}

function blobs(m, clutter, W, H) {
  // nettoyage du bruit isolé, retrait des zones agitées, dilatation (un haut sombre devant une haie coupe le corps en morceaux)
  let e = new Uint8Array(W * H);
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
    const i = y * W + x; if (!m[i] || clutter[i]) continue;
    let s = 0; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) s += m[i + dy * W + dx];
    e[i] = s >= 4 ? 1 : 0;
  }
  const core = e.slice();
  for (let pass = 0; pass < 3; pass++) {
    const d2 = new Uint8Array(W * H);
    for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
      const i = y * W + x; d2[i] = e[i] | e[i - 1] | e[i + 1] | e[i - W] | e[i + W];
    }
    e = d2;
  }
  const lab = new Int32Array(W * H); const q = new Int32Array(W * H); const out = []; let id = 0;
  for (let s0 = 0; s0 < W * H; s0++) {
    if (!e[s0] || lab[s0]) continue;
    id++; let h = 0, t = 0; q[t++] = s0; lab[s0] = id;
    let n = 0, x0 = W, x1 = 0, y0 = H, y1 = 0, sx = 0;
    while (h < t) {
      const i = q[h++]; const x = i % W, y = (i / W) | 0;
      if (core[i]) { n++; sx += x; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
      for (const j of [i - 1, i + 1, i - W, i + W]) if (j >= 0 && j < W * H && e[j] && !lab[j]) { lab[j] = id; q[t++] = j; }
    }
    if (n < 6) continue;
    out.push({ n, x0, x1, y0, y1, sx });
  }
  // regroupe les morceaux d'un même corps (tête / jambes séparées par un haut sombre devant un fond sombre)
  let merged = true;
  while (merged) {
    merged = false;
    for (let a = 0; a < out.length && !merged; a++) for (let b = a + 1; b < out.length && !merged; b++) {
      const A = out[a], B = out[b];
      const hx = Math.max(A.y1 - A.y0, B.y1 - B.y0, 6);
      const xOverlap = Math.min(A.x1, B.x1) - Math.max(A.x0, B.x0) > -0.25 * hx;
      const yGap = Math.max(A.y0, B.y0) - Math.min(A.y1, B.y1);
      if (xOverlap && yGap < 0.9 * hx) {
        out[a] = { n: A.n + B.n, x0: Math.min(A.x0, B.x0), x1: Math.max(A.x1, B.x1), y0: Math.min(A.y0, B.y0), y1: Math.max(A.y1, B.y1), sx: A.sx + B.sx };
        out.splice(b, 1); merged = true;
      }
    }
  }
  const res = [];
  for (const o of out) {
    const hgt = o.y1 - o.y0 + 1, wid = o.x1 - o.x0 + 1;
    if (o.n < 18 || wid > 1.4 * hgt || hgt < H * 0.08) continue; // voiture, ombre, bruit : un coureur est plus haut que large
    res.push({ n: o.n, x0: o.x0, x1: o.x1, y0: o.y0, y1: o.y1, cx: o.sx / o.n });
  }
  return res;
}

// ---------- Découpage en passages ----------
export function findPassages(boxes, minDur = 1.0) {
  const segs = []; let cur = null;
  let gapStart = null;
  for (const b of boxes) {
    if (b.ok) {
      const last = cur && cur[cur.length - 1];
      if (last && Math.abs(b.cx - last.cx) > 2 * (last.y1 - last.y0)) { segs.push(cur); cur = null; }
      if (!cur) cur = []; cur.push(b); gapStart = null;
    } else if (cur) {
      // tolère de courtes pertes (coureur devant un fond de même couleur)
      gapStart ??= b.t;
      if (b.t - gapStart > 0.8) { segs.push(cur); cur = null; gapStart = null; }
    }
  }
  if (cur) segs.push(cur);
  const out = [];
  for (const s of segs) {
    // fenêtres d'1 s classées : profil (déplacement latéral) / face (grandit) / dos (rapetisse)
    const win = [];
    for (let i = 0; i + 4 < s.length; i += 5) {
      const j = Math.min(i + 9, s.length - 1), a = s[i], b = s[j];
      // taille apparente robuste (90e centile : le haut du corps disparaît parfois devant un fond sombre)
      const hs = (k0, k1) => { const hh = []; for (let k = k0; k <= k1; k++) hh.push(s[k].y1 - s[k].y0); hh.sort((x, y) => x - y); return hh[Math.min(hh.length - 1, Math.floor(hh.length * 0.9))]; };
      const ys = (k0, k1) => { const hh = []; for (let k = k0; k <= k1; k++) hh.push(s[k].y1); hh.sort((x, y) => x - y); return hh[hh.length >> 1]; };
      const half = Math.max(i, Math.floor((i + j) / 2));
      const ha = hs(i, half), hb = hs(Math.min(j, half + 1), j);
      const h = Math.max(ha, hb), dt = b.t - a.t || 0.1;
      const lat = (b.cx - a.cx) / h / dt;                       // hauteurs de corps par seconde
      const grow = Math.log(hb / ha) / dt;                      // croissance de la taille apparente
      const dy = (ys(Math.min(j, half + 1), j) - ys(i, half)) / h / dt; // les pieds descendent dans l'image quand on s'approche
      // de face/de dos : la taille apparente change nettement plus vite que le déplacement latéral
      const kind = (grow > 0.12 && Math.abs(lat) < 1.0) ? 'face'
        : (grow < -0.12 && Math.abs(lat) < 1.0) ? 'dos'
        : Math.abs(lat) > 0.9 ? 'profil' : 'indéterminé';
      win.push({ t0: a.t, t1: Math.min(a.t + 0.5, s[s.length - 1].t), kind, dir: Math.sign(lat) });
    }
    let g = null;
    for (const w of win) {
      if (g && g.kind === w.kind && (w.kind !== 'profil' || g.dir === w.dir)) g.t1 = w.t1;
      else { if (g) out.push(g); g = { ...w }; }
    }
    if (g) out.push(g);
  }
  // fusion des morceaux d'un même passage séparés par une courte perte de détection
  const merged = [];
  for (const p of out.filter((q) => q.kind !== 'indéterminé')) {
    const m = merged[merged.length - 1];
    if (m && m.kind === p.kind && (p.kind !== 'profil' || m.dir === p.dir) && p.t0 - m.t1 < 1.6) m.t1 = p.t1;
    else merged.push({ ...p });
  }
  return merged.filter((p) => p.t1 - p.t0 >= minDur - 0.01);
}

// ---------- Pose image par image sur un passage ----------
export async function poseOnPassage(v, pose, passage, scan, fps, onFrame, source) {
  const W = v.videoWidth, H = v.videoHeight;
  const IN = 512;
  const crop = new OffscreenCanvas(IN, IN), cc = crop.getContext('2d');
  const thumb = new OffscreenCanvas(384, 384), tc = thumb.getContext('2d');
  // Firefox décale les sous-zones prises directement sur une vidéo décodée par le GPU :
  // on copie l'image entière, puis on recadre depuis cette copie
  const full = new OffscreenCanvas(W, H), fc = full.getContext('2d');
  const n = Math.max(1, Math.round((passage.t1 - passage.t0) * fps));
  const boxAt = (t) => {
    let best = null;
    for (const b of scan.boxes) if (b.ok && (!best || Math.abs(b.t - t) < Math.abs(best.t - t))) best = b;
    return best;
  };
  let track = null; const frames = [];
  for await (const { f, t, src } of source.frames(passage.t0, passage.t1)) {
    fc.drawImage(src, 0, 0);
    const b = boxAt(t);
    let cx, cy, side;
    const bh = b ? (b.y1 - b.y0) : H / 4;
    if (track) {
      // suivi par la pose précédente, rappelé vers la boîte de mouvement si elle diverge
      cx = track.cx; cy = track.cy; side = track.side;
      if (b && Math.abs(b.cx - cx) > 0.6 * side) { cx = b.cx; cy = (b.y0 + b.y1) / 2; side = 1.6 * bh; }
    } else { cx = b ? b.cx : W / 2; cy = b ? (b.y0 + b.y1) / 2 : H / 2; side = 1.6 * bh; }
    side = Math.max(160, Math.min(side, H));
    const X0 = Math.max(0, Math.min(W - side, cx - side / 2)), Y0 = Math.max(0, Math.min(H - side, cy - side / 2));
    cc.drawImage(full, X0, Y0, side, side, 0, 0, IN, IN);
    const r = pose.detect(crop);
    let lm = null;
    if (r.landmarks && r.landmarks[0]) {
      lm = r.landmarks[0].map((p) => [X0 + p.x * side, Y0 + p.y * side, p.visibility ?? 1]);
      let xmin = 1e9, xmax = -1e9, ymin = 1e9, ymax = -1e9;
      for (const p of lm) { xmin = Math.min(xmin, p[0]); xmax = Math.max(xmax, p[0]); ymin = Math.min(ymin, p[1]); ymax = Math.max(ymax, p[1]); }
      const ncx = (xmin + xmax) / 2, ncy = (ymin + ymax) / 2, nside = 1.5 * (ymax - ymin + 0.04 * H);
      track = track ? { cx: 0.5 * track.cx + 0.5 * ncx, cy: 0.6 * track.cy + 0.4 * ncy, side: 0.7 * track.side + 0.3 * nside }
                    : { cx: ncx, cy: ncy, side: nside };
    }
    // vignette pour le lecteur (centrée sur le coureur)
    const ts = Math.min(H, Math.max(200, (track?.side ?? side) * 1.05));
    const TX = Math.max(0, Math.min(W - ts, (track?.cx ?? cx) - ts / 2)), TY = Math.max(0, Math.min(H - ts, (track?.cy ?? cy) - ts / 2));
    tc.drawImage(full, TX, TY, ts, ts, 0, 0, 384, 384);
    const blobImg = await thumb.convertToBlob({ type: 'image/jpeg', quality: 0.78 });
    frames.push({ f, lm, thumb: blobImg, view: [TX, TY, ts] });
    onFrame?.(frames.length / n, crop, lm, X0, Y0, side);
  }
  return frames;
}
