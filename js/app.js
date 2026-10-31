import { loadPose, openVideo, scanVideo, findPassages, poseOnPassage } from './engine.js';
import { openFrames } from './frames.js';
import { profileMetrics, frontalMetrics } from './metrics.js';
import { saveAnalysis, listAnalyses, getAnalysis, deleteAnalysis } from './store.js';
import { synthesize, gaugesHTML, drawFrame, drawContact, drawFrontal, drawTarget, typical, fmt, pace, REFS, STATUS, PHOTO, css } from './report.js';

const $ = (s) => document.querySelector(s);
const params = new URLSearchParams(location.search);
let file = null, poseCache = {}, cancel = false;

// ---------- navigation ----------
function show(view) {
  for (const v of ['new', 'run', 'report', 'history']) $(`#view-${v}`).hidden = v !== view;
  document.querySelectorAll('.tab').forEach((t) => t.toggleAttribute('aria-current', t.dataset.view === view || (view === 'report' && t.dataset.view === 'history' && false)));
  if (view === 'history') renderHistory();
  window.scrollTo(0, 0);
}
document.querySelectorAll('.tab').forEach((t) => t.addEventListener('click', () => show(t.dataset.view)));

// ---------- formulaire ----------
const drop = $('#drop');
function setFile(f) { file = f; $('#file-name').textContent = f ? `${f.name} · ${(f.size / 1e6).toFixed(1)} Mo` : ''; $('#go').disabled = !f; }
$('#file').addEventListener('change', (e) => setFile(e.target.files[0]));
['dragenter', 'dragover'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add('over'); }));
['dragleave', 'drop'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove('over'); }));
drop.addEventListener('drop', (e) => { const f = e.dataTransfer.files[0]; if (f) setFile(f); });
try { const s = JSON.parse(localStorage.getItem('foulee-profile') || '{}'); if (s.h) $('#height').value = s.h; if (s.w) $('#weight').value = s.w; } catch {}
$('#form').addEventListener('submit', (e) => { e.preventDefault(); run().catch((err) => fail(err)); });
$('#cancel').addEventListener('click', () => { cancel = true; });

const STEPS = ['Lecture de la vidéo', 'Chargement du modèle de pose', 'Repérage des passages', 'Estimation de pose image par image', 'Calcul des mesures'];
function stepUI(i, msg) {
  $('#steps').innerHTML = STEPS.map((s, k) => `<li class="${k < i ? 'done' : k === i ? 'active' : ''}">${s}</li>`).join('');
  if (msg !== undefined) $('#run-msg').textContent = msg;
}
const bar = (x) => { $('#bar').style.width = `${Math.round(x * 100)}%`; };
function fail(err) {
  console.error(err); show('new');
  const el = $('#form-err'); el.hidden = false; el.textContent = err.message || String(err);
}

