// Rapport d'une analyse : à retenir, constats, pistes d'entraînement, mesures, vues de face / dos, lecteur, méthode.
import { REPERES, bande, bandeLarge, classe, statut, libelle, typique, LIBELLES } from '../domaine/reperes.js';
import { VUES, ETATS, etat, profils, frontaux, appuis } from '../domaine/analyse.js';
import { bilan } from '../domaine/recommandations.js';
import { qualite } from '../domaine/qualite.js';
import { drawFrame, drawTarget, css, PHOTO } from './dessin.js';
import { fmt, pace, esc } from '../format.js';

const $ = (s) => document.querySelector(s);
export const CLASSE = { ok: 'c-ok', hors: 'c-warn', loin: 'c-bad', info: 'c-na', na: 'c-na' };
const chip = (st, texte) => `<span class="chip ${CLASSE[st]}">${texte}</span>`;
const DEC = { vosc_cm: 1 };
const GROUPES = [
  ['Rythme et appuis', ['cadence', 'contact_ms', 'duty', 'vosc_cm']],
  ['Attaque du pied', ['shank_deg', 'heel_hip_pct']],
  ['Appui et posture', ['knee_max', 'trunk']],
  ['Pour info (sans repère publié)', ['foot_deg', 'knee_ic', 'thigh_to', 'elbow']],
];
// explications derrière une icône ⓘ : bulle native (popovertarget), ancrée sur l'icône quand le navigateur sait le
// faire ; à l'impression, la bulle s'affiche en clair à sa place. Sans popover : repli en dépliant sous l'icône.
let nBulles = 0;
const info = (html, label = 'Explication') => {
  const id = `bulle-${++nBulles}`;
  return `<button type="button" class="info" popovertarget="${id}" aria-label="${esc(label)}" style="anchor-name:--${id}">i</button><span id="${id}" popover class="tip" role="note" style="position-anchor:--${id}">${html}</span>`;
};
const source = ([nom, pmid]) => `<a href="https://pubmed.ncbi.nlm.nih.gov/${pmid}/" target="_blank" rel="noopener">${nom}</a>`;

// texte du repère sous la jauge : la plage des coureurs de référence, à ton allure quand la source le permet
function repereTexte(R, d, ctx) {
  const u = R.unit;
  if (R.nature === 'indicatif') return `Pas de repère publié, seuil indicatif de l'appli : ${fmt(R.seuil)} ${u}`;
  if (R.nature === 'aucun') return R.classes ? 'Médio-pied entre −1,6 et 8° ; aucun type d\'attaque n\'est meilleur en soi' : 'Pas de repère publié';
  const [b0, b1] = bande(R, ctx);
  const allure = R.pente && Number.isFinite(ctx?.speed) ? ` à ton allure (${fmt(ctx.speed * 3.6, 1)} km/h)` : '';
  return R.sd ? `La plupart des coureurs${allure} : ${fmt(b0, d)} à ${fmt(b1, d)} ${u}` : `Repère de technique : ${fmt(b0)} à ${fmt(b1)} ${u}`;
}

