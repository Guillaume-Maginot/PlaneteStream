# Planète Stream V4.6 low-risk perf

Base : V4.5.3 mobile rail flex fix.

Modifications sûres appliquées :

- Ajout de `preconnect` + `dns-prefetch` vers `https://image.tmdb.org` sur les pages HTML.
  - But : accélérer le premier chargement des affiches/backdrops TMDb, surtout sur mobile.
  - Risque : très faible, ne modifie ni le DOM dynamique ni les rails.

- Cache Netlify des fichiers `/assets/*` porté à 7 jours avec `stale-while-revalidate`.
  - But : améliorer les retours utilisateur et les rechargements téléphone.
  - Les données JSON restent en cache court pour ne pas bloquer les mises à jour du catalogue.

- Ajout de `decoding="async"` sur quelques images statiques/lazy.
  - But : éviter de bloquer le rendu pendant le décodage image.
  - Aucun changement de mise en page attendu.

À tester :

- Accueil PC + téléphone.
- Détail film.
- Sagas.
- Connexion / Mon espace.

Ce patch ne touche pas au comportement JS, aux grilles, aux rails, ni au CSS mobile critique.
