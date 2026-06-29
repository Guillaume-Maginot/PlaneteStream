# Planète Stream V4.6 alpha - Accueil / Mobile

Patch ciblé après validation du correctif rails V4.5.3.

## Modifications
- Accueil uniquement, sans refonte visuelle.
- Cache CSS/JS passé en `v=4.6-alpha-home`.
- Préchargement de l’image hero WebP mobile/desktop.
- Fond hero CSS basculé vers WebP léger avec fallback JPG.
- Bannière Sagas basculée vers `sagas.webp`.
- Images TMDb réduites côté mobile : posters en `w342`, backdrops en `w780`.
- Sections hors écran avec `content-visibility:auto` pour réduire le rendu initial.
- Effets visuels un peu allégés sur mobile.

## À tester
- Accueil sur téléphone : chargement initial, hero, rails horizontaux, Sagas, catalogue complet.
- Accueil PC : vérifier que le rendu reste identique.
- Brave mobile : vider/cache-buster normalement inutile grâce aux nouvelles versions CSS/JS.
