// Accès aux images d'une vidéo, dans l'ordre et avec leur horodatage réel.
// Voie principale : WebCodecs (chaque image décodée exactement une fois, rapide, résultat reproductible).
// Voie de secours : sauts dans l'élément <video>, quand le navigateur ne décode pas le codec en WebCodecs
// (Firefox et le HEVC des iPhone). Plus lente et moins exacte : le saut tombe parfois sur l'image voisine.

import { seek, estimateFps } from './engine.js';

const MP4BOX_CDN = 'https://cdn.jsdelivr.net/npm/mp4box@2.4.1/dist/mp4box.all.mjs';
const MP4BOX_LOCAL = new URL('../vendor/mp4box/mp4box.all.mjs', import.meta.url).href;

// source = { kind, fps, frames(t0, t1, every) } ; frames() rend des { f, t, src } dans l'ordre,
// src (VideoFrame ou <video>) n'est valable que jusqu'à l'image suivante.
export async function openFrames(file, v) {
  try {
    const wc = await webcodecsSource(file);
    if (wc) return wc;
  } catch (e) { console.warn('WebCodecs indisponible, repli sur les sauts', e); }
  return seekSource(v);
}

async function loadMp4Box() {
  const local = await fetch(MP4BOX_LOCAL, { method: 'HEAD' }).then((r) => r.ok, () => false);
  return import(local ? MP4BOX_LOCAL : MP4BOX_CDN);
}

async function webcodecsSource(file) {
  if (!('VideoDecoder' in window)) return null;
  const MP4Box = await loadMp4Box();
  MP4Box.Log.setLogLevel?.(MP4Box.Log.error);
  // lecture de l'index (moov) par morceaux : mp4box indique où reprendre et saute les données (mdat)
  const mp4 = MP4Box.createFile();
  let info = null, pos = 0;
  mp4.onReady = (i) => { info = i; };
  while (!info && pos < file.size) {
    const end = Math.min(file.size, pos + (1 << 20));
    const buf = MP4Box.MP4BoxBuffer.fromArrayBuffer(await file.slice(pos, end).arrayBuffer(), pos);
    pos = mp4.appendBuffer(buf, end >= file.size) ?? end;
  }
  const tr = info?.videoTracks[0];
  if (!tr) return null;
  const entry = mp4.getTrackById(tr.id).mdia.minf.stbl.stsd.entries[0];
  const box = entry.hvcC || entry.avcC || entry.vpcC || entry.av1C;
  let description;
  if (box) {
    const ds = new MP4Box.DataStream(undefined, 0, MP4Box.Endianness.BIG_ENDIAN);
    box.write(ds); description = new Uint8Array(ds.buffer, 8); // sans l'en-tête de boîte
  }
  const config = { codec: tr.codec, codedWidth: tr.video.width, codedHeight: tr.video.height, description };
  if (!(await VideoDecoder.isConfigSupported(config)).supported) return null;

  // échantillons en ordre de décodage ; numéro d'image = rang dans l'ordre d'affichage
  const samples = mp4.getTrackSamplesInfo(tr.id).map((s) => ({ offset: s.offset, size: s.size, sync: s.is_sync, t: s.cts / s.timescale, dur: s.duration / s.timescale }));
  const byTime = samples.map((s) => s.t).sort((a, b) => a - b);
  const rank = new Map(byTime.map((t, i) => [Math.round(t * 1e6), i]));
  const fps = samples.length / (tr.duration / tr.timescale);
  // l'iPhone note l'orientation dans la matrice de la piste ; <video> l'applique, WebCodecs non
  const m = tr.matrix ?? [65536, 0];
  const rot = (Math.round(Math.atan2(m[1], m[0]) * 180 / Math.PI) + 360) % 360;
  const W = tr.video.width, H = tr.video.height;
  const upright = rot ? new OffscreenCanvas(rot % 180 ? H : W, rot % 180 ? W : H) : null;
  const uc = upright?.getContext('2d');
  const orient = (fr) => {
    if (!rot) return fr;
    uc.setTransform(1, 0, 0, 1, upright.width / 2, upright.height / 2); uc.rotate(rot * Math.PI / 180);
    uc.drawImage(fr, -W / 2, -H / 2);
    return upright;
  };

  async function* frames(t0, t1, every = 0) {
    // on part de la dernière image clé avant t0 (les images suivantes en dépendent)
    let k0 = 0;
    for (let k = 0; k < samples.length; k++) if (samples[k].sync && samples[k].t <= t0) k0 = k;
    const ready = []; let wake = null, failure = null;
    const dec = new VideoDecoder({
      output: (fr) => { ready.push(fr); wake?.(); },
      error: (e) => { failure = e; wake?.(); },
    });
    dec.configure(config);
    let k = k0, next = t0, done = false;
    // lecture groupée des octets : un bloc par groupe d'images (de l'image clé à la suivante)
    let block = null, blockStart = 0;
    const bytes = async (i) => {
      const s = samples[i];
      if (!block || s.offset < blockStart || s.offset + s.size > blockStart + block.byteLength) {
        let j = i; while (j + 1 < samples.length && !samples[j + 1].sync) j++;
        blockStart = s.offset; const last = samples[j];
        block = await file.slice(blockStart, Math.max(last.offset + last.size, s.offset + s.size)).arrayBuffer();
      }
      return new Uint8Array(block, s.offset - blockStart, s.size);
    };
    try {
      while (!done) {
        // contre-pression : peu d'images décodées en attente (elles occupent la mémoire vidéo)
        while (k < samples.length && ready.length + dec.decodeQueueSize < 6) {
          const s = samples[k];
          dec.decode(new EncodedVideoChunk({ type: s.sync ? 'key' : 'delta', timestamp: Math.round(s.t * 1e6), duration: Math.round(s.dur * 1e6), data: await bytes(k) }));
          k++;
        }
        if (k >= samples.length && dec.decodeQueueSize === 0 && !ready.length) await dec.flush();
        if (!ready.length) {
          if (failure) throw failure;
          if (k >= samples.length && dec.decodeQueueSize === 0) break;
          await new Promise((r) => { wake = r; setTimeout(r, 50); }); wake = null;
          continue;
        }
        // les images sortent dans l'ordre d'affichage
        const fr = ready.shift(), t = fr.timestamp / 1e6;
        if (t > t1 + 1e-6) { fr.close(); done = true; break; }
        if (t + 1e-6 < next) { fr.close(); continue; }
        if (every) next = t + every;
        try { yield { f: rank.get(fr.timestamp) ?? Math.round(t * fps), t, src: orient(fr) }; } finally { fr.close(); }
      }
    } finally {
      for (const fr of ready) fr.close();
      if (dec.state !== 'closed') dec.close();
    }
  }
  return { kind: 'webcodecs', fps, frames };
}

async function seekSource(v) {
  const source = { kind: 'seek', fps: (await estimateFps(v)) || null, frames };
  async function* frames(t0, t1, every = 0) {
    const F = source.fps || 30, step = every ? Math.max(1, Math.round(every * F)) : 1;
    for (let f = Math.ceil(t0 * F); f <= Math.floor(t1 * F); f += step) {
      const t = (f + 0.5) / F;
      await seek(v, t);
      yield { f, t, src: v };
    }
  }
  return source;
}
