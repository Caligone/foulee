// Pipeline : d'un fichier vidéo à une Analyse, sans toucher à la page.
// L'interface suit l'avancement par des rappels et peut annuler avec un AbortSignal.

import { loadPose, openVideo, scanVideo, findPassages, poseOnPassage } from './infra/video.js';
import { openFrames } from './infra/images.js';
import { ALGO, mesurer } from './domaine/analyse.js';

export const ETAPES = ['Lecture de la vidéo', 'Chargement du modèle de pose', 'Repérage des passages', 'Estimation de pose image par image', 'Calcul des mesures'];
const poses = {};

// options : { height (m), weight, fps (forcé, sinon détecté), label, modelUrl }
// rappels : { onStep(i, message), onProgress(0..1), onFrame(crop, lm, x0, y0, côté), signal }
export async function analyser(file, options, { onStep = () => {}, onProgress = () => {}, onFrame = () => {}, signal } = {}) {
  const stop = () => { if (signal?.aborted) throw new Error('Analyse annulée.'); };
  onStep(0, '');
  const v = await openVideo(file);
  try {
    const source = await openFrames(file, v);
    let fps = options.fps || source.fps, fpsNote = '';
    if (!fps) { fps = 30; fpsNote = 'Cadence d\'images non détectée : 30 i/s supposées. Renseigne-la si elle est différente.'; }
    source.fps = fps;
    if (source.kind === 'seek') fpsNote += (fpsNote ? ' ' : '') + 'Ce navigateur ne décode pas cette vidéo image par image (WebCodecs) : analyse plus lente et temps moins précis. Chrome ou Safari font mieux, ou exporte la vidéo en MP4 H.264.';
    stop();
    onStep(1, `${v.videoWidth}×${v.videoHeight}, ${v.duration.toFixed(1).replace('.', ',')} s, ${fps.toFixed(2).replace('.', ',')} i/s${source.kind === 'seek' ? ' · décodage lent (sauts)' : ''}`);
    const cle = options.modelUrl ?? 'heavy';
    poses[cle] ??= await loadPose(options.modelUrl, (m) => onStep(1, m));
    const pose = poses[cle];
    stop();

    onStep(2, 'Lecture accélérée de la vidéo pour repérer le coureur…');
    const scan = await scanVideo(v, fps, (x) => { stop(); onProgress(x); }, source);
    const passages = findPassages(scan.boxes);
    if (!passages.length) throw new Error("Aucun passage de coureur exploitable n'a été repéré. Vérifie que le téléphone est immobile et que tu restes au moins 1 s dans le champ.");

    onStep(3, `${passages.length} passage(s) : ${passages.map((p) => p.kind).join(', ')}`);
    const total = passages.reduce((s, p) => s + (p.t1 - p.t0 + 1) * fps, 0);
    let fait = 0;
    const passes = [];
    for (const p0 of passages) {
      // marge de 0,8 s : la détection de mouvement coupe souvent un peu tôt ou un peu tard
      const p = { ...p0, t0: Math.max(0, p0.t0 - 0.8), t1: Math.min(v.duration - 0.05, p0.t1 + 0.8) };
      const frames = await poseOnPassage(v, pose.landmarker, p, scan, fps, (...args) => {
        stop(); onProgress(++fait / total); onFrame(...args);
      }, source);
      passes.push({ kind: p.kind, dir: p.dir, t0: p.t0, t1: p.t1, frames });
    }

    onStep(4, '');
    for (const p of passes) p.metrics = mesurer(p, fps, options.height);
    return {
      id: crypto.randomUUID?.() ?? String(Date.now()), date: Date.now(), videoDate: file.lastModified, label: options.label ?? '',
      videoName: file.name, height: options.height, weight: options.weight ?? null, fps, fpsNote, duration: v.duration,
      size: [v.videoWidth, v.videoHeight], model: pose.modelPath.includes('heavy') ? 'heavy' : 'autre', delegate: pose.delegate,
      decoder: source.kind, algo: ALGO, passes,
    };
  } finally {
    URL.revokeObjectURL(v.src);
  }
}
