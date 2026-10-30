Tu reprends **Foulée**, une app web d'analyse de foulée à partir d'une vidéo de course, 100 % locale dans le navigateur. Le dépôt git est dans `foulee/` (décompressé depuis `foulee-repo.zip`) : un commit sur `main`, à mon nom. Le dépôt GitHub `Caligone/foulee` existe, privé et vide.

## Le projet
- Vanilla JS en modules ES, **aucune étape de build**. MediaPipe Tasks Vision 0.10.14 (PoseLandmarker) en WebAssembly. Interface en français.
- `serveur.py` : serveur sur 127.0.0.1:8777. Au premier lancement, il télécharge MediaPipe et les modèles `full`/`heavy` dans `vendor/` (non versionné). Option `--offline` pour ne rien télécharger.
- `js/engine.js` : ouverture vidéo, estimation des i/s (requestVideoFrameCallback), scan en lecture ×4 pour construire un fond médian, soustraction de fond, masque des zones toujours agitées (feuillage), fusion des fragments de corps, suivi temporel, classement des passages (profil / face / dos), puis pose image par image sur un recadrage de 512 px suivi d'une image à l'autre.
- `js/metrics.js` :
  - **Profil** : appuis détectés par immobilité de la pointe du pied dans l'image (indépendant des étiquettes G/D, que MediaPipe inverse de profil). On ne garde que la plus longue portion où les pieds sont visibles (visibilité ≥ 0,85) et on filtre les appuis invraisemblables. Échelle : cuisse + jambe = 0,491 × taille, avec contrôle sur le tronc. Oscillation verticale par ajustement sinusoïdal.
  - **Face / dos** : appuis = pied immobile, côté attribué par la géométrie, chute du bassin corrigée de l'inclinaison caméra (médiane), alerte si la vue est de biais.
- `js/report.js` : repères publiés (Malisoux 2023, Heiderscheit 2011, Lieberman 2015, Altman & Davis 2012, Barrett 2023, Bramah 2018, Teng & Powers 2014, Souza 2016…), statuts, synthèse, plan d'action, dessins.
- `js/store.js` : historique dans IndexedDB.

## À faire, dans l'ordre
1. **Pousser** : `git remote add origin git@github.com:Caligone/foulee.git && git push -u origin main`.
2. **Premier vrai test** : `python3 serveur.py`, puis analyser `IMG_0001.MOV` (iPhone, HEVC, 1080p, 59,94 i/s). Deux points n'ont **jamais été testés** :
   - le téléchargement automatique de `vendor/` ;
   - les **modèles officiels Google**. Les tests ont été faits avec le modèle full de l'ancienne API MediaPipe, ré-empaqueté en `.task`, dans Chromium sans tête.
   
   Vérifier `full` et `heavy`, et le décodage HEVC dans Chrome et dans Safari sur macOS.
3. **Non-régression** : comparer aux valeurs obtenues sur cette vidéo.
   - Passage 1 de profil (~7–11 s, 3,3 m/s) : cadence 165–172, contact ~284 ms, tibia 9–11°, talon devant le bassin 12–16 cm, pied 16–22° (talon).
   - Passage 2 de profil (~48,8–50,4 s, 2,6 m/s) : contact ~317 ms, tibia ~17°, talon devant le bassin 31–33 cm, buste ≈ −5°.
   - Arrivée de face (~49,8–51,6 s), signalée « de biais ».
   
   Ajouter un test Node qui injecte un JSON de points de pose dans `profileMetrics` / `frontalMetrics` et vérifie ces plages.
4. **Robustesse du scan**, réglé sur une seule vidéo : seuils (différence 32, masque d'agitation 0,12, classification `lat` / `grow`). La lecture ×4 saute des images selon la machine. Retirer les champs de débogage renvoyés par `scanVideo` (`cands`, `freq`, `times`).
5. **Vue de dos** : jamais testée faute de vidéo. Je fournirai une vidéo filmée de dos.
6. **Interface en anglais** (i18n simple FR/EN) avant de passer le dépôt en public.
7. En option, **GitHub Pages** : l'app est statique et retombe sur le CDN quand `vendor/` est absent. Vérifier le CORS des modèles hébergés sur storage.googleapis.com.

## Contraintes
- La vidéo ne doit jamais quitter la machine.
- Pas de build ni de framework.
- Garder la licence Apache 2.0 et le NOTICE.
- Chaque nouveau repère doit être sourcé (étude publiée).
- Pas de seuil inventé présenté comme une norme : si c'est une heuristique, l'écrire.
