Planète Stream · v2 Communauté Auth-only

À faire côté Supabase :
1. SQL Editor > exécuter supabase_community_v2_auth_only.sql
2. Authentication > URL Configuration : vérifier Site URL + Redirect URLs
3. Supprimer les anciens utilisateurs de test dans Authentication > Users si besoin
4. Se reconnecter depuis account.html
5. Tester publication critique, réponse, like, favori

Cette version supprime la double logique viewer local / viewer Auth.
La source officielle devient : Supabase Auth -> viewers.auth_user_id -> commentaires/likes/favoris/historique.
