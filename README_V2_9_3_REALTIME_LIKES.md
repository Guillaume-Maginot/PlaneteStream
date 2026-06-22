# Planète Stream V2.9.3 — Realtime Likes

## Objectif
Rendre les likes de critiques et de réponses visibles en temps réel sur tous les navigateurs connectés.

## Ajouts
- Abonnement Supabase Realtime sur `comment_likes`.
- Mise à jour instantanée des compteurs de likes.
- État "Aimé par vous" conservé par utilisateur.
- Animation discrète du bouton like quand un compteur évolue.
- Aucun SQL requis si `comment_likes` est déjà activé dans `supabase_realtime`.

## Test conseillé
1. Ouvrir deux navigateurs avec deux comptes différents.
2. Afficher la même salle de projection.
3. Liker une critique depuis le navigateur A.
4. Vérifier que le compteur change sans F5 dans le navigateur B.
5. Retirer le like et vérifier que le compteur redescend.
