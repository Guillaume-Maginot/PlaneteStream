Planète Stream V2.2.1 - Correctif note communautaire

Corrige le cas où la publication d'une réponse peut faire retomber l'affichage de la note Planète Stream à "Pas encore".

Changements :
- Les réponses sont explicitement enregistrées avec rating = null.
- L'affichage de la note Planète Stream est recalculé côté interface uniquement depuis les critiques principales, pas depuis les réponses.
- Le fallback movie_stats reste utilisé si aucune critique principale n'est chargée.

Aucune nouvelle table Supabase obligatoire.
