# Foulée

**Analyse de foulée à partir d'une vidéo filmée au téléphone, 100 % dans ton navigateur.**
*Running gait analysis from a phone video, entirely on your machine.*

Foulée repère tes passages devant la caméra, estime ta posture image par image avec [MediaPipe Pose](https://ai.google.dev/edge/mediapipe/solutions/vision/pose_landmarker), puis mesure ta foulée : cadence, temps de contact, attaque du pied, inclinaison du tibia, distance talon–bassin, oscillation verticale, posture, chute du bassin… Chaque mesure est comparée à des repères publiés dans la littérature scientifique, avec son niveau de fiabilité.

La vidéo n'est jamais envoyée nulle part : tout le calcul se fait localement, en WebAssembly.

## Démarrer

Prérequis : Python 3 (déjà présent sur macOS et Linux) et un navigateur récent (Chrome, Edge ou Safari).

```sh
git clone https://github.com/<toi>/foulee.git
cd foulee
python3 serveur.py
```

Ou en double-clic : `Lancer Foulée.command` sur macOS (clic droit › Ouvrir la première fois), `lancer.bat` sous Windows.

Au premier lancement, `serveur.py` télécharge MediaPipe Tasks Vision et le modèle de pose dans `vendor/` (≈ 50 Mo). Ensuite, plus rien ne sort de ta machine : `python3 serveur.py --offline` fonctionne sans connexion. Le serveur n'écoute que sur `127.0.0.1`.

> Les `.MOV` d'iPhone (HEVC) se lisent dans Safari et dans Chrome sur Mac. Ailleurs, exporte en MP4 H.264, ou règle l'iPhone sur Réglages › Appareil photo › Formats › « Le plus compatible ».

## Filmer

1. Téléphone **fixe**, à hauteur de hanche (≈ 1 m), bien vertical.
2. **De profil** : à 3–4 m de ta ligne de course, 2 ou 3 passages d'au moins 1 s dans le champ.
3. **De dos** : dans l'axe, en t'éloignant sur 10–15 m. Indispensable pour la chute du bassin et les genoux.
4. Ta vraie allure, sur sol plat, pieds visibles en entier.
5. **60 images/s** au minimum ; 120 ou 240 améliorent les temps de contact.

Tu peux enchaîner plusieurs vues dans une même vidéo : Foulée sépare automatiquement les passages de profil, de face et de dos.

## Ce qui est mesuré

| Vue | Mesures |
|---|---|
| Profil | allure, cadence, longueur de pas, temps de contact et de vol, part du temps au sol, oscillation verticale du bassin, angle du pied au contact (talon / médio-pied / avant-pied), inclinaison du tibia au contact, distance talon–bassin (overstriding), flexion du genou au contact et en appui, extension de hanche au décollage, inclinaison du buste, angle des coudes |
| Dos | position de chaque pied par rapport à la ligne médiane (croisement), chute controlatérale du bassin (inclinaison de la caméra estimée et retirée), angle du genou dans le plan frontal |
| Face | croisement des appuis (indicatif) |

Le rapport propose aussi un lecteur image par image avec le squelette, des images clés annotées, un plan d'action argumenté, un historique local (IndexedDB) avec comparaison à l'analyse précédente, et un export JSON des mesures et des points de pose.

## Comment ça marche

1. **Repérage** : lecture accélérée de la vidéo, fond médian (caméra fixe), soustraction de fond, suivi du coureur, puis classement des passages (profil / face / dos) d'après le déplacement latéral et l'évolution de la taille apparente.
2. **Pose** : chaque image d'un passage est recadrée autour du coureur puis analysée par MediaPipe Pose Landmarker (33 points).
3. **Appuis** : de profil, un appui est détecté quand la pointe du pied reste immobile dans l'image (la caméra est fixe). Cette méthode ne dépend pas des étiquettes gauche/droite, que le modèle inverse souvent de profil. Le contact initial correspond à l'arrêt du talon, le décollage au départ de la pointe. Les portions où les pieds sont masqués sont écartées.
4. **Échelle** : la longueur cuisse + jambe vaut 49,1 % de la taille (tables anthropométriques de Winter), avec un contrôle de cohérence sur le tronc.

## Limites

- Mesure 2D avec une seule caméra : environ 2 à 5° d'erreur sur les angles de profil, davantage au niveau du pied et quand les jambes se croisent.
- De profil, le côté gauche ou droit de chaque appui n'est pas attribué de façon fiable.
- Une vue de biais fausse les mesures de face et de dos (Foulée le signale).
- Les repères publiés sont surtout des moyennes de groupe mesurées en 3D, pas des seuils de blessure. Ce n'est pas un bilan médical.

## Références

Malisoux et al. 2023 (OJSM) · Heiderscheit et al. 2011 (MSSE) · Lieberman et al. 2015 (J Exp Biol) · Altman & Davis 2012 (Gait Posture) · Barrett et al. 2023 (IJSPT) · Bramah et al. 2018 (AJSM) · Teng & Powers 2014 (JOSPT) · Souza 2016 (IJSPT) · Meardon & Derrick 2014 (J Biomech) · Arellano & Kram 2014 (J Exp Biol) · Vasconcelos et al. 2022 · Dingenen et al. 2018 (Phys Ther Sport)

## Structure

```
index.html, css/      interface (pas d'étape de build)
js/engine.js          lecture vidéo, repérage du coureur, estimation de pose
js/metrics.js         calcul des mesures (profil, face, dos)
js/report.js          repères publiés, synthèse, rapport, dessins
js/store.js           historique local (IndexedDB)
serveur.py            serveur local + téléchargement des dépendances
vendor/               MediaPipe et modèles (téléchargés, non versionnés)
```

## Licence

Apache 2.0. MediaPipe est © Google LLC, sous licence Apache 2.0.
