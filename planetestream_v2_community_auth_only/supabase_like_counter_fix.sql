-- Correctif robuste likes Planète Stream v1.2.2
-- A exécuter si le bouton like ne s'incrémente pas ou si Supabase refuse l'écriture.

alter table viewers enable row level security;
alter table comment_likes enable row level security;
alter table comments enable row level security;

-- Viewers : création silencieuse autorisée pour les likes/favoris.
drop policy if exists "Viewers can be read" on viewers;
drop policy if exists "Viewers can be created" on viewers;
drop policy if exists "Viewers can be updated" on viewers;

create policy "Viewers can be read"
on viewers for select
using (true);

create policy "Viewers can be created"
on viewers for insert
with check (true);

create policy "Viewers can be updated"
on viewers for update
using (true)
with check (true);

-- Likes : lecture, ajout et retrait publics pour la v1 communautaire légère.
drop policy if exists "Comment likes can be read" on comment_likes;
drop policy if exists "Comment likes can be created" on comment_likes;
drop policy if exists "Comment likes can be deleted" on comment_likes;

create policy "Comment likes can be read"
on comment_likes for select
using (true);

create policy "Comment likes can be created"
on comment_likes for insert
with check (true);

create policy "Comment likes can be deleted"
on comment_likes for delete
using (true);

-- Sécurité anti-double-like : à créer si elle n'existe pas déjà.
create unique index if not exists comment_likes_viewer_comment_unique
on comment_likes(viewer_id, comment_id);

-- Cache comments.likes_count : facultatif, mais utile comme filet de sécurité.
drop policy if exists "Comments like count can be updated" on comments;

create policy "Comments like count can be updated"
on comments for update
using (true)
with check (true);