async function run() {
  if (!file) return;
  cancel = false; $('#form-err').hidden = true; show('run');
  const height = Number($('#height').value) / 100, weight = Number($('#weight').value) || null;
  try { localStorage.setItem('foulee-profile', JSON.stringify({ h: $('#height').value, w: $('#weight').value })); } catch {}
  stepUI(0, ''); bar(0);
  const v = await openVideo(file);
  const source = await openFrames(file, v);
  let fps = Number($('#fps').value) || source.fps;
  let fpsNote = '';
  if (!fps) { fps = 30; fpsNote = 'Cadence d\'images non détectée : 30 i/s supposées. Renseigne-la si elle est différente.'; }
  source.fps = fps;
  if (source.kind === 'seek') fpsNote += (fpsNote ? ' ' : '') + 'Ce navigateur ne décode pas cette vidéo image par image (WebCodecs) : analyse plus lente et temps moins précis. Chrome ou Safari font mieux, ou exporte la vidéo en MP4 H.264.';
  stepUI(1, `${v.videoWidth}×${v.videoHeight}, ${fmt(v.duration, 1)} s, ${fmt(fps, 2)} i/s${source.kind === 'seek' ? ' · décodage lent (sauts)' : ''}`);
  // modèle « heavy » seul ; ?model=<url> charge un autre modèle pour les tests
  const variant = params.get('model') ?? 'heavy';
  poseCache[variant] ??= await loadPose(params.get('model'), (m) => { $('#run-msg').textContent = m; });
  const pose = poseCache[variant];
  stepUI(2, 'Lecture accélérée de la vidéo pour repérer le coureur…');
  const scan = await scanVideo(v, fps, bar, source);
  const passages = findPassages(scan.boxes);
  if (!passages.length) throw new Error("Aucun passage de coureur exploitable n'a été repéré. Vérifie que le téléphone est immobile et que tu restes au moins 1 s dans le champ.");
  stepUI(3, `${passages.length} passage(s) : ${passages.map((p) => p.kind).join(', ')}`);
  const total = passages.reduce((s, p) => s + (p.t1 - p.t0 + 1) * fps, 0); let done = 0;
  const live = $('#live').getContext('2d');
  const passes = [];
  for (const p0 of passages) {
    // marge de 0,8 s : la détection de mouvement coupe souvent un peu tôt ou un peu tard
    const p = { ...p0, t0: Math.max(0, p0.t0 - 0.8), t1: Math.min(v.duration - 0.05, p0.t1 + 0.8) };
    const frames = await poseOnPassage(v, pose.landmarker, p, scan, fps, (x, crop, lm, X0, Y0, side) => {
      done++; bar(done / total);
      if (cancel) throw new Error('Analyse annulée.');
      if (done % 2) return;
      live.drawImage(crop, 0, 0, 384, 384);
      if (lm) { live.fillStyle = '#f0b93a'; for (const q of lm.slice(11)) { live.beginPath(); live.arc((q[0] - X0) / side * 384, (q[1] - Y0) / side * 384, 3, 0, 7); live.fill(); } }
    }, source);
    passes.push({ kind: p.kind, dir: p.dir, t0: p.t0, t1: p.t1, frames });
  }
  stepUI(4, '');
  for (const p of passes) {
    try { p.metrics = p.kind === 'profil' ? profileMetrics(p.frames, fps, height, p.dir) : frontalMetrics(p.frames, fps, p.kind); }
    catch (e) { console.error(e); p.metrics = { error: String(e) }; }
  }
  const a = { id: crypto.randomUUID?.() ?? String(Date.now()), date: Date.now(), videoDate: file.lastModified, label: $('#label').value.trim(),
    videoName: file.name, height, weight, fps, fpsNote, duration: v.duration, size: [v.videoWidth, v.videoHeight],
    model: pose.modelPath.includes('heavy') ? 'heavy' : 'full', delegate: pose.delegate, decoder: source.kind, passes };
  URL.revokeObjectURL(v.src);
  try { await saveAnalysis(a); } catch (e) { console.warn('sauvegarde impossible', e); a.unsaved = true; }
  window.__lastAnalysis = a;
  await renderReport(a);
}

