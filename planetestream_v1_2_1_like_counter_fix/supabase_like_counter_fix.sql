-- Correctif compteur de likes Planète Stream
-- A exécuter seulement si les likes ne s'enregistrent pas côté Supabase.

alter table comment_likes enable row level security;

create policy if not exists "Comment likes can be read"
on comment_likes for select
using (true);

create policy if not exists "Comment likes can be created"
on comment_likes for insert
with check (true);

create policy if not exists "Comment likes can be deleted"
on comment_likes for delete
using (true);

-- Facultatif : le code n'en dépend plus pour afficher le compteur,
-- mais cette policy autorise la mise à jour du cache comments.likes_count.
create policy if not exists "Comments like count can be updated"
on comments for update
using (true)
with check (true);
