# Planète Stream · v0.9.6

Prototype propre pour l’accueil catalogue.

## Structure

- `index.html` : accueil dynamique
- `data/catalogue.json` : données des titres
- `assets/app.js` : affichage, filtres, recherche, fiche détail
- `admin.html` : recherche TMDb et export JSON
- `netlify/functions/tmdb-search.js` : proxy sécurisé vers TMDb

## Images à la main

Place les affiches ici :

```txt
images/posters/slug-du-film.jpg
images/backdrops/slug-du-film.jpg
```

Les slugs sont déjà indiqués dans `data/catalogue.json`.

## TMDb

Dans Netlify, ajoute une variable d’environnement :

```txt
TMDB_BEARER_TOKEN=ton_token_tmdb
```

Puis ouvre `admin.html`, recherche un titre et exporte le nouveau `catalogue.json`.

## Important

La clé TMDb ne doit jamais être dans le JavaScript public. Elle reste dans la fonction Netlify.
