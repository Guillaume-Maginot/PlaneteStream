Planète Stream V2.1 · Avis & interactions

Nouveautés :
- réponses aux critiques avec compteur ;
- modification de ses propres critiques/réponses ;
- suppression de ses propres critiques/réponses ;
- tri des critiques : récentes, plus likées, mieux notées, plus commentées ;
- mini profil public au clic sur un pseudo ;
- affichage “modifié” après édition.

Base Supabase :
- si supabase_community_v2_auth_only.sql a déjà été exécuté, rien d'obligatoire à refaire ;
- si modifier/supprimer/répondre bloque, exécuter supabase_v2_1_comments_interactions.sql dans SQL Editor.

Test recommandé :
1. Se connecter depuis account.html.
2. Ouvrir watch.html sur un titre.
3. Publier une critique.
4. Modifier la critique.
5. Répondre à la critique.
6. Liker, puis trier par “Plus likées”.
7. Cliquer sur le pseudo pour vérifier le mini profil.