// ---------- rapport ----------
const KIND = { profil: 'Profil', face: 'De face', dos: 'De dos' };
async function renderReport(a) {
  show('report');
  const prof = a.passes.filter((p) => p.kind === 'profil' && p.metrics && !p.metrics.error && p.metrics.nSteps >= 2);
  const fr = a.passes.filter((p) => p.kind !== 'profil' && p.metrics && !p.metrics.error);
  const { cards, plan } = synthesize(a.passes);
  const prev = (await listAnalyses().catch(() => [])).filter((x) => x.id !== a.id && x.date < a.date)[0];
  const d = new Date(a.videoDate || a.date);
  const title = a.label || `Analyse du ${d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}`;
  const R = $('#report');
  R.innerHTML = `<div class="rep">
  <header>
    <h1>${esc(title)}</h1>
    <div class="meta"><span>Coureur <b>${fmt(a.height * 100)} cm${a.weight ? ` · ${fmt(a.weight)} kg` : ''}</b></span><span>Vidéo <b>${esc(a.videoName)}</b></span><span><b>${a.passes.length}</b> passage${a.passes.length > 1 ? 's' : ''} repéré${a.passes.length > 1 ? 's' : ''}</span></div>
    <nav class="toc noprint" aria-label="Sommaire du rapport"><a href="#bref">En bref</a>${plan.length ? '<a href="#plan">Quoi travailler</a>' : ''}<a href="#images">Images clés</a><a href="#mesures">Mesures</a>${fr.length ? '<a href="#frontal">Face / dos</a>' : ''}<a href="#lecteur">Lecteur</a><a href="#methode">Méthode</a></nav>
    <div class="actions noprint"><button class="btn small" id="print">Imprimer ou PDF</button><button class="btn ghost" id="exp">Exporter (JSON)</button><button class="btn ghost" id="again">Nouvelle analyse</button></div>
    ${a.fpsNote ? `<p class="note">${esc(a.fpsNote)}</p>` : ''}${a.fps < 50 ? '<p class="note">Moins de 50 images/s : temps de contact et de vol imprécis (± 1 image = ' + fmt(1000 / a.fps) + ' ms).</p>' : ''}
  </header>
  <section id="bref"><h2>En bref</h2><ul class="prio">${cards.map((c) => `<li><span class="chip ${STATUS[c.st][0]}">${STATUS[c.st][1]}</span><h4>${c.t}</h4><p>${c.d}${c.href ? ` <a href="${c.href}" class="see">Voir la mesure</a>` : ''}</p></li>`).join('')}</ul></section>
  ${plan.length ? `<section id="plan"><h2>Quoi travailler</h2><div class="plan">${plan.map((p) => `<article><h4>${p.t}</h4><ul>${p.li.map((x) => `<li>${x}</li>`).join('')}</ul><p class="why">${p.why}</p></article>`).join('')}</div></section>` : ''}
  ${prev ? compareHTML(a, prev) : ''}
  <section id="images"><h2>Images clés</h2><div class="keyimgs" id="keys"></div></section>
  <section><h2>Passages et rythme</h2><div class="tablewrap"><table><thead><tr><th>Passage</th><th>Images analysées</th><th class="num">Allure</th><th class="num">Cadence</th><th class="num">Pas</th><th class="num">Contact · vol</th><th>Appuis</th></tr></thead><tbody>${a.passes.map((p, i) => {
    const m = p.metrics || {}, run = p.kind === 'profil' && prof.includes(p);
    const steps = m.error ? 'non exploitable' : p.kind === 'profil' ? (!m.footsOk ? 'pieds peu visibles, ignoré' : m.nSteps < 2 ? `${m.nSteps} : trop peu, ignoré` : `${m.nSteps}`) : `${m.contacts?.length ?? 0}`;
    return `<tr><td><b>${i + 1}. ${KIND[p.kind]}</b> <span class="muted">${fmt(p.t0, 1)}–${fmt(p.t1, 1)} s</span></td><td>${p.frames.filter((f) => f.lm).length}/${p.frames.length}</td>
      <td class="num">${run ? `<span class="big">${pace(m.pace)}</span> /km` : '—'}</td><td class="num">${run ? `<span class="big">${fmt(m.cadence)}</span> pas/min` : '—'}</td>
      <td class="num">${run ? `${fmt(m.step_len, 2)} m` : '—'}</td><td class="num">${run ? `${fmt(m.contact_ms)} · ${fmt(m.flight_ms)} ms` : '—'}</td><td>${steps}</td></tr>`;
  }).join('')}</tbody></table></div></section>
  ${prof.length ? `<section id="mesures"><h2>Mesures de profil</h2><p class="muted hint">Clique sur une mesure pour voir le repère publié et la fiabilité.</p>${gaugesHTML(prof)}</section>` : '<section id="mesures"><h2>Mesures de profil</h2><p class="empty">Aucun passage de profil exploitable. Il faut au moins 1 s de course de profil, pieds visibles en entier, téléphone fixe à 3–4 m de la ligne de course. <a href="#" class="see" data-view="new">Revoir comment filmer</a></p></section>'}
  ${fr.length ? `<section id="frontal"><h2>Vue de face / de dos</h2>${fr.map((p) => frontalHTML(p, a)).join('')}</section>` : ''}
  <section id="lecteur" class="noprint"><h2>Lecteur image par image</h2><div class="player">
    <canvas id="pc" width="576" height="576" aria-label="Image analysée avec le squelette"></canvas>
    <div class="pcontrols">
      <label>Passage<select id="psel">${a.passes.map((p, i) => `<option value="${i}">${i + 1}. ${KIND[p.kind]} (${fmt(p.t0, 1)}–${fmt(p.t1, 1)} s)</option>`).join('')}</select></label>
      <input id="prange" type="range" min="0" value="0" aria-label="Position dans le passage">
      <div class="prow"><button class="btn small" id="pplay">Lecture</button><button class="btn ghost" id="pprev" aria-label="Image précédente">◀ image</button><button class="btn ghost" id="pnext" aria-label="Image suivante">image ▶</button><button class="btn ghost" id="pic">Contact suivant</button>
        <select id="pspeed" aria-label="Vitesse"><option value="0.25">×1/4</option><option value="0.1">×1/10</option><option value="1">×1</option></select></div>
      <div class="readout" id="pread"></div>
      <p class="muted">Couleurs : jaune = côté que le modèle étiquette gauche, bleu = droit. De profil, le modèle confond parfois les deux jambes.</p>
    </div></div></section>
  <section id="methode"><h2>Méthode et limites</h2>
    <p>Le coureur est repéré par soustraction du fond (caméra fixe), recadré puis analysé image par image par MediaPipe Pose (33 points). Un appui de profil est détecté quand la pointe du pied reste immobile dans l'image ; contact initial = arrêt du talon, décollage = départ de la pointe. L'échelle vient de la longueur cuisse + jambe estimée à 49,1 % de la taille (tables de Winter). Erreur typique des angles de profil : 2 à 5° ; le modèle est moins précis sur le pied et quand les jambes se croisent. Les repères sont pour la plupart des moyennes de groupe mesurées en 3D, pas des seuils de blessure : il n'existe pas de seuil cinématique validé (Souza 2016).</p>
    <p class="muted">Sources : Malisoux et al. 2023 (OJSM) ; Heiderscheit et al. 2011 (MSSE) ; Lieberman et al. 2015 (J Exp Biol) ; Altman & Davis 2012 (Gait Posture) ; Barrett et al. 2023 (IJSPT) ; Bramah et al. 2018 (AJSM) ; Teng & Powers 2014 (JOSPT) ; Souza 2016 (IJSPT) ; Meardon & Derrick 2014 (J Biomech) ; Arellano & Kram 2014 (J Exp Biol) ; Dingenen et al. 2018 (Phys Ther Sport).</p>
    <p class="muted">Détails techniques : ${a.size[0]}×${a.size[1]}, ${fmt(a.fps, 2)} i/s, ${fmt(a.duration, 0)} s · modèle ${a.model} (${a.delegate})${a.decoder ? ` · décodage ${a.decoder === 'webcodecs' ? 'WebCodecs' : 'par sauts'}` : ''} · analysé le ${new Date(a.date).toLocaleString('fr-FR')}</p>
    <div class="actions noprint"><button class="btn ghost" id="del">Supprimer cette analyse</button></div></section>
  </div>`;
  $('#exp').onclick = () => exportJSON(a);
  $('#print').onclick = () => { R.querySelectorAll('details.metric').forEach((x) => { x.open = true; }); print(); };
  // liens internes : défilement doux, et la mesure visée s'ouvre
  R.querySelectorAll('a[href^="#"]').forEach((l) => l.addEventListener('click', (e) => {
    e.preventDefault();
    if (l.dataset.view) return show(l.dataset.view);
    const t = R.querySelector(l.getAttribute('href')); if (!t) return;
    if (t.tagName === 'DETAILS') t.open = true;
    t.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
  }));
  $('#del').onclick = async () => { if (a.unsaved) return show('new'); $('#del').textContent = 'Confirmer : supprimer définitivement'; $('#del').onclick = async () => { await deleteAnalysis(a.id); show('history'); }; };
  $('#again').onclick = () => show('new');
  setupPlayer(a);
  await renderKeys(a, prof, fr);
  await renderTargets(a, prof);
}
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function frontalHTML(p, a) {
  const m = p.metrics; if (!m.contacts) return '';
  const hid = m.masked ? `${m.masked} appui${m.masked > 1 ? 's' : ''} ignoré${m.masked > 1 ? 's' : ''} : jambes mal visibles (obstacle, sortie du cadre).` : '';
  if (m.unreliable) return `<h3>${KIND[p.kind]} · ${fmt(p.t0, 1)}–${fmt(p.t1, 1)} s</h3><p class="empty">Passage non chiffré : le modèle confond les jambes (${m.confused} appuis détectés en même temps que l'autre pied, ce qui est impossible en course). Filme téléphone à hauteur de hanche et arrête-toi à 10–15 m.</p>`;
  if (!m.contacts.length) return `<h3>${KIND[p.kind]} · ${fmt(p.t0, 1)}–${fmt(p.t1, 1)} s</h3><p class="empty">${hid || 'Aucun appui repéré sur ce passage : pieds masqués ou coureur trop loin.'}</p>`;
  const back = p.kind === 'dos';
  const warn = m.obliqueWarn ? '<p class="note">Le coureur se déplace de biais par rapport à la caméra : largeur d\'appui, bassin et genou sont faussés par la perspective. Mesures indicatives seulement.</p>' : '';
  const rows = m.contacts.map((c) => `<tr><td>${c.side}</td><td class="num">${fmt(c.f0)}–${fmt(c.f1)}</td><td class="num">${fmt(c.lateral)} %</td><td>${c.lateral < 0 ? 'croise' : 'de son côté'}</td>${back ? `<td class="num">${fmt(c.drop, 1)}°</td><td class="num">${fmt(c.fppa)}°</td>` : ''}</tr>`).join('');
  return `<h3>${KIND[p.kind]} · ${fmt(p.t0, 1)}–${fmt(p.t1, 1)} s</h3>${warn}${hid ? `<p class="note">${hid}</p>` : ''}
  <p>Pied par rapport à la ligne médiane : <b>${fmt(m.lateralMed)} %</b> de la largeur du bassin (médiane) · <b>${m.crossings}</b> appui${m.crossings > 1 ? 's' : ''} sur ${m.contacts.length} croise${m.crossings > 1 ? 'nt' : ''} la ligne.${back ? ` Chute du bassin : gauche <b>${fmt(m.drop.gauche, 1)}°</b>, droite <b>${fmt(m.drop.droite, 1)}°</b>.` : ''}</p>
  <details class="fdet"><summary>Détail des ${m.contacts.length} appuis</summary><div class="tablewrap"><table><thead><tr><th>Appui</th><th>Images</th><th>Pied / ligne médiane</th><th></th>${back ? '<th>Chute du bassin</th><th>Genou (plan frontal)</th>' : ''}</tr></thead><tbody>${rows}</tbody></table></div></details>
  <p class="ref">Pied / ligne médiane : position du talon par rapport au milieu du bassin, en % de la largeur du bassin (négatif = le pied croise la ligne). ${back ? `Chute du bassin : sains 3,7 ± 1,9°, blessés 6,4 ± 2,1° (Bramah 2018). Inclinaison de caméra estimée et retirée : ${fmt(m.roll, 1)}°. Genou : + = vers l'intérieur ; asymptomatiques 4,0 ± 3,3° (Vasconcelos 2022), pas de seuil.` : 'De face, la chute du bassin et le genou ne sont pas chiffrés : filme de dos pour les obtenir.'}</p>`;
}

