# Planète Stream V2.9.4 — Realtime Ratings

## Ajouts

- Notes Planète Stream en temps réel depuis `movie_ratings`.
- Moyenne et nombre de notes mis à jour sans rechargement.
- Sélecteur "Votre note" synchronisé si la note change depuis une autre session.
- Animation discrète sur la note communautaire lorsqu'elle bouge.
- Polling conservé en secours via le système existant.

## Supabase

Aucun SQL à refaire si `movie_ratings` est déjà présent dans la publication `supabase_realtime`.

Tables realtime utilisées à ce stade :

- `notifications`
- `comments`
- `comment_likes`
- `movie_ratings`
