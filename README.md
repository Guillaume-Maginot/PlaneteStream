Planète Stream · Correctif anti-doublon des signalements

À faire : relancer supabase_reports.sql dans Supabase, puis remplacer les fichiers du site.

Correction :
- un même membre ne peut toujours signaler qu'une seule fois le même message ;
- plusieurs membres différents peuvent maintenant signaler le même message ;
- l'équipe garde une seule alerte par message, avec un compteur mis à jour ;
- les anciennes contraintes/index trop stricts sont supprimés par le SQL.
