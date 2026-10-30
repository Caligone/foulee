Tu reprends **Foulée**, une app web d'analyse de foulée à partir d'une vidéo de course, 100 % locale dans le navigateur. Dépôt GitHub `Caligone/foulee` (privé). **Tester dans Chrome** : le navigateur par défaut de la machine est Firefox Developer Edition, plus lent sur le HEVC.

## Le projet
- Vanilla JS en modules ES, **aucune étape de build**. MediaPipe Tasks Vision 0.10.14 (PoseLandmarker) en WebAssembly. Interface en français.
- `serveur.py` : serveur sur 127.0.0.1:8777. Au premier lancement, il télécharge MediaPipe et les modèles `full`/`heavy` dans `vendor/` (non versionné). Option `--offline` pour ne rien télécharger.
- `js/engine.js` : ouverture vidéo, estimation des i/s (requestVideoFrameCallback), scan en lecture ×4 pour construire un fond médian, soustraction de fond, masque des zones toujours agitées (feuillage), fusion des fragments de corps, suivi temporel, classement des passages (profil / face / dos), puis pose image par image sur un recadrage de 512 px suivi d'une image à l'autre.
- `js/metrics.js` :
  - **Profil** : appuis détectés par immobilité de la pointe du pied dans l'image (indépendant des étiquettes G/D, que MediaPipe inverse de profil). On ne garde que la plus longue portion où les pieds sont visibles (visibilité ≥ 0,85) et on filtre les appuis invraisemblables. Échelle : cuisse + jambe = 0,491 × taille, avec contrôle sur le tronc. Oscillation verticale par ajustement sinusoïdal.
  - **Face / dos** : appuis = pied immobile, côté attribué par la géométrie, chute du bassin corrigée de l'inclinaison caméra (médiane), alerte si la vue est de biais.
- `js/report.js` : repères publiés (Malisoux 2023, Heiderscheit 2011, Lieberman 2015, Altman & Davis 2012, Barrett 2023, Bramah 2018, Teng & Powers 2014, Souza 2016…), statuts, synthèse, plan d'action, dessins.
- `js/store.js` : historique dans IndexedDB.

## Fait le 30/10/2026
- Poussé sur `origin/main`. Téléchargement de `vendor/` OK, avec en plus les polices et mp4box. Modèles officiels `full` et `heavy` OK dans Chrome (GPU).
- **Accès aux images** : nouveau `js/frames.js`. WebCodecs + mp4box si le navigateur décode le codec, ce qui donne des images exactes, l'horodatage réel, la cadence lue dans le conteneur et la rotation de la piste appliquée. Sinon, repli sur les sauts dans `<video>` (Firefox + HEVC : pas de HEVC en WebCodecs, ~270 ms par saut).
- **Firefox** : décalait les sous-zones prises par `drawImage(video, sx, sy…)`. On copie maintenant l'image entière, puis on recadre. L'estimation des i/s tient compte des rappels manqués par `requestVideoFrameCallback`.
- UI/UX : marqueurs « vibe code » retirés (petit libellé au-dessus des titres, majuscules à chasse fixe, pastilles, grille de cartes). Polices servies en local.

## À faire, dans l'ordre
1. **Tester d'autres vidéos** (prévu le 31/10) : portrait (rotation 90/270 jamais testée), H.264, 120/240 i/s, Safari.
2. **Vérifier que WebCodecs donne le même résultat d'un lancement à l'autre** (deux analyses `full` dans Chrome), puis écrire le test Node de non-régression (`profileMetrics` / `frontalMetrics` sur un JSON de points). Plages : P1 cadence 165–172, contact ~284 ms, tibia 9–11°, talon devant le bassin 12–16 cm, pied 16–22°.
3. **Passage 2 avec `heavy`** : 1 seul appui détecté, mesures publiées quand même. Les signaler comme non fiables sous 2 ou 3 appuis.
4. Robustesse du scan : seuils (différence 32, masque d'agitation 0,12, `lat` / `grow`). Retirer les champs de débogage de `scanVideo` (`cands`, `freq`, `times`).
5. Vue de dos (vidéo à venir), i18n FR/EN, GitHub Pages (CORS des modèles).

## Contraintes
- La vidéo ne doit jamais quitter la machine.
- Pas de build ni de framework.
- Garder la licence Apache 2.0 et le NOTICE.
- Chaque nouveau repère doit être sourcé (étude publiée).
- Pas de seuil inventé présenté comme une norme : si c'est une heuristique, l'écrire.
