# Patch mobile/performance - PSV4.5

## Modifié
- `assets/styles.css`
- `assets/app.js`
- `assets/mobile-optimizations.js` ajouté
- `netlify.toml`
- liens CSS/JS des pages HTML versionnés en `v=4.5-mobile-opt`
- images WebP ajoutées :
  - `images/planetestream-optimized.webp`
  - `images/planetestream-mobile.webp`
  - `assets/sagas.webp`
  - `assets/wip.webp`
  - `assets/wip02.webp`

## Objectif
- Rendu mobile plus propre.
- Menu mobile fonctionnel.
- Hero plus compact sur téléphone.
- Grille catalogue plus stable en 2 colonnes.
- Pagination automatique corrigée sur téléphone.
- Effets hover/parallax désactivés sur tactile.
- Image hero principale fortement allégée via WebP.
- Cache Netlify ajouté pour assets/images.

## Test conseillé
- Accueil téléphone : menu, hero, rails, catalogue, pagination.
- Pages `sagas.html` et `saga.html` sur téléphone.
- Fiches `detail.html` / `premium.html`.
- Connexion/compte si besoin, car les scripts auth n'ont pas été modifiés.