function compareHTML(a, prev) {
  const cur = a.passes.filter((p) => p.kind === 'profil' && p.metrics?.nSteps >= 2).map((p) => p.metrics);
  const old = prev.summary.filter((p) => p.kind === 'profil' && p.metrics?.nSteps >= 2).map((p) => p.metrics);
  if (!cur.length || !old.length) return '';
  // on compare les passages d'allure la plus proche
  let best = null;
  for (const c of cur) for (const o of old) { const d = Math.abs(c.speed - o.speed); if (!best || d < best.d) best = { c, o, d }; }
  const keys = ['cadence', 'contact_ms', 'vosc_cm', 'foot_deg', 'shank_deg', 'heel_hip_pct', 'knee_ic', 'trunk'];
  const better = { cadence: 1, contact_ms: -1, vosc_cm: -1, shank_deg: -1, heel_hip_pct: -1, trunk: 1 };
  const rows = keys.map((k) => {
    const dv = best.c[k] - best.o[k]; const s = better[k] ? Math.sign(dv) * better[k] : 0;
    return `<tr><td>${REFS[k].label}</td><td class="num">${fmt(best.o[k], k === 'vosc_cm' ? 1 : 0)}</td><td class="num">${fmt(best.c[k], k === 'vosc_cm' ? 1 : 0)}</td><td class="num ${s > 0 ? 'delta-good' : s < 0 ? 'delta-bad' : ''}">${dv >= 0 ? '+' : ''}${fmt(dv, k === 'vosc_cm' ? 1 : 0)}</td><td>${REFS[k].unit}</td></tr>`;
  }).join('');
  return `<section><h2>Évolution depuis le ${new Date(prev.videoDate || prev.date).toLocaleDateString('fr-FR')}</h2>
    <p class="muted">Passages d'allure la plus proche : ${pace(best.o.pace)} → ${pace(best.c.pace)} min/km.${best.d > 0.3 ? ' Allures assez différentes : comparaison à prendre avec prudence.' : ''}</p>
    <div class="tablewrap"><table><thead><tr><th>Mesure</th><th>Avant</th><th>Maintenant</th><th>Écart</th><th></th></tr></thead><tbody>${rows}</tbody></table></div></section>`;
}

