Planète Stream V2.2.2 - Vote unique par spectateur

Correctif :
- une réponse ne compte jamais comme vote ;
- plusieurs critiques du même spectateur sur le même film ne comptent plus comme plusieurs votes ;
- si le spectateur republie une critique sur le même film, sa critique principale existante est mise à jour au lieu d'en créer une nouvelle ;
- la note Planète Stream est calculée avec un seul vote par spectateur, en gardant la critique la plus récente.

SQL optionnel :
- supabase_v2_2_2_single_vote_per_viewer.sql nettoie les doublons existants de test et ajoute un index unique.
- À lancer seulement si tu veux supprimer les anciennes critiques principales en double d'un même spectateur sur un même film.
