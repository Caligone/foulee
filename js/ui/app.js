// Interface : navigation, formulaire et suivi de l'analyse, historique et comparaison.
import { analyser, ETAPES } from '../pipeline.js';
import { ALGO, aJour, profils } from '../domaine/analyse.js';
import { REPERES, typique, comparer } from '../domaine/reperes.js';
import { saveAnalysis, listAnalyses, getAnalysis, deleteAnalysis, deleteAll } from '../infra/stockage.js';
import { afficherRapport, CLASSE } from './rapport.js';
import { fmt, pace, esc } from '../format.js';

const $ = (s) => document.querySelector(s);
const params = new URLSearchParams(location.search);
let file = null, enCours = null; // enCours : AbortController de l'analyse en cours

// ---------- navigation ----------
function show(view) {
  for (const v of ['new', 'run', 'report', 'history']) $(`#view-${v}`).hidden = v !== view;
  document.querySelectorAll('.tab').forEach((t) => t.toggleAttribute('aria-current', t.dataset.view === view));
  if (view === 'history') renderHistory();
  // seul l'historique a son adresse (#historique) : les autres vues dépendent d'une vidéo ou d'une analyse ouverte
  const url = view === 'history' ? '#historique' : location.pathname + location.search;
  if ((location.hash === '#historique') !== (view === 'history')) history.pushState(null, '', url);
  window.scrollTo(0, 0);
}
document.querySelectorAll('.tab').forEach((t) => t.addEventListener('click', () => { if (!enCours) show(t.dataset.view); }));
const route = () => { if (enCours) return; if (location.hash === '#historique') show('history'); else if (!$('#view-history').hidden) show('new'); };
addEventListener('popstate', route); route();

const rapport = (a) => afficherRapport(a, {
  show,
  supprimer: async (x) => { await deleteAnalysis(x.id); show('history'); },
});

// ---------- formulaire ----------
const drop = $('#drop');
function setFile(f) { file = f; $('#file-name').textContent = f ? `${f.name} · ${(f.size / 1e6).toFixed(1)} Mo` : ''; $('#go').disabled = !f; }
$('#file').addEventListener('change', (e) => setFile(e.target.files[0]));
['dragenter', 'dragover'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add('over'); }));
['dragleave', 'drop'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove('over'); }));
drop.addEventListener('drop', (e) => { const f = e.dataTransfer.files[0]; if (f) setFile(f); });
try { const s = JSON.parse(localStorage.getItem('foulee-profile') || '{}'); if (s.h) $('#height').value = s.h; if (s.w) $('#weight').value = s.w; } catch {}
$('#form').addEventListener('submit', (e) => { e.preventDefault(); run().catch(fail); });
$('#cancel').addEventListener('click', () => enCours?.abort());

function stepUI(i, msg) {
  $('#steps').innerHTML = ETAPES.map((s, k) => `<li class="${k < i ? 'done' : k === i ? 'active' : ''}">${s}</li>`).join('');
  if (msg !== undefined) $('#run-msg').textContent = msg;
}
const bar = (x) => { $('#bar').style.width = `${Math.round(x * 100)}%`; };
function fail(err) {
  console.error(err); enCours = null; show('new');
  const el = $('#form-err'); el.hidden = false; el.textContent = err.message || String(err);
}

