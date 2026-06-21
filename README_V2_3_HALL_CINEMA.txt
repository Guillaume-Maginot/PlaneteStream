Planète Stream V2.3 · Hall du Cinéma

Objectif
- Transformer l’accueil en espace communautaire vivant.
- Mettre en avant critiques, réponses, likes, nouveaux membres et films qui font débat.

Ajouts
- Section #hall-cinema sur l’accueil.
- Nouveau module assets/hall.js.
- Cartes : discussions du moment, critique populaire, bienvenue, membres actifs.
- Timeline communautaire récente.
- Bloc films qui divisent avec écart TMDb / Planète Stream.
- Rafraîchissement discret toutes les 30 secondes.

Supabase
- Aucune nouvelle table obligatoire.
- Le module utilise les tables existantes : comments, comment_likes, viewers.
- Les policies SELECT publiques doivent rester actives pour ces tables.

Test conseillé
1. Ouvrir index.html.
2. Vérifier le Hall sous le hero.
3. Poster une critique ou réponse depuis une salle.
4. Revenir à l’accueil et vérifier la timeline / discussions.