const pos = (x, sc) => Math.max(0, Math.min(100, (x - sc[0]) / (sc[1] - sc[0]) * 100));
function mesuresHTML(prof, exercices) {
  const ty = typique(prof.map((p) => p.metrics)), n = prof.length;
  const pisteDe = (k) => exercices.findIndex((x) => x.vise.includes(k));
  let h = '';
  for (const [g, keys] of GROUPES) {
    const pourInfo = keys.every((k) => REPERES[k].nature === 'aucun');
    h += pourInfo ? `<details class="grpinfo"><summary class="grp">${g}</summary>` : `<h3 class="grp">${g}</h3>`;
    for (const k of keys) {
      const R = REPERES[k], d = DEC[k] ?? 0, v = ty[k], u = R.unit, st = statut(k, v, ty), b = R.nature === 'aucun' ? null : bande(R, ty);
      const bl = bandeLarge(k, ty)?.map((x) => Math.max(R.sc[0], Math.min(R.sc[1], x))), piste = pisteDe(k);
      const vals = prof.map((p) => p.metrics[k]).filter(Number.isFinite);
      const rk = { heel_hip_pct: 'heel_hip_cm' }[k] ?? k;
      const r0 = prof[0].metrics.ranges?.[rk];
      const spread = n > 1 && vals.length ? `médiane de ${n} passages, de ${fmt(Math.min(...vals), d)} à ${fmt(Math.max(...vals), d)} ${u}`
        : r0 && k !== 'heel_hip_pct' ? `tes ${prof[0].metrics.nSteps} appuis : de ${fmt(r0[0])} à ${fmt(r0[1])} ${u}` : '1 passage';
      const extra = R.classes && Number.isFinite(v) ? ` <span>${classe(R, v)}</span>` : k === 'heel_hip_pct' ? ` <span>soit ${fmt(ty.heel_hip_cm)} cm</span>` : '';
      const rows = prof.map((p, i) => {
        const r = p.metrics.ranges?.[rk];
        return `<tr><td>Passage ${i + 1}</td><td class="num">${pace(p.metrics.pace)}/km</td><td class="num">${fmt(p.metrics[k], d)} ${u}</td>${k !== 'heel_hip_pct' ? `<td class="num muted">${r ? `${fmt(r[0])} à ${fmt(r[1])} ${u}` : ''}</td>` : ''}</tr>`;
      }).join('');
      // une ligne par mesure ; le détail (passages, source, fiabilité) ne s'ouvre d'office que hors repère
      h += `<details class="metric" id="m-${k}"${st === 'hors' || st === 'loin' ? ' open' : ''}><summary>
        <div class="name"><h4>${R.label} ${info(`<p>${R.what}</p><p class="muted">${spread[0].toUpperCase() + spread.slice(1)}.</p>`, `Ce que mesure : ${R.label}`)} ${chip(st, libelle(k, st, v, ty))}</h4>
        <div class="vals"><b>${fmt(v, d)} ${u}</b>${extra}${piste >= 0 ? ` <a href="#piste-${piste + 1}" class="see">voir la piste ${piste + 1}</a>` : ''}</div></div>
        <div><div class="gauge" role="img" aria-label="${R.label} : ${fmt(v, d)} ${u}. ${repereTexte(R, d, ty)}"><div class="track"></div>
        ${bl ? `<div class="bandl" style="left:${pos(bl[0], R.sc)}%;width:${pos(bl[1], R.sc) - pos(bl[0], R.sc)}%"></div>` : ''}
        ${b ? `<div class="bandz" style="left:${pos(b[0], R.sc)}%;width:${pos(b[1], R.sc) - pos(b[0], R.sc)}%"></div>` : ''}
        ${n > 1 ? vals.map((x) => `<div class="pt" style="left:${pos(x, R.sc)}%"></div>`).join('') : ''}
        ${Number.isFinite(v) ? `<div class="dot ${CLASSE[st]}" style="left:${pos(v, R.sc)}%"></div>` : ''}
        <div class="ticks"><span>${fmt(R.sc[0])}</span><span>${fmt(R.sc[1])} ${u}</span></div></div>
        <p class="rel">${repereTexte(R, d, ty)}${n > 1 ? ' · un trait = un passage' : ''}</p></div></summary>
        <div class="more"><div>${PHOTO[k] ? `<figure class="mphoto"><canvas width="420" height="420" data-k="${k}"></canvas><figcaption></figcaption></figure>` : ''}${n > 1 ? `<div class="tablewrap"><table><thead><tr><th>Passage</th><th>Allure</th><th>Valeur</th>${k !== 'heel_hip_pct' ? '<th>Plage des appuis</th>' : ''}</tr></thead><tbody>${rows}</tbody></table></div>` : ''}</div>
        <div><p class="ref">${R.ref}</p><p class="rel">Fiabilité ${R.fiabilite}</p></div></div></details>`;
    }
    if (pourInfo) h += '</details>';
  }
  return h;
}

