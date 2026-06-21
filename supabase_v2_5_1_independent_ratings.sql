-- Planète Stream V2.5.1
-- Notes indépendantes des critiques.
-- À exécuter dans Supabase SQL Editor.

create table if not exists movie_ratings (
  movie_id text not null,
  viewer_id uuid not null references viewers(id) on delete cascade,
  auth_user_id uuid not null,
  rating integer not null check (rating between 1 and 10),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  primary key (movie_id, viewer_id)
);

create index if not exists idx_movie_ratings_movie_id on movie_ratings(movie_id);
create index if not exists idx_movie_ratings_viewer_id on movie_ratings(viewer_id);
create index if not exists idx_movie_ratings_auth_user_id on movie_ratings(auth_user_id);

alter table movie_ratings enable row level security;

drop policy if exists "movie ratings can be read" on movie_ratings;
drop policy if exists "authenticated users can create own movie ratings" on movie_ratings;
drop policy if exists "authenticated users can update own movie ratings" on movie_ratings;
drop policy if exists "authenticated users can delete own movie ratings" on movie_ratings;

create policy "movie ratings can be read"
on movie_ratings
for select
using (true);

create policy "authenticated users can create own movie ratings"
on movie_ratings
for insert
to authenticated
with check (auth.uid() = auth_user_id);

create policy "authenticated users can update own movie ratings"
on movie_ratings
for update
to authenticated
using (auth.uid() = auth_user_id)
with check (auth.uid() = auth_user_id);

create policy "authenticated users can delete own movie ratings"
on movie_ratings
for delete
to authenticated
using (auth.uid() = auth_user_id);

-- Migration douce : transforme les notes déjà présentes dans les critiques principales en notes indépendantes.
insert into movie_ratings (movie_id, viewer_id, auth_user_id, rating, created_at, updated_at)
select distinct on (movie_id, viewer_uuid)
  movie_id,
  viewer_uuid,
  auth_user_id,
  rating,
  coalesce(created_at, now()),
  coalesce(edited_at, created_at, now())
from comments
where parent_id is null
  and viewer_uuid is not null
  and auth_user_id is not null
  and rating between 1 and 10
order by movie_id, viewer_uuid, coalesce(edited_at, created_at, now()) desc
on conflict (movie_id, viewer_id)
do update set
  rating = excluded.rating,
  auth_user_id = excluded.auth_user_id,
  updated_at = excluded.updated_at;
