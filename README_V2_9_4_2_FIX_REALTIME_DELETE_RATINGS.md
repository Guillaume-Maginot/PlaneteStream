# V2.9.4.2 - Correctif realtime suppression de notes

- Le realtime des notes écoute maintenant explicitement INSERT, UPDATE et DELETE.
- Les suppressions de lignes `movie_ratings` déclenchent le recalcul de la moyenne sur les autres navigateurs.
- Si Supabase ne fournit pas `movie_id` dans le payload DELETE, la fiche ouverte est rafraîchie par sécurité.
- Aucun SQL obligatoire.