// photo de chaque mesure : l'appui le plus proche de la valeur retenue (médiane), pas le pire
async function renderTargets(a, prof) {
  const ty = typical(prof);
  for (const c of document.querySelectorAll('.mphoto canvas')) {
    const k = c.dataset.k; let best = null;
    for (const p of prof) for (const st of p.metrics.steps) {
      const d = Math.abs(st[k] - ty[k]), f = p.frames.find((x) => x.f === st.f_ic);
      if (f?.lm && Number.isFinite(d) && (!best || d < best.d)) best = { d, p, st, f };
    }
    if (!best) { c.closest('figure').remove(); continue; }
    const R = REFS[k], st = R.status(ty[k], ty), col = css({ ok: '--ok', warn: '--warn', bad: '--bad' }[st] ?? '--na');
    await drawTarget(c, best.f, k, best.st[k], best.p.dir, col);
    c.nextElementSibling.textContent = `Passage ${a.passes.indexOf(best.p) + 1} (${pace(best.p.metrics.pace)}/km), image ${best.st.f_ic} : l'appui le plus proche de ta valeur habituelle. Couleur : ${PHOTO[k]} ; vert : la zone visée.`;
  }
}

async function renderKeys(a, prof, fr) {
  const box = $('#keys'); box.innerHTML = '';
  for (const p of prof) {
    const steps = p.metrics.steps.slice().sort((x, y) => x.shank_deg - y.shank_deg);
    const st = steps[Math.floor(steps.length / 2)]; const f = p.frames.find((x) => x.f === st.f_ic);
    if (!f) continue;
    const fig = document.createElement('figure'); const c = document.createElement('canvas'); c.width = c.height = 480;
    fig.append(c); const cap = document.createElement('figcaption');
    cap.textContent = `Passage ${a.passes.indexOf(p) + 1} (${pace(p.metrics.pace)}/km) : contact initial représentatif (image ${st.f_ic}). Ligne verte : aplomb du bassin.`;
    fig.append(cap); box.append(fig);
    await drawContact(c, f, st, p.dir, `Contact · ${pace(p.metrics.pace)}/km`);
  }
  for (const p of fr) for (const ct of (p.metrics.contacts || []).slice(0, 4)) {
    const f = p.frames.find((x) => x.f === ct.mt); if (!f) continue;
    const fig = document.createElement('figure'); const c = document.createElement('canvas'); c.width = c.height = 360;
    fig.append(c); const cap = document.createElement('figcaption'); cap.textContent = `${KIND[p.kind]} : appui ${ct.side} (image ${ct.mt}).`;
    fig.append(cap); box.append(fig); await drawFrontal(c, f, ct, p.kind);
  }
  if (!box.children.length) box.innerHTML = '<p class="empty">Pas d\'image clé disponible.</p>';
}

