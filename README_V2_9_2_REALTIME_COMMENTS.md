# Planète Stream V2.9.2 — Realtime Critiques & Réponses

## Ajouts

- Abonnement Supabase Realtime sur la table `comments`.
- Les critiques et réponses apparaissent sans rechargement sur la fiche ouverte.
- Le refresh est différé si un utilisateur est en train d'écrire.
- Un bouton discret “Nouveaux échanges disponibles” permet d'afficher les nouveautés sans faire sauter la page.
- Légère animation sur le commentaire/reply fraîchement arrivé.
- Polling conservé en secours, mais ralenti lorsque Realtime est actif.

## Supabase

La table `comments` doit être activée dans `Database > Publications > supabase_realtime`.
Aucun SQL supplémentaire n'est nécessaire si l'activation est déjà faite.
