// Pipeline : d'un fichier vidéo à une Analyse, sans toucher à la page.
// L'interface suit l'avancement par des rappels et peut annuler avec un AbortSignal.

import { loadPose, openVideo, scanVideo, findPassages, poseOnPassage } from './infra/video.js';
import { openFrames } from './infra/images.js';
import { ALGO, mesurer } from './domaine/analyse.js';
import { cameraBouge, fondPassage } from './domaine/analyse.js';

export const ETAPES = ['Lecture de la vidéo', 'Chargement du modèle de pose', 'Repérage des passages', 'Estimation de pose image par image', 'Calcul des mesures'];
const poses = {};

// options : { height (m), sexe ('femme' | 'homme', facultatif), fps (forcé, sinon détecté), label, modelUrl }
// rappels : { onStep(i, message), onProgress(0..1), onFrame(crop, lm, x0, y0, côté), signal }
export async function analyser(file, options, { onStep = () => {}, onProgress = () => {}, onFrame = () => {}, signal } = {}) {
  const stop = () => { if (signal?.aborted) throw new Error('Analyse annulée.'); };
  onStep(0, '');
  const v = await openVideo(file);
  try {
    // le repérage garde ~175 Mo par minute de vidéo : au-delà de 10 min, l'onglet risque de planter
    if (v.duration > 600) throw new Error(`Vidéo de ${Math.round(v.duration / 60)} min : coupe-la à moins de 10 min autour de tes passages (le repérage garde la vidéo en mémoire).`);
    const source = await openFrames(file, v);
    let fps = options.fps || source.fps, fpsNote = '';
    if (options.fps && source.fps && Math.abs(options.fps / source.fps - 1) > 0.05) fpsNote = `Images/s forcées à ${options.fps}, alors que la vidéo en annonce ${source.fps.toFixed(1).replace('.', ',')} : tous les temps en dépendent.`;
    if (!Number.isFinite(v.duration)) throw new Error('Durée de la vidéo inconnue (enregistrement direct ?) : exporte-la en MP4 avant de l\'analyser.');
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
    const bouge = cameraBouge(scan.mouvement);
    if (!passages.length) throw new Error(bouge
      ? "L'image bouge presque partout : caméra tenue à la main, qui suit le coureur, ou plan coupé au montage. Pose le téléphone sur un support fixe et laisse-toi traverser le champ."
      : "Aucun passage de coureur exploitable n'a été repéré. Vérifie que le téléphone est immobile et que tu restes au moins 2 s dans le champ.");

    const nb = (k) => passages.filter((p) => p.kind === k).length, vues = [['profil', 'de profil'], ['face', 'de face'], ['dos', 'de dos']];
    onStep(3, `${passages.length} passage${passages.length > 1 ? 's' : ''} trouvé${passages.length > 1 ? 's' : ''} : ${vues.filter(([k]) => nb(k)).map(([k, t]) => `${nb(k)} ${t}`).join(', ')}`);
    // nombre d'images à analyser, marges comprises (pour la barre de progression)
    const total = passages.reduce((s, p) => s + (Math.min(v.duration - 0.05, p.t1 + 0.8) - Math.max(0, p.t0 - 0.8)) * fps + 1, 0);
    let fait = 0;
    const passes = [];
    for (const p0 of passages) {
      // marge de 0,8 s : la détection de mouvement coupe souvent un peu tôt ou un peu tard
      const p = { ...p0, t0: Math.max(0, p0.t0 - 0.8), t1: Math.min(v.duration - 0.05, p0.t1 + 0.8) };
      const frames = await poseOnPassage(v, pose.landmarker, p, scan, fps, (...args) => {
        stop(); onProgress(++fait / total); onFrame(...args);
      }, source);
      // agitation du fond sur la fenêtre de ce passage : décide du mode caméra fixe ou mobile (voir analyse.js)
      passes.push({ kind: p.kind, dir: p.dir, t0: p.t0, t1: p.t1, fond: fondPassage(scan.mouvement, p.t0, p.t1), frames });
    }

    onStep(4, '');
    for (const p of passes) p.metrics = mesurer(p, fps, options.height);
    return {
      id: crypto.randomUUID?.() ?? String(Date.now()), date: Date.now(), videoDate: file.lastModified, label: options.label ?? '',
      videoName: file.name, height: options.height, sexe: options.sexe, fps, fpsNote, duration: v.duration,
      size: [v.videoWidth, v.videoHeight], model: pose.modelPath.includes('heavy') ? 'heavy' : 'autre', delegate: pose.delegate,
      decoder: source.kind, vfr: source.vfr ?? null, mouvement: scan.mouvement, algo: ALGO, passes,
    };
  } finally {
    URL.revokeObjectURL(v.src);
  }
}