// un seul lecteur à la fois : le minuteur d'un rapport précédent continuerait d'écrire dans le nouveau
let timer = null;
function setupPlayer(a) {
  clearInterval(timer); timer = null;
  const c = $('#pc'), ctx = c.getContext('2d'), S = c.width;
  let pi = 0, i = 0;
  const range = $('#prange'), read = $('#pread');
  const stanceOf = (p, f) => p.kind === 'profil' ? (p.metrics?.steps || []).some((s) => f >= s.f_ic && f <= s.f_to) : (p.metrics?.contacts || []).some((s) => f >= s.f0 && f <= s.f1);
  const kneeAng = (lm, s) => { const h = lm[23 + s], k = lm[25 + s], an = lm[27 + s]; const u = [h[0] - k[0], h[1] - k[1]], w = [an[0] - k[0], an[1] - k[1]]; return 180 - Math.acos((u[0] * w[0] + u[1] * w[1]) / Math.hypot(...u) / Math.hypot(...w)) * 180 / Math.PI; };
  async function draw() {
    const p = a.passes[pi], fr = p.frames[i]; if (!fr) return;
    await drawFrame(ctx, fr, S, { label: `${KIND[p.kind]} · image ${fr.f}`, stance: stanceOf(p, fr.f) });
    range.value = i;
    read.innerHTML = `Temps <b>${fmt(fr.f / a.fps, 2)} s</b> · image <b>${i + 1}/${p.frames.length}</b>` + (fr.lm ? `<br>Flexion genou (étiquettes modèle) G <b>${fmt(kneeAng(fr.lm, 0))}°</b> · D <b>${fmt(kneeAng(fr.lm, 1))}°</b>` : '<br>Pas de pose détectée sur cette image');
  }
  const stop = () => { clearInterval(timer); timer = null; $('#pplay').textContent = 'Lecture'; };
  // ouvre sur le premier contact (à défaut, la première pose) plutôt que sur l'entrée dans le champ
  const firstPose = () => { const p = a.passes[pi], f0 = p.metrics?.steps?.[0]?.f_ic ?? p.metrics?.contacts?.[0]?.f0;
    const k = p.frames.findIndex((x) => (f0 !== undefined ? x.f === f0 : x.lm)); return Math.max(0, k); };
  $('#psel').onchange = (e) => { stop(); pi = Number(e.target.value); i = firstPose(); range.max = a.passes[pi].frames.length - 1; draw(); };
  range.max = a.passes[0].frames.length - 1; i = firstPose();
  range.oninput = () => { stop(); i = Number(range.value); draw(); };
  $('#pprev').onclick = () => { stop(); i = Math.max(0, i - 1); draw(); };
  $('#pnext').onclick = () => { stop(); i = Math.min(a.passes[pi].frames.length - 1, i + 1); draw(); };
  $('#pic').onclick = () => {
    stop(); const p = a.passes[pi];
    const ics = p.kind === 'profil' ? (p.metrics?.steps || []).map((s) => s.f_ic) : (p.metrics?.contacts || []).map((s) => s.f0);
    const f = p.frames[i].f, nx = ics.find((x) => x > f) ?? ics[0];
    if (nx !== undefined) { i = p.frames.findIndex((x) => x.f === nx); draw(); }
  };
  $('#pplay').onclick = () => {
    if (timer) return stop();
    $('#pplay').textContent = 'Pause';
    const sp = Number($('#pspeed').value), dt = Math.max(16, 1000 / (a.fps * sp));
    let busy = false;
    timer = setInterval(async () => { if (busy) return; busy = true; i = (i + 1) % a.passes[pi].frames.length; await draw(); busy = false; }, dt);
  };
  draw();
}

