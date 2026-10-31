# Foulée : pièges à connaître

- Tester dans **Chrome** (`channel: 'chrome'` avec Playwright) : le navigateur par défaut est Firefox Developer Edition, sans HEVC en WebCodecs.
- `js/domaine/` reste **pur** (pas de DOM) : c'est ce qui permet `node --test test/`. Le rendu va dans `js/ui/`.
- Tout changement de résultat dans `mesures.js` : incrémenter `ALGO` (`js/domaine/analyse.js`) et relancer la non-régression sur `test/fixtures/`.
- Un statut ne vient que de `reperes.js`. Pas de seuil recopié ailleurs ; un seuil sans source est `nature: 'indicatif'`.
- Vocabulaire : technique de course, jamais de diagnostic ni de prévention ou traitement de blessure (risque de dispositif médical). Le test « aucune allégation médicale » le vérifie.
- IndexedDB : jamais un Blob par image. Chrome plante (SIGTRAP) en supprimant ou réécrivant un enregistrement de plusieurs milliers de Blobs ; les vignettes d'un passage sont dans un seul Blob.
- Après un changement de JS, le profil Playwright persistant peut garder l'ancien module en cache : vider `Cache` et `Code Cache`.