function frontalHTML(p) {
  const m = p.metrics ?? {}, e = etat(p), titre = `<h3>${VUES[p.kind]} · ${fmt(p.t0, 1)}–${fmt(p.t1, 1)} s</h3>`;
  const hid = m.masked ? `${m.masked} appui${m.masked > 1 ? 's' : ''} ignoré${m.masked > 1 ? 's' : ''} : jambes mal visibles (obstacle, sortie du cadre).` : '';
  if (e === 'jambes confondues') return `${titre}<p class="empty">Passage non chiffré : le modèle confond les jambes (${m.confused} appuis détectés en même temps que l'autre pied, ce qui est impossible en course). Filme téléphone à hauteur de hanche et arrête-toi à 10–15 m.</p>`;
  if (e !== 'exploitable') return `${titre}<p class="empty">${hid || 'Aucun appui repéré sur ce passage : pieds masqués ou coureur trop loin.'}</p>`;
  const back = p.kind === 'dos';
  const warn = m.obliqueWarn ? '<p class="note">Le coureur se déplace de biais par rapport à la caméra : largeur d\'appui, bassin et genou sont faussés par la perspective. Mesures indicatives seulement.</p>' : '';
  const rows = m.contacts.map((c) => `<tr><td>${c.side}</td><td class="num">${fmt(c.f0)}–${fmt(c.f1)}</td><td class="num">${fmt(c.lateral)} %</td><td>${c.lateral < 0 ? 'croise' : 'de son côté'}</td>${back ? `<td class="num">${fmt(c.drop, 1)}°</td>` : ''}</tr>`).join('');
  const cotes = [m.drop.gauche, m.drop.droite].filter(Number.isFinite), sd = statut('drop', cotes.length ? Math.max(...cotes) : NaN);
  return `${titre.replace('</h3>', ` ${info(`Pied / ligne médiane : position du talon par rapport au milieu du bassin, en % de la largeur du bassin (négatif = le pied croise la ligne), sans moyenne publiée. ${back ? `Inclinaison latérale du bassin : ${REPERES.drop.ref} Inclinaison de caméra estimée et retirée : ${fmt(m.roll, 1)}°.` : 'De face, le bassin n\'est pas chiffré : filme de dos pour l\'obtenir.'}`, 'Comment lire cette vue')}</h3>`)}${warn}${hid ? `<p class="note">${hid}</p>` : ''}
  <p>Pied par rapport à la ligne médiane : <b>${fmt(m.lateralMed)} %</b> de la largeur du bassin (médiane) · <b>${m.crossings}</b> appui${m.crossings > 1 ? 's' : ''} sur ${m.contacts.length} croise${m.crossings > 1 ? 'nt' : ''} la ligne.${back ? ` Inclinaison latérale du bassin : gauche <b>${fmt(m.drop.gauche, 1)}°</b>, droite <b>${fmt(m.drop.droite, 1)}°</b> ${m.obliqueWarn ? '' : chip(sd, libelle('drop', sd, cotes.length ? Math.max(...cotes) : NaN))}.` : ''}</p>
  <details class="fdet"><summary>Détail des ${m.contacts.length} appuis</summary><div class="tablewrap"><table><thead><tr><th>Appui</th><th>Images</th><th>Pied / ligne médiane</th><th></th>${back ? '<th>Bassin</th>' : ''}</tr></thead><tbody>${rows}</tbody></table></div></details>
`;
}

// qualité du tournage : repliée si tout va bien, ouverte s'il y a quelque chose à changer
function qualiteHTML(a) {
  const q = qualite(a), ko = q.filter((x) => !x.ok);
  return `<details class="quality" id="tournage"><summary>${ko.length ? `Tournage : ${ko.length} point${ko.length > 1 ? 's' : ''} à améliorer pour la prochaine vidéo` : 'Tournage : rien à redire'}</summary>
    <ul>${q.map((x) => `<li class="${x.ok ? 'qok' : 'qko'}">${x.texte}${x.conseil ? `<span>${x.conseil}</span>` : ''}</li>`).join('')}</ul></details>`;
}

