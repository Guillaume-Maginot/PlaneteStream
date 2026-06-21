# Planète Stream V2.4 · Avatars Planétiens

## Ajouts

- Dossier `assets/avatars/` avec les avatars 512x512.
- Galerie de choix d'avatar sur `account.html`.
- Changement d'avatar depuis la page compte.
- Avatars affichés dans le header, les avis, les réponses, les profils et le Hall du Cinéma.
- Avatars réservés masqués du sélecteur : `fondateur`, `moderateur`.

## Avatars publics

- `orbiteur`
- `robot`
- `explorateur`
- `renard`
- `hibou`
- `cosmonaute`
- `masques`
- `projectionniste`
- `chat`
- `kraken`
- `cyberpunk`
- `vip`

## Avatars réservés

- `fondateur`
- `moderateur`

Ces deux avatars s'attribuent directement dans Supabase, dans la table `viewers`, colonne `avatar`.

## SQL optionnel mais recommandé

Exécuter `supabase_v2_4_avatar_policy.sql` pour empêcher un utilisateur de s'attribuer lui-même un avatar réservé via une requête bricolée.
