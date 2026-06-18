-- Compteur de vues totales par œuvre pour Planète Stream.
-- À exécuter dans Supabase > SQL Editor.

create table if not exists movie_views (
  movie_id text primary key,
  total_views integer not null default 0,
  updated_at timestamptz not null default now()
);

alter table movie_views enable row level security;

create policy if not exists "movie_views_select_public"
  on movie_views for select
  using (true);

create policy if not exists "movie_views_insert_public"
  on movie_views for insert
  with check (true);

create policy if not exists "movie_views_update_public"
  on movie_views for update
  using (true)
  with check (true);