async function run() {
  if (!file || enCours) return;
  enCours = new AbortController();
  $('#form-err').hidden = true; show('run'); bar(0);
  try { localStorage.setItem('foulee-profile', JSON.stringify({ h: $('#height').value, w: $('#weight').value })); } catch {}
  const live = $('#live').getContext('2d');
  let vues = 0;
  const a = await analyser(file, {
    height: Number($('#height').value) / 100, weight: Number($('#weight').value) || null,
    fps: Number($('#fps').value) || null, label: $('#label').value.trim(), modelUrl: params.get('model') ?? undefined,
  }, {
    signal: enCours.signal, onStep: stepUI, onProgress: bar,
    onFrame: (x, crop, lm, X0, Y0, side) => {
      if (vues++ % 2) return; // aperçu une image sur deux
      live.drawImage(crop, 0, 0, 384, 384);
      if (lm) { live.fillStyle = '#f0b93a'; for (const q of lm.slice(11)) { live.beginPath(); live.arc((q[0] - X0) / side * 384, (q[1] - Y0) / side * 384, 3, 0, 7); live.fill(); } }
    },
  });
  enCours = null;
  try { await saveAnalysis(a); } catch (e) { console.warn('sauvegarde impossible', e); a.unsaved = true; }
  window.__lastAnalysis = a;
  await rapport(a);
}

// ---------- historique ----------
const ignorees = new Set(); // analyses anciennes impossibles à réenregistrer (voir stockage.js)
async function mettreAJour(list) {
  // les mesures d'une version antérieure sont recalculées depuis les points de pose, une fois pour toutes
  const vieilles = list.filter((x) => (x.algo ?? 1) !== ALGO && !ignorees.has(x.id));
  for (const x of vieilles) {
    const a = await getAnalysis(x.id);
    if (!a || a.legacy) { ignorees.add(x.id); continue; }
    const { legacy, recalcule, ...b } = aJour(a);
    await saveAnalysis(b);
  }
  return vieilles.length > 0;
}

// comparaison de deux analyses : mêmes valeurs que le rapport (médiane des passages de profil)
const SENS = { mieux: 'up', 'moins bien': 'down', stable: 'same', 'sans repère': 'same' };
function compareHTML(apres, avant) {
  const pa = profils({ passes: apres.summary }), pb = profils({ passes: avant.summary });
  if (!pa.length || !pb.length) return '<p class="empty">Il faut un passage de profil exploitable dans chacune des deux analyses.</p>';
  const A = typique(pa.map((p) => p.metrics)), B = typique(pb.map((p) => p.metrics));
  const ordre = { 'moins bien': 0, mieux: 1, stable: 2, 'sans repère': 3 };
  const lignes = comparer(B, A).sort((x, y) => ordre[x.verdict] - ordre[y.verdict]);
  const n = (v) => lignes.filter((l) => l.verdict === v).length;
  const d = (k) => (k === 'vosc_cm' ? 1 : 0);
  const val = (k, v, st) => `<span class="chip ${CLASSE[st]}">${fmt(v, d(k))} ${REPERES[k].unit}</span>`;
  const dp = Math.abs(A.pace - B.pace);
  return `<p class="cmpsum"><b class="trend up">${n('mieux')} mieux</b> · <b class="trend down">${n('moins bien')} moins bien</b> · <b class="trend same">${n('stable')} stables</b></p>
    <p class="muted">Allure médiane : ${pace(B.pace)} → ${pace(A.pace)} min/km.${dp > 0.3 ? ' Allures assez différentes : la cadence, le contact et l\'angle du pied changent avec la vitesse, compare plutôt deux vidéos à la même allure.' : ''} « Stable » : écart plus petit que la marge de mesure, ou mesure dans le repère les deux fois.</p>
    <div class="tablewrap"><table><thead><tr><th>Mesure</th><th>Avant</th><th>Après</th><th>Écart</th><th></th></tr></thead><tbody>${lignes.map((l) => `<tr><td>${REPERES[l.k].label}</td><td>${val(l.k, l.avant, l.statutAvant)}</td><td>${val(l.k, l.apres, l.statutApres)}</td><td class="num">${l.diff >= 0 ? '+' : ''}${fmt(l.diff, d(l.k))}</td><td><b class="trend ${SENS[l.verdict]}">${l.verdict[0].toUpperCase() + l.verdict.slice(1)}</b></td></tr>`).join('')}</tbody></table></div>`;
}

