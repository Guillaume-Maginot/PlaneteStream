Planète Stream · V2 Architecture Auth unique

Objectif
- Une seule source de vérité pour la connexion : window.PS.
- Le header, la page compte, la page lecture et la publication utilisent le même état Auth.
- Plus de divergence entre « connecté visuellement » et « invité » dans watch.js.

Fichiers principaux modifiés
- assets/auth.js : nouveau cœur Auth unique avec window.PS + compatibilité PSAuth.
- assets/watch.js : attend window.PS.ready et force la session officielle avant publication.

À faire côté Supabase
1. Exécuter supabase_community_v2_auth_only.sql si ce n’est pas déjà fait.
2. Se déconnecter puis se reconnecter depuis account.html.
3. Ouvrir une page watch.html?slug=...
4. Publier une critique.

Notes
- window.PS.ready doit être attendu par les pages avant d’utiliser l’état utilisateur.
- window.PS.refreshAuthState({force:true}) vérifie la session Supabase avant action sensible.
- Les commentaires envoient désormais auth_user_id + viewer_uuid depuis l’état officiel.
