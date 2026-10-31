// Dessin sur canvas : squelette, images clés, photo « toi / repère » d'une mesure.
import { REPERES, bande } from '../domaine/reperes.js';
import { fmt } from '../format.js';

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
  const S = canvas.width, ctx = canvas.getContext('2d'), R = REPERES[k], band = R.nature === 'aucun' ? null : bande(R);
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
    ctx.fillStyle = 'rgba(85,184,131,.45)'; ctx.fillRect(Math.min(hp[0], hp[0] + dir * R.seuil / 100 * leg), gy - 7, R.seuil / 100 * leg, 14);
    ctx.strokeStyle = green; ctx.lineWidth = 3; ctx.setLineDash([8, 6]); ctx.beginPath(); ctx.moveTo(...hp); ctx.lineTo(hp[0], gy); ctx.stroke(); ctx.setLineDash([]);
    ctx.strokeStyle = col; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(hp[0], gy); ctx.lineTo(he[0], gy); ctx.stroke();
    for (const p of [hp, he]) { ctx.fillStyle = col; ctx.beginPath(); ctx.arc(...p, 7, 0, 7); ctx.fill(); }
  } else {
    const G = { shank_deg: [kn, an, [0, 1], -dir], foot_deg: [he, to, [dir, 0], -dir], knee_ic: [kn, an, unit(hp, kn), dir], trunk: [hp, sh, [0, -1], dir] }[k];
    const [A, B, z, s] = G, L = dist(A, B) * 1.15;
    if (band) {
      const a0 = Math.atan2(...rot(z, s * band[0]).reverse()), a1 = Math.atan2(...rot(z, s * band[1]).reverse());
      ctx.fillStyle = 'rgba(85,184,131,.45)'; ctx.strokeStyle = green; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(...A); ctx.arc(...A, L, a0, a1, ((a1 - a0 + 2 * Math.PI) % (2 * Math.PI)) > Math.PI); ctx.closePath(); ctx.fill(); ctx.stroke();
    }
    ctx.strokeStyle = col; ctx.lineWidth = 7; ctx.beginPath(); ctx.moveTo(...A); ctx.lineTo(...B); ctx.stroke();
    ctx.fillStyle = col; ctx.beginPath(); ctx.arc(...A, 7, 0, 7); ctx.fill();
  }
  const lab = k === 'heel_hip_pct' ? `Toi : talon ${fmt(v)} % de jambe devant` : `Toi : ${fmt(v)}°`;
  const cib = R.nature === 'indicatif' ? `Seuil indicatif : moins de ${fmt(R.seuil)} %` : band ? `Repère : ${fmt(band[0], 1).replace(',0', '')} à ${fmt(band[1], 1).replace(',0', '')}°` : '';
  tag(ctx, lab, 10, 26, S, col, '#111');
  if (cib) tag(ctx, cib, 10, 26 + S / 26 + 16, S, green, '#111');
}
