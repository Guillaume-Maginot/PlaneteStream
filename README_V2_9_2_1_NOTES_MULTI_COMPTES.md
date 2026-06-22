# Planète Stream V2.9.2.1 — Fix notes multi-comptes

Correctif ciblé sur les notes indépendantes.

## Corrigé

- publier une critique avec une note synchronise désormais aussi `movie_ratings` ;
- modifier la note d'une critique met aussi à jour `movie_ratings` ;
- la moyenne Planète Stream fusionne proprement :
  - notes officielles depuis `movie_ratings` ;
  - anciennes notes restées uniquement dans `comments` en secours ;
- évite le cas `1 note · 2 critiques` quand deux comptes publient chacun une critique notée.

## Supabase

Aucun SQL obligatoire.

Si tu veux nettoyer manuellement les anciens tests incomplets, tu peux simplement republier/modifier la critique concernée : la note indépendante sera recréée automatiquement.
