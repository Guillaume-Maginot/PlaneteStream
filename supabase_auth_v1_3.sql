-- Planète Stream v1.3A · Auth sécurisée
-- À exécuter dans Supabase SQL Editor après activation de Supabase Auth.

-- 1) Le viewer devient le profil public lié au vrai compte Auth.
alter table viewers
add column if not exists auth_user_id uuid unique references auth.users(id) on delete cascade;

alter table viewers
add column if not exists role text not null default 'viewer';

alter table viewers
add column if not exists banned_at timestamptz;

create unique index if not exists viewers_auth_user_id_uidx on viewers(auth_user_id) where auth_user_id is not null;
create unique index if not exists viewers_pseudo_uidx on viewers(lower(pseudo));

-- 2) Fonction utilitaire : quel viewer correspond à auth.uid() ?
create or replace function public.current_viewer_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from public.viewers where auth_user_id = auth.uid() limit 1;
$$;

create or replace function public.current_user_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(role, 'viewer') from public.viewers where auth_user_id = auth.uid() limit 1;
$$;

-- 3) Activation RLS sur les tables communautaires.
alter table viewers enable row level security;
alter table comments enable row level security;
alter table comment_likes enable row level security;
alter table movie_favorites enable row level security;
alter table viewer_history enable row level security;

-- 4) Nettoyage des anciennes policies si elles existent.
drop policy if exists "Viewers can be read" on viewers;
drop policy if exists "Viewers can be created" on viewers;
drop policy if exists "Viewers can be updated" on viewers;
drop policy if exists "Authenticated viewers can read profiles" on viewers;
drop policy if exists "Authenticated users can create own viewer" on viewers;
drop policy if exists "Users can update own viewer" on viewers;

drop policy if exists "Comments can be read" on comments;
drop policy if exists "Comments can be created" on comments;
drop policy if exists "Comments can be updated" on comments;
drop policy if exists "Comments can be deleted" on comments;
drop policy if exists "Authenticated users can create comments" on comments;
drop policy if exists "Users can update own comments" on comments;
drop policy if exists "Users can delete own comments" on comments;

drop policy if exists "Comment likes can be read" on comment_likes;
drop policy if exists "Comment likes can be created" on comment_likes;
drop policy if exists "Comment likes can be deleted" on comment_likes;
drop policy if exists "Authenticated users can like" on comment_likes;
drop policy if exists "Users can delete own likes" on comment_likes;

drop policy if exists "Favorites can be read" on movie_favorites;
drop policy if exists "Favorites can be created" on movie_favorites;
drop policy if exists "Favorites can be deleted" on movie_favorites;
drop policy if exists "Users can read own favorites" on movie_favorites;
drop policy if exists "Users can create own favorites" on movie_favorites;
drop policy if exists "Users can delete own favorites" on movie_favorites;

drop policy if exists "History can be read" on viewer_history;
drop policy if exists "History can be created" on viewer_history;
drop policy if exists "History can be updated" on viewer_history;
drop policy if exists "Users can read own history" on viewer_history;
drop policy if exists "Users can upsert own history" on viewer_history;

-- 5) Viewers : profils publics lisibles, création/modification verrouillées au propriétaire.
create policy "Authenticated viewers can read profiles"
on viewers for select
using (true);

create policy "Authenticated users can create own viewer"
on viewers for insert
to authenticated
with check (auth_user_id = auth.uid());

create policy "Users can update own viewer"
on viewers for update
to authenticated
using (auth_user_id = auth.uid() or public.current_user_role() in ('moderator', 'admin'))
with check (auth_user_id = auth.uid() or public.current_user_role() in ('moderator', 'admin'));

-- 6) Comments : lecture publique, publication uniquement avec compte connecté.
create policy "Comments can be read"
on comments for select
using (true);

create policy "Authenticated users can create comments"
on comments for insert
to authenticated
with check (
  auth.uid() is not null
  and viewer_uuid = public.current_viewer_id()
  and public.current_viewer_id() is not null
);

create policy "Users can update own comments"
on comments for update
to authenticated
using (viewer_uuid = public.current_viewer_id() or public.current_user_role() in ('moderator', 'admin'))
with check (viewer_uuid = public.current_viewer_id() or public.current_user_role() in ('moderator', 'admin'));

create policy "Users can delete own comments"
on comments for delete
to authenticated
using (viewer_uuid = public.current_viewer_id() or public.current_user_role() in ('moderator', 'admin'));

-- 7) Likes : un compte, un like.
create policy "Comment likes can be read"
on comment_likes for select
using (true);

create policy "Authenticated users can like"
on comment_likes for insert
to authenticated
with check (viewer_id = public.current_viewer_id());

create policy "Users can delete own likes"
on comment_likes for delete
to authenticated
using (viewer_id = public.current_viewer_id());

-- 8) Favoris et historique : privés au propriétaire.
create policy "Users can read own favorites"
on movie_favorites for select
to authenticated
using (viewer_id = public.current_viewer_id());

create policy "Users can create own favorites"
on movie_favorites for insert
to authenticated
with check (viewer_id = public.current_viewer_id());

create policy "Users can delete own favorites"
on movie_favorites for delete
to authenticated
using (viewer_id = public.current_viewer_id());

create policy "Users can read own history"
on viewer_history for select
to authenticated
using (viewer_id = public.current_viewer_id());

create policy "Users can upsert own history"
on viewer_history for insert
to authenticated
with check (viewer_id = public.current_viewer_id());

create policy "Users can update own history"
on viewer_history for update
to authenticated
using (viewer_id = public.current_viewer_id())
with check (viewer_id = public.current_viewer_id());