async function renderHistory() {
  const H = $('#history');
  let list = [];
  try {
    list = await listAnalyses();
    if (await mettreAJour(list)) list = await listAnalyses();
  } catch (e) { H.innerHTML = `<p class="empty">Historique indisponible dans ce navigateur (${esc(e.message)}).</p>`; return; }
  if (!list.length) { H.innerHTML = '<p class="empty">Aucune analyse enregistrée pour l\'instant.</p>'; return; }
  const row = (x) => {
    const ms = profils({ passes: x.summary }).map((p) => p.metrics);
    const j = (k, d = 0) => ms.map((m) => fmt(m[k], d)).join(' · ') || '—';
    const kinds = x.summary.map((p) => p.kind[0].toUpperCase()).join('');
    return `<tr class="clickable" data-id="${x.id}" tabindex="0"><td>${new Date(x.videoDate || x.date).toLocaleDateString('fr-FR')}</td><td>${esc(x.label || x.videoName)}</td><td>${kinds}</td>
      <td class="num">${ms.map((m) => pace(m.pace)).join(' · ') || '—'}</td><td class="num">${j('cadence')}</td><td class="num">${j('contact_ms')}</td><td class="num">${j('shank_deg')}</td><td class="num">${j('heel_hip_pct')}</td><td class="num">${j('trunk')}</td></tr>`;
  };
  const dateOf = (x) => `${new Date(x.videoDate || x.date).toLocaleDateString('fr-FR')}${x.label ? ` · ${esc(x.label)}` : ''}`;
  const opts = (sel) => list.map((x, i) => `<option value="${i}"${i === sel ? ' selected' : ''}>${dateOf(x)}</option>`).join('');
  const cmp = list.length > 1 ? `<section class="card compare"><h2>Comparer deux analyses</h2>
    <div class="row"><label>Avant<select id="cmpb">${opts(1)}</select></label><label>Après<select id="cmpa">${opts(0)}</select></label></div><div id="cmpout"></div></section>` : '';
  const vieilles = list.filter((x) => (x.algo ?? 1) !== ALGO).length;
  H.innerHTML = `${cmp}${vieilles ? `<p class="note">${vieilles} analyse${vieilles > 1 ? 's' : ''} enregistrée${vieilles > 1 ? 's' : ''} avec une version précédente : leurs mesures ne sont recalculées qu'à l'ouverture du rapport.</p>` : ''}
    <div class="tablewrap"><table><thead><tr><th>Date</th><th>Libellé</th><th>Vues</th><th>Allure</th><th>Cadence</th><th>Contact ms</th><th>Tibia °</th><th>Talon/bassin %</th><th>Buste °</th></tr></thead><tbody>${list.map(row).join('')}</tbody></table></div>
    <p class="muted">Vues : P = profil, F = face, D = dos. Clique sur une ligne pour rouvrir le rapport.</p>
    <div class="actions"><button class="btn ghost" id="delall">Effacer tout l'historique</button></div>`;
  if (cmp) { const upd = () => { $('#cmpout').innerHTML = compareHTML(list[$('#cmpa').value], list[$('#cmpb').value]); }; $('#cmpa').onchange = $('#cmpb').onchange = upd; upd(); }
  $('#delall').onclick = () => {
    $('#delall').textContent = `Confirmer : effacer les ${list.length} analyses`;
    $('#delall').onclick = async () => { $('#delall').disabled = true; await deleteAll(); ignorees.clear(); renderHistory(); };
  };
  H.querySelectorAll('tr.clickable').forEach((tr) => {
    const open = async () => { const a = await getAnalysis(tr.dataset.id); if (a) rapport(aJour(a)); };
    tr.addEventListener('click', open); tr.addEventListener('keydown', (e) => { if (e.key === 'Enter') open(); });
  });
}

if (params.get('autotest')) {
  // mode test : analyse un fichier servi localement
  const r = await fetch(params.get('autotest')); setFile(new File([await r.blob()], params.get('autotest').split('/').pop()));
  run().then(() => { window.__done = true; }).catch((e) => { window.__done = true; window.__err = String(e.stack || e); fail(e); });
}
