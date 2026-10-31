# Foulée

App web d'analyse de foulée à partir d'une vidéo de course, 100 % dans le navigateur (MediaPipe Pose, WebCodecs). Publiée sur https://calig.one/foulee/ (GitHub Pages) par `.github/workflows/pages.yml` ; `serveur.py` sert à l'usage hors ligne. Architecture : section Structure du README.

## Contraintes
- La vidéo ne quitte jamais la machine. Seules les dépendances (MediaPipe, modèle, mp4box, polices) viennent d'un CDN si `vendor/` est absent.
- Pas de build ni de framework : modules ES servis tels quels. TypeScript n'est qu'un vérificateur (JSDoc + `tsc --noEmit`).
- Licence Apache 2.0 et NOTICE à garder.
- Chaque repère est sourcé ; un seuil sans source est `nature: 'indicatif'` et affiché comme tel.
- Vocabulaire de technique de course, jamais de diagnostic, de prévention ou de traitement de blessure (risque de dispositif médical) ; un test le vérifie. Public annoncé : coureurs et entraîneurs.

## Pièges
- Avant de commiter : `npm run check` (types du domaine, puis `node --test`). La CI fait la même chose.
- `js/domaine/` reste pur (pas de DOM). Un statut ne vient que de `reperes.js` (`statut`, `libelle`) ; la synthèse du rapport vient de `bilan()`.
- Tout changement de résultat dans `mesures.js` : incrémenter `ALGO` (`analyse.js`) et relancer la non-régression sur `test/fixtures/` (exports réels, hors dépôt : données personnelles, ne jamais les commiter).
- Tester dans Chrome (`channel: 'chrome'` avec Playwright). Firefox ne décode pas le HEVC en WebCodecs (repli par sauts, ~270 ms/image).
- Un profil Playwright persistant peut garder l'ancien JS en cache : vider `Cache` et `Code Cache`. Les scripts de test écrivent leurs captures hors du dépôt (`*.png` est ignoré).
- IndexedDB : jamais un Blob par image (Chrome plante en supprimant un enregistrement de milliers de Blobs) ; les vignettes d'un passage sont dans un seul Blob.
- Vitesse : l'inférence fait 95 % du temps (≈ 20 ms/image) et le GPU est saturé. Réduire les marges de profil ou la cadence des vues de face change les mesures (vérifié) : ne pas le refaire sans comparer aux fixtures.
- Statut : écart en écarts-types combinés √(sd² + marge²), écart-type résiduel à allure connue, vitesse bornée 7–15 km/h, repères par sexe si précisé (Malisoux 2023, Barrett 2023).
- Caméra qui bouge : décidée par passage (`fond`, seuil 5 % calibré sur 10 vidéos). Mode mobile : appuis datés par rapport au bassin (Zeni 2008), angles et cadence indicatifs, contact / allure / rebond non rendus.

## À faire
- Caméra qui suit le coureur : le repérage par soustraction de fond jette ces passages. Piste : pose sur l'image entière échantillonnée (~4 jours), ou compensation du mouvement global (~1 jour). Valider sur des vidéos filmées en double (fixe et mobile).
- Tapis : changement de repère x + v·t (v = recul du pied d'appui), puis `profileMetrics` inchangé ; repères à nuancer (Van Hooren 2020). Il faut une vidéo de test.
- Mémoire du repérage : ≈ 175 Mo par minute de vidéo (refus au-delà de 10 min). Vraie correction : deux passes, à valider par un test du repérage.
- Robustesse : plusieurs personnes (aucune alerte), `boxAt` sans limite d'âge, `seek` sans délai maximal, profil en biais, caméra penchée.
- Rapport : historique centré sur la piste (« ta cadence 168 → 176 »), rapport progressif passage par passage, notification de fin.
- Replis CDN sans vérification d'intégrité (import dynamique) : épingler les versions, envisager de servir `vendor/` sur Pages.
