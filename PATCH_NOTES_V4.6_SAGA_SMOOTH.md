# Patch V4.6 - Saga smooth mobile

Objectif : fluidifier uniquement `saga.html`, qui était la seule page à saccader sur téléphone ancien.

## Modifications

- Désactivation de l’animation d’étoiles sur mobile.
- Suppression des filtres visuels coûteux sur le fond de saga mobile.
- Suppression du `backdrop-filter` mobile sur les blocs stats et cartes.
- Ombres allégées sur les cartes de films.
- `content-visibility: auto` ajouté aux cartes de la timeline.
- Transitions hover neutralisées sur mobile.
- Cache-busting des assets CSS/JS.

## Non modifié

- Catalogue JSON inchangé.
- Rails d’accueil inchangés.
- Sagas listing inchangé.
- Logique JS saga inchangée.
- Bubulle reste masqué/mobile comme dans la version validée.
