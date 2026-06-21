# Planète Stream V2.6.1 · Messages du Hall

## Objectif
Ajouter des notifications internes discrètes, sans email ni notification navigateur.

## Fonctionnement
- Quand un membre répond à un message d'un autre membre, une notification est créée.
- Le menu membre affiche un badge rouge avec le nombre de messages non lus.
- La page `Mon Espace` possède une section `Messages du Hall`.
- Le bouton `Tout marquer comme lu` remet le compteur à zéro.

## Supabase
Exécuter dans SQL Editor :

```sql
supabase_v2_6_1_notifications.sql
```

## Notes
- Pas d'email envoyé.
- Pas de push navigateur.
- Les messages sont consultables quand le membre le souhaite.
