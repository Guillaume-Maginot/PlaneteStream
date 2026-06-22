# Planète Stream V3.0 RC1.5 - Recherche plus directe

## Objectif

Clarifier le comportement de la recherche : lorsqu'un utilisateur appuie sur Entrée dans le champ de recherche, la page descend automatiquement vers les résultats.

## Modifications

- Ajout d'un événement `keydown` sur `#searchInput`.
- Appui sur `Enter` : rendu des résultats puis scroll fluide vers `#catalogue`.
- Ajout d'un léger glow temporaire sur la zone catalogue pour indiquer que la recherche a bien réagi.

## SQL

Aucun SQL à refaire.
