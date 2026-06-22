# Planète Stream V2.9.4.1 - Fix suppression notes

Correctif ciblé après tests multi-comptes.

## Corrigé

- Quand un membre supprime sa critique principale, la note indépendante associée dans `movie_ratings` est supprimée aussi.
- La moyenne Planète Stream et le compteur de notes sont recalculés après suppression.
- Le sélecteur "Votre note" est remis à zéro pour le membre concerné.
- Les réponses seules ne suppriment pas de note.

## Supabase

Aucun SQL à refaire.