// « À retenir » : calculé par bilan(), seulement mis en forme ici
function retenirHTML(a, r) {
  const ko = qualite(a).filter((x) => !x.ok).length;
  const lignes = [
    r.aucunProfil ? '<li class="r-fait"><b>Pas de mesure de profil</b> : aucun passage de profil exploitable. Les mesures principales (cadence, contact, attaque du pied) manquent.</li>'
      : r.principal ? `<li class="r-fait"><b>${r.principal.t}.</b> ${r.principal.d}</li>`
      : '<li class="r-fait"><b>Rien de marquant</b> : tes mesures de profil sont proches des repères publiés.</li>',
    r.action ? `<li class="r-action">→ <b>Essaie :</b> <a href="#piste-1" class="see">${r.action.t.replace(/^./, (c) => c.toLowerCase())}</a>.</li>` : '',
    r.moyenne.length ? `<li>Dans la moyenne : ${r.moyenne.join(', ')}.</li>` : '',
    r.resume ? `<li class="muted">Allure ${pace(r.resume.pace)} /km · cadence ${fmt(r.resume.cadence)} pas/min · contact ${fmt(r.resume.contact)} ms · ${r.appuis}</li>` : '',
    `<li class="muted">${ko ? `Tournage : ${ko} conseil${ko > 1 ? 's' : ''} pour la prochaine vidéo` : 'Tournage : rien à redire'} · <a href="#tournage" class="see">voir</a></li>`,
  ];
  return `<section id="retenir" class="retenir"><h2>À retenir</h2><ul>${lignes.join('')}</ul></section>`;
}

