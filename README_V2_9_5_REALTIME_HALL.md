# Planète Stream V2.9.5 · Hall du Cinéma Realtime

Ajouts :

- Le Hall du Cinéma se rafraîchit en temps réel sur les événements communautaires.
- Écoute des tables déjà activées : `comments`, `comment_likes`, `movie_ratings`, `notifications`.
- Mise à jour des statistiques, discussions du moment, critique populaire, membres actifs, timeline, films qui divisent et bandeau du parcours.
- Rafraîchissement discret avec debounce pour éviter les sautillements.
- Polling conservé en secours, ralenti à 90 secondes.

Aucun SQL à refaire si les tables suivantes sont déjà dans `supabase_realtime` :

- `notifications`
- `comments`
- `comment_likes`
- `movie_ratings`
