Planète Stream · Correctif anti-doublon des signalements

À faire : relancer supabase_reports.sql dans Supabase, puis remplacer les fichiers du site.

Correction :
- un même membre ne peut toujours signaler qu'une seule fois le même message ;
- plusieurs membres différents peuvent maintenant signaler le même message ;
- l'équipe garde une seule alerte par message, avec un compteur mis à jour ;
- les anciennes contraintes/index trop stricts sont supprimés par le SQL.


## Patch bêta vidéo embed

- Ajout du champ `videoEmbed` dans l’éditeur du catalogue.
- Le champ accepte un code `<iframe ...>` ou une URL d’embed directe.
- Le bouton `Regarder` n’apparaît sur la fiche que si une vidéo bêta est renseignée.
- La salle de cinéma (`watch.html`) est réservée aux membres connectés pendant la bêta.
- Pas de SQL nécessaire : le catalogue actuel fonctionne avec `data/catalogue.json`. Après modification dans l’admin, télécharger/exporter le catalogue puis remplacer le fichier JSON.



## Patch admin login
- Ajout de `admin-login.html` pour la connexion au centre de contrôle.
- `admin.html` reste masqué tant que le rôle admin/fondateur/architecte n’est pas vérifié.
- Redirection automatique vers la connexion si non connecté ou accès refusé si rôle insuffisant.