// ---------- rapport ----------
// actions : { show(vue), supprimer(a) }
export async function afficherRapport(a, actions) {
  actions.show('report');
  const prof = profils(a), fr = frontaux(a);
  const { constats, exercices, retenir } = bilan(a);
  nBulles = 0;
  const d = new Date(a.videoDate || a.date);
  const title = a.label || `Analyse du ${d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}`;
  const R = $('#report');
  R.innerHTML = `<div class="rep">
  <header>
    <h1>${esc(title)}</h1>
    <div class="meta"><span>Coureur <b>${fmt(a.height * 100)} cm${a.weight ? ` · ${fmt(a.weight)} kg` : ''}</b></span><span>Vidéo <b>${esc(a.videoName)}</b></span><span><b>${a.passes.length}</b> passage${a.passes.length > 1 ? 's' : ''} repéré${a.passes.length > 1 ? 's' : ''}</span></div>
    <nav class="toc noprint" aria-label="Sommaire du rapport"><a href="#bref">En bref</a>${exercices.length ? '<a href="#plan">Pistes d\'entraînement</a>' : ''}<a href="#mesures">Mesures</a>${fr.length ? '<a href="#frontal">Face / dos</a>' : ''}<a href="#lecteur">Lecteur</a><a href="#methode">Méthode</a></nav>
    <div class="actions noprint"><button class="btn small" id="print">Imprimer ou PDF</button><button class="btn ghost" id="exp">Exporter (JSON)</button><button class="btn ghost" id="again">Nouvelle analyse</button></div>
    ${a.fpsNote ? `<p class="note">${esc(a.fpsNote)}</p>` : ''}
    ${a.recalcule ? '<p class="note">Mesures recalculées avec la version actuelle de l\'analyse.</p>' : ''}
  </header>
  ${retenirHTML(a, retenir)}
  <section id="bref"><h2>En bref</h2><ul class="prio">${constats.filter((c) => c !== retenir.principal).map((c) => `<li>${chip(c.st, c.label ?? LIBELLES[c.st])}<h4>${c.t}</h4><p>${c.d}${c.cle ? ` <a href="#${c.cle === 'frontal' ? 'frontal' : `m-${c.cle}`}" class="see">Voir la mesure</a>` : ''}</p></li>`).join('')}</ul></section>
  ${exercices.length ? `<section id="plan"><h2>Pistes d'entraînement</h2><div class="plan">${exercices.map((x, i) => `<article id="piste-${i + 1}"><h4>${x.t}</h4><ul>${x.li.map((l) => `<li>${l}</li>`).join('')}</ul><p class="why">Pourquoi ? ${info(`<p>${x.why}</p>${x.sources ? `<p class="src">Sources : ${x.sources.map(source).join(' · ')}</p>` : ''}`, 'Pourquoi cette piste')}</p></article>`).join('')}</div></section>` : ''}
  <section id="passages"><details class="fdet"><summary>Détail des ${a.passes.length} passages repérés</summary><div class="tablewrap"><table><thead><tr><th>Passage</th><th>Images analysées</th><th class="num">Allure</th><th class="num">Cadence</th><th class="num">Pas</th><th class="num">Contact · vol</th><th>Appuis</th></tr></thead><tbody>${a.passes.map((p, i) => {
    const m = p.metrics || {}, e = etat(p), run = p.kind === 'profil' && e === 'exploitable';
    const app = e === 'exploitable' ? `${p.kind === 'profil' ? m.nSteps : m.contacts.length}` : ETATS[e];
    return `<tr><td><b>${i + 1}. ${VUES[p.kind]}</b> <span class="muted">${fmt(p.t0, 1)}–${fmt(p.t1, 1)} s</span></td><td>${p.frames.filter((f) => f.lm).length}/${p.frames.length}</td>
      <td class="num">${run ? `<span class="big">${pace(m.pace)}</span> /km` : '—'}</td><td class="num">${run ? `<span class="big">${fmt(m.cadence)}</span> pas/min` : '—'}</td>
      <td class="num">${run ? `${fmt(m.step_len, 2)} m` : '—'}</td><td class="num">${run ? `${fmt(m.contact_ms)} · ${fmt(m.flight_ms)} ms` : '—'}</td><td>${app}</td></tr>`;
  }).join('')}</tbody></table></div></details>${qualiteHTML(a)}</section>
  ${prof.length ? `<section id="mesures"><h2>Mesures de profil ${info('<p>Clique sur une mesure pour voir ta photo, le repère publié et la fiabilité.</p><p><b>Dans la moyenne</b> : comme la plupart des coureurs de référence (à ± 1 écart-type). <b>Plus haut / plus bas que la moyenne</b> : au-delà, une fois prise en compte la marge de mesure ; en vert si ce côté ne pose pas question. <b>Bien plus</b> : au-delà de 2 écarts-types. <b>Proche</b> : hors de la plage, mais dans la marge de mesure.</p>', 'Comment lire les mesures')}</h2>${mesuresHTML(prof, exercices)}</section>` : '<section id="mesures"><h2>Mesures de profil</h2><p class="empty">Aucun passage de profil exploitable. Il faut 3 passages de profil d\'au moins 2 s, pieds visibles en entier, téléphone fixe à 3–4 m de la ligne de course. <a href="#" class="see" data-view="new">Revoir comment filmer</a></p></section>'}
  ${a.passes.some((p) => p.kind !== 'profil') ? `<section id="frontal"><h2>Vue de face / de dos</h2>${a.passes.filter((p) => p.kind !== 'profil').map(frontalHTML).join('')}</section>` : ''}
  <section id="lecteur" class="noprint"><details class="fdet"><summary>Lecteur image par image (pour les curieux)</summary><div class="player">
    <canvas id="pc" width="576" height="576" aria-label="Image analysée avec le squelette"></canvas>
    <div class="pcontrols">
      <label>Passage<select id="psel">${a.passes.map((p, i) => `<option value="${i}">${i + 1}. ${VUES[p.kind]} (${fmt(p.t0, 1)}–${fmt(p.t1, 1)} s)</option>`).join('')}</select></label>
      <input id="prange" type="range" min="0" value="0" aria-label="Position dans le passage">
      <div class="prow"><button class="btn small" id="pplay">Lecture</button><button class="btn ghost" id="pprev" aria-label="Image précédente">◀ image</button><button class="btn ghost" id="pnext" aria-label="Image suivante">image ▶</button><button class="btn ghost" id="pic">Contact suivant</button>
        <select id="pspeed" aria-label="Vitesse"><option value="0.25">×1/4</option><option value="0.1">×1/10</option><option value="1">×1</option></select></div>
      <div class="readout" id="pread"></div>
      <p class="muted small">Couleurs du squelette ${info('Jaune : côté que le modèle étiquette gauche ; bleu : droit. De profil, le modèle confond parfois les deux jambes.', 'Couleurs du squelette')}</p>
    </div></div></details></section>
  <section id="methode"><p class="muted small"><b>Outil d'aide à la technique de course, pas un dispositif médical</b> : il ne remplace pas l'avis d'un professionnel.</p>
    <details class="fdet"><summary>Méthode, limites et sources</summary>
    <p>Le coureur est repéré par soustraction du fond (caméra fixe), recadré puis analysé image par image par MediaPipe Pose (33 points). Un appui de profil est détecté quand la pointe du pied reste immobile dans l'image ; contact initial = arrêt du talon, décollage = départ de la pointe. L'échelle vient de la longueur cuisse + jambe estimée à 49,1 % de la taille (tables de Winter). Les angles 2D sans marqueurs ont une erreur de quelques degrés, plus grande au pied et quand les jambes se croisent ; MediaPipe n'a pas été validé contre une capture 3D en course.</p>
    <p>Les repères sont pour la plupart des moyennes de groupe mesurées en 3D, souvent sur tapis : ce sont des points de comparaison, pas des normes. « Plus haut / plus bas que la moyenne » : au-delà d'un écart-type de la moyenne publiée, écart-type combiné à la marge de mesure (désaccord observé entre deux modèles de pose) ; « bien plus » : au-delà de deux ; « proche » : hors de la plage publiée mais dans la marge. Temps de contact, part au sol et cadence sont comparés à la moyenne attendue à ton allure (Malisoux 2023, de 7 à 15 km/h). Les seuils propres à l'appli sont signalés comme indicatifs.</p>
    <p class="muted">Sources des repères : Malisoux et al. 2023 (OJSM) ; Lieberman et al. 2015 (J Exp Biol) ; Altman & Davis 2012 (Gait Posture) ; Barrett et al. 2023 (IJSPT) ; Teng & Powers 2014 (JOSPT) ; Souza 2016 ; Dingenen et al. 2018, pour la fiabilité de la mesure 2D. Les sources des exercices sont citées avec chacun.</p>
    <p class="muted">Détails techniques : ${a.size[0]}×${a.size[1]}, ${fmt(a.fps, 2)} i/s, ${fmt(a.duration, 0)} s · modèle ${a.model} (${a.delegate})${a.decoder ? ` · décodage ${a.decoder === 'webcodecs' ? 'WebCodecs' : 'par sauts'}` : ''} · version d'analyse ${a.algo ?? 1} · analysé le ${new Date(a.date).toLocaleString('fr-FR')}</p></details>
    <div class="actions noprint"><button class="btn ghost" id="del">Supprimer cette analyse</button></div></section>
  </div>`;
  // un clic dans une bulle (hors lien) ne doit pas replier la mesure dont elle fait partie
  R.onclick = (e) => { if (e.target.closest('.tip') && !e.target.closest('a')) e.preventDefault(); };
  if (!('popover' in HTMLElement.prototype)) {
    // navigateur sans popover : l'icône déplie la bulle sous elle
    R.classList.add('sans-popover');
    R.querySelectorAll('.info').forEach((b) => b.addEventListener('click', (e) => { e.preventDefault(); document.getElementById(b.getAttribute('popovertarget'))?.classList.toggle('ouverte'); }));
  }
  $('#exp').onclick = () => exporterJSON(a);
  $('#print').onclick = () => { R.querySelectorAll('details.metric').forEach((x) => { x.open = true; }); print(); };
  // liens internes : défilement doux, et la mesure visée s'ouvre
  R.querySelectorAll('a[href^="#"]').forEach((l) => l.addEventListener('click', (e) => {
    e.preventDefault();
    if (l.dataset.view) return actions.show(l.dataset.view);
    const t = R.querySelector(l.getAttribute('href')); if (!t) return;
    if (t.tagName === 'DETAILS') t.open = true;
    t.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
  }));
  if (a.legacy) {
    $('#del').replaceWith(Object.assign(document.createElement('p'), { className: 'muted', textContent: 'Analyse enregistrée avec une version précédente : Chrome plante si on la supprime seule. Pour la retirer, utilise « Effacer tout l\'historique » dans l\'Historique.' }));
  } else {
    $('#del').onclick = () => {
      if (a.unsaved) return actions.show('new');
      $('#del').textContent = 'Confirmer : supprimer définitivement';
      $('#del').onclick = async () => { $('#del').disabled = true; $('#del').textContent = 'Suppression…'; await actions.supprimer(a); };
    };
  }
  $('#again').onclick = () => actions.show('new');
  lecteur(a);
  await photosMesures(a, prof);
}

// photo de chaque mesure : l'appui le plus proche de la valeur retenue (médiane), pas le pire
async function photosMesures(a, prof) {
  const ty = typique(prof.map((p) => p.metrics));
  for (const c of document.querySelectorAll('.mphoto canvas')) {
    const k = c.dataset.k; let best = null;
    for (const p of prof) for (const ap of appuis(p)) {
      const d = Math.abs(ap.mesures[k] - ty[k]), f = p.frames.find((x) => x.f === ap.debut);
      if (f?.lm && Number.isFinite(d) && (!best || d < best.d)) best = { d, p, ap, f };
    }
    if (!best) { c.closest('figure').remove(); continue; }
    const st = statut(k, ty[k], ty), col = css({ ok: '--ok', hors: '--warn', loin: '--bad' }[st] ?? '--na');
    await drawTarget(c, best.f, k, best.ap.mesures[k], best.p.dir, col);
    c.nextElementSibling.textContent = `Couleur : ${PHOTO[k]} · vert : le repère · ton appui le plus habituel (passage ${a.passes.indexOf(best.p) + 1})`;
  }
}

// un seul lecteur à la fois : le minuteur d'un rapport précédent continuerait d'écrire dans le nouveau
let timer = null;
function lecteur(a) {
  clearInterval(timer); timer = null;
  const c = $('#pc'), ctx = c.getContext('2d'), S = c.width;
  let pi = 0, i = 0;
  const range = $('#prange'), read = $('#pread');
  const enAppui = (p, f) => appuis(p).some((s) => f >= s.debut && f <= s.fin);
  const kneeAng = (lm, s) => { const h = lm[23 + s], k = lm[25 + s], an = lm[27 + s]; const u = [h[0] - k[0], h[1] - k[1]], w = [an[0] - k[0], an[1] - k[1]]; return 180 - Math.acos((u[0] * w[0] + u[1] * w[1]) / Math.hypot(...u) / Math.hypot(...w)) * 180 / Math.PI; };
  async function draw() {
    const p = a.passes[pi], fr = p.frames[i]; if (!fr) return;
    await drawFrame(ctx, fr, S, { label: `${VUES[p.kind]} · image ${fr.f}`, stance: enAppui(p, fr.f) });
    range.value = i;
    read.innerHTML = `Temps <b>${fmt(fr.f / a.fps, 2)} s</b> · image <b>${i + 1}/${p.frames.length}</b>` + (fr.lm ? `<br>Flexion genou (étiquettes modèle) G <b>${fmt(kneeAng(fr.lm, 0))}°</b> · D <b>${fmt(kneeAng(fr.lm, 1))}°</b>` : '<br>Pas de pose détectée sur cette image');
  }
  const stop = () => { clearInterval(timer); timer = null; $('#pplay').textContent = 'Lecture'; };
  // ouvre sur le premier contact (à défaut, la première pose) plutôt que sur l'entrée dans le champ
  const premier = () => { const p = a.passes[pi], f0 = appuis(p)[0]?.debut;
    return Math.max(0, p.frames.findIndex((x) => (f0 !== undefined ? x.f === f0 : x.lm))); };
  $('#psel').onchange = (e) => { stop(); pi = Number(e.target.value); i = premier(); range.max = a.passes[pi].frames.length - 1; draw(); };
  range.max = a.passes[0].frames.length - 1; i = premier();
  range.oninput = () => { stop(); i = Number(range.value); draw(); };
  $('#pprev').onclick = () => { stop(); i = Math.max(0, i - 1); draw(); };
  $('#pnext').onclick = () => { stop(); i = Math.min(a.passes[pi].frames.length - 1, i + 1); draw(); };
  $('#pic').onclick = () => {
    stop(); const p = a.passes[pi], debuts = appuis(p).map((s) => s.debut);
    const f = p.frames[i].f, nx = debuts.find((x) => x > f) ?? debuts[0];
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

function exporterJSON(a) {
  const clean = { ...a, passes: a.passes.map(({ frames, ...p }) => ({ ...p, landmarks: frames.map((f) => ({ f: f.f, lm: f.lm })) })) };
  const blob = new Blob([JSON.stringify(clean)], { type: 'application/json' });
  const url = URL.createObjectURL(blob), link = document.createElement('a');
  link.href = url; link.download = `foulee-${new Date(a.videoDate || a.date).toISOString().slice(0, 10)}.json`; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
