# Planète Stream · v1.3.1

Prototype catalogue avec couche communautaire sécurisée.

## Structure

- `index.html` : accueil dynamique
- `detail.html` : fiche contenu
- `watch.html` : salle de projection + critiques
- `account.html` : inscription / connexion Supabase Auth
- `data/catalogue.json` : données des titres
- `assets/app.js` : affichage, filtres, recherche
- `assets/watch.js` : lecture, critiques, likes, favoris, historique
- `assets/auth.js` : session sécurisée, viewer lié à Supabase Auth, menu membre
- `assets/account.js` : formulaires compte
- `admin.html` : recherche TMDb et export JSON
- `netlify/functions/tmdb-search.js` : proxy sécurisé vers TMDb

## Auth sécurisée

Exécute `supabase_auth_v1_3.sql` dans Supabase après avoir activé Authentication.

Cette version :

- utilise email + mot de passe ;
- réserve le pseudo choisi sans suffixe automatique ;
- refuse un pseudo déjà utilisé ;
- relie `viewers.auth_user_id` à `auth.users.id` ;
- affiche un menu membre dans le header ;
- verrouille les critiques, réponses, likes, favoris et historique via RLS.

## TMDb

Dans Netlify, ajoute une variable d’environnement :

```txt
TMDB_BEARER_TOKEN=ton_token_tmdb
```

La clé TMDb ne doit jamais être dans le JavaScript public.
