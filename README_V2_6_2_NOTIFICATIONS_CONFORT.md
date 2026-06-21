# Planète Stream V2.6.2 · Notifications confort

Objectif : rendre les Messages du Hall plus naturels à utiliser.

## Ajouts

- Cliquer sur une notification la marque automatiquement comme lue avant d'ouvrir le commentaire.
- Le compteur du menu membre se rafraîchit après lecture.
- Suppression individuelle d'un message du Hall.
- Bouton "Supprimer les messages lus".
- Le badge de notification reste séparé du pseudo dans le header.

## Supabase

Aucun nouveau SQL obligatoire si `supabase_v2_6_1_notifications.sql` a déjà été exécuté.

La policy DELETE de la table `notifications` était déjà prévue en V2.6.1.
