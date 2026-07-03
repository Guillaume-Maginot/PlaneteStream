-- Planète Stream - compteur de clics sur "Regarder"
-- À exécuter dans Supabase SQL Editor si la table movie_views n'existe pas encore.
-- Le compteur représente des clics de membres connectés sur le lancement vidéo,
-- pas une preuve que le lecteur externe a réellement démarré ou terminé la lecture.

create table if not exists public.movie_views (
  movie_id text primary key,
  total_views integer not null default 0,
  updated_at timestamptz not null default now()
);

alter table public.movie_views enable row level security;

create policy if not exists "movie_views readable by everyone"
  on public.movie_views
  for select
  using (true);

create policy if not exists "movie_views insert by authenticated users"
  on public.movie_views
  for insert
  to authenticated
  with check (true);

create policy if not exists "movie_views update by authenticated users"
  on public.movie_views
  for update
  to authenticated
  using (true)
  with check (true);