function exportJSON(a) {
  const clean = { ...a, passes: a.passes.map(({ frames, ...p }) => ({ ...p, landmarks: frames.map((f) => ({ f: f.f, lm: f.lm })) })) };
  const blob = new Blob([JSON.stringify(clean)], { type: 'application/json' });
  const url = URL.createObjectURL(blob), link = document.createElement('a');
  link.href = url; link.download = `foulee-${new Date(a.videoDate || a.date).toISOString().slice(0, 10)}.json`; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

// ---------- historique ----------
async function renderHistory() {
  const H = $('#history');
  let list = [];
  try { list = await listAnalyses(); } catch (e) { H.innerHTML = `<p class="empty">Historique indisponible dans ce navigateur (${esc(e.message)}).</p>`; return; }
  if (!list.length) { H.innerHTML = '<p class="empty">Aucune analyse enregistrée pour l\'instant.</p>'; return; }
  const row = (x) => {
    const ps = x.summary.filter((p) => p.kind === 'profil' && p.metrics?.nSteps >= 2).map((p) => p.metrics);
    const j = (k, d = 0) => ps.map((m) => fmt(m[k], d)).join(' · ') || '—';
    const kinds = x.summary.map((p) => p.kind[0].toUpperCase()).join('');
    return `<tr class="clickable" data-id="${x.id}" tabindex="0"><td>${new Date(x.videoDate || x.date).toLocaleDateString('fr-FR')}</td><td>${esc(x.label || x.videoName)}</td><td>${kinds}</td>
      <td class="num">${ps.map((m) => pace(m.pace)).join(' · ') || '—'}</td><td class="num">${j('cadence')}</td><td class="num">${j('contact_ms')}</td><td class="num">${j('shank_deg')}</td><td class="num">${j('heel_hip_pct')}</td><td class="num">${j('trunk')}</td></tr>`;
  };
  H.innerHTML = `${chartHTML(list)}<div class="tablewrap"><table><thead><tr><th>Date</th><th>Libellé</th><th>Vues</th><th>Allure</th><th>Cadence</th><th>Contact ms</th><th>Tibia °</th><th>Talon/bassin %</th><th>Buste °</th></tr></thead><tbody>${list.map(row).join('')}</tbody></table></div>
    <p class="muted">Vues : P = profil, F = face, D = dos. Clique sur une ligne pour rouvrir le rapport.</p>`;
  H.querySelectorAll('tr.clickable').forEach((tr) => {
    const open = async () => { const a = await getAnalysis(tr.dataset.id); if (a) renderReport(a); };
    tr.addEventListener('click', open); tr.addEventListener('keydown', (e) => { if (e.key === 'Enter') open(); });
  });
}
function chartHTML(list) {
  // évolution du tibia au contact et de la cadence (passage le plus lent de chaque analyse)
  const pts = list.map((x) => {
    const ps = x.summary.filter((p) => p.kind === 'profil' && p.metrics?.nSteps >= 2).map((p) => p.metrics).sort((a, b) => a.speed - b.speed);
    return ps.length ? { t: x.videoDate || x.date, sh: ps[0].shank_deg, cad: ps[0].cadence } : null;
  }).filter(Boolean).sort((a, b) => a.t - b.t);
  if (pts.length < 2) return '';
  const W = 640, Hh = 180, pad = 34, t0 = pts[0].t, t1 = pts[pts.length - 1].t || t0 + 1;
  const X = (t) => pad + (W - 2 * pad) * (t - t0) / Math.max(1, t1 - t0);
  const series = (k, lo, hi, col) => {
    const Y = (v) => Hh - pad + (-(Hh - 2 * pad)) * (v - lo) / (hi - lo);
    return `<polyline fill="none" stroke="${col}" stroke-width="2.5" points="${pts.map((p) => `${X(p.t)},${Y(p[k])}`).join(' ')}"/>` + pts.map((p) => `<circle cx="${X(p.t)}" cy="${Y(p[k])}" r="4" fill="${col}"/>`).join('');
  };
  return `<figure class="card"><svg class="chart" viewBox="0 0 ${W} ${Hh}" role="img" aria-label="Évolution du tibia au contact et de la cadence">
    <line x1="${pad}" x2="${W - pad}" y1="${Hh - pad}" y2="${Hh - pad}" stroke="var(--line)"/>
    ${series('sh', -5, 25, 'var(--warn)')}${series('cad', 140, 195, 'var(--accent)')}
    <text x="${pad}" y="16" fill="var(--muted)" font-size="12" font-family="var(--body)">Tibia au contact (−5 à 25°, orange) · Cadence (140 à 195 pas/min, bleu), passage le plus lent</text></svg></figure>`;
}

if (params.get('autotest')) {
  // mode test : analyse un fichier servi localement
  const r = await fetch(params.get('autotest')); setFile(new File([await r.blob()], params.get('autotest').split('/').pop()));
  run().then(() => { window.__done = true; }).catch((e) => { window.__done = true; window.__err = String(e.stack || e); fail(e); });
}
