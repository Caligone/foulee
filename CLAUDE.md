# Foulée : pièges à connaître

- Tester dans **Chrome** (`channel: 'chrome'` avec Playwright) : le navigateur par défaut est Firefox Developer Edition, sans HEVC en WebCodecs.
- `js/domaine/` reste **pur** (pas de DOM) : c'est ce qui permet `node --test test/`. Le rendu va dans `js/ui/`.
- Tout changement de résultat dans `mesures.js` : incrémenter `ALGO` (`js/domaine/analyse.js`) et relancer la non-régression sur `test/fixtures/`.
- Un statut ne vient que de `reperes.js`. Pas de seuil recopié ailleurs ; un seuil sans source est `nature: 'indicatif'`.
- Vocabulaire : technique de course, jamais de diagnostic ni de prévention ou traitement de blessure (risque de dispositif médical). Le test « aucune allégation médicale » le vérifie.
- IndexedDB : jamais un Blob par image. Chrome plante (SIGTRAP) en supprimant ou réécrivant un enregistrement de plusieurs milliers de Blobs ; les vignettes d'un passage sont dans un seul Blob.
- Après un changement de JS, le profil Playwright persistant peut garder l'ancien module en cache : vider `Cache` et `Code Cache`.
- Avant de commiter : `npm run check` (types du domaine en JSDoc via `tsc --noEmit`, puis `node --test`). TypeScript n'est qu'une dépendance de développement : l'app n'a pas de build.
- Vitesse : l'inférence du modèle fait 95 % du temps (≈ 20 ms/image, mesuré le 31/10). Réduire les marges de profil ou la cadence des vues de face change les mesures : ne pas le refaire sans comparer à `test/fixtures/`.
