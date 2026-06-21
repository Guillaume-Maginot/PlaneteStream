# Planète Stream V2.5.1 · Notes indépendantes

## Objectif

Permettre aux membres de laisser une note sans devoir écrire une critique.

## À faire côté Supabase

Exécuter dans SQL Editor :

```txt
supabase_v2_5_1_independent_ratings.sql
```

Le script crée la table `movie_ratings`, ajoute les policies RLS, puis migre les notes existantes depuis les critiques principales.

## Fonctionnement

- Une note rapide peut être enregistrée seule.
- Une critique reste facultative.
- La moyenne Planète Stream utilise d'abord `movie_ratings`.
- Les anciennes critiques restent compatibles.
- Si une critique existe déjà, le formulaire continue de servir à la modifier clairement.
