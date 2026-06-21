# Planète Stream V2.9.1 · Realtime Notifications

## Objectif

Première brique temps réel : les Messages du Hall arrivent sans rechargement manuel.

## Ajouts

- Chargement de Supabase JS v2 sur les pages publiques.
- Realtime branché sur `public.notifications`.
- Badge du menu membre mis à jour dès qu'une notification arrive, est lue ou supprimée.
- Mon Espace rafraîchit la section Messages du Hall quand une notification arrive.
- Polling conservé en secours, mais ralenti à 60 secondes.
- Version visible mise à jour en v2.9.1.

## Supabase

La table `notifications` doit être activée dans `Database > Publications > supabase_realtime`.

Aucun SQL supplémentaire si cette table est déjà activée.
