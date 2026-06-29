# PSV4.6 - Optimisation TMDb

Patch faible risque ciblé sur les images TMDb.

## Modifications
- Ajout d’un helper `optimizeTmdbImageUrl()` dans `assets/app.js`, `assets/detail.js` et `assets/premium.js`.
- Les affiches utilisent maintenant une taille adaptée : `w342` sur mobile, `w500` sur desktop.
- Les backdrops utilisent `w780` sur mobile, `w1280` sur desktop.
- Les URLs TMDb déjà présentes dans le JSON sont réécrites au rendu sans modifier le catalogue.
- Les pages `saga.html` et `sagas.html` utilisent aussi une taille responsive pour les images TMDb.
- Cache-busting JS mis à jour sur les pages concernées.

## Non modifié
- Aucun changement dans la structure HTML des rails.
- Aucun changement dans le catalogue JSON.
- Aucun changement dans la logique Bubulle.
- Aucun changement CSS critique.
