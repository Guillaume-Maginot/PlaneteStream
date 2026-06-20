-- Planète Stream v1.0 Communauté
-- À exécuter dans Supabase > SQL Editor si ces éléments ne sont pas déjà présents.

create table if not exists viewers (
  id uuid primary key default gen_random_uuid(),
  pseudo text unique not null,
  avatar text default '🪐',
  created_at timestamptz default now(),
  last_seen timestamptz default now()
);

alter table comments
  add column if not exists parent_id uuid references comments(id) on delete cascade;

alter table comments
  add column if not exists likes_count integer default 0;

alter table comments
  add column if not exists edited_at timestamptz;

alter table comments
  add column if not exists viewer_uuid uuid references viewers(id) on delete set null;

create table if not exists comment_likes (
  viewer_id uuid references viewers(id) on delete cascade,
  comment_id uuid references comments(id) on delete cascade,
  created_at timestamptz default now(),
  primary key(viewer_id, comment_id)
);

create table if not exists movie_favorites (
  viewer_id uuid references viewers(id) on delete cascade,
  movie_id text not null,
  created_at timestamptz default now(),
  primary key(viewer_id, movie_id)
);

create table if not exists viewer_history (
  viewer_id uuid references viewers(id) on delete cascade,
  movie_id text not null,
  progress integer default 0,
  updated_at timestamptz default now(),
  primary key(viewer_id, movie_id)
);

alter table viewers enable row level security;
alter table comment_likes enable row level security;
alter table movie_favorites enable row level security;
alter table viewer_history enable row level security;

create policy if not exists "viewers_select_public" on viewers for select using (true);
create policy if not exists "viewers_insert_public" on viewers for insert with check (true);
create policy if not exists "viewers_update_public" on viewers for update using (true) with check (true);

create policy if not exists "comment_likes_select_public" on comment_likes for select using (true);
create policy if not exists "comment_likes_insert_public" on comment_likes for insert with check (true);
create policy if not exists "comment_likes_delete_public" on comment_likes for delete using (true);

create policy if not exists "movie_favorites_select_public" on movie_favorites for select using (true);
create policy if not exists "movie_favorites_insert_public" on movie_favorites for insert with check (true);
create policy if not exists "movie_favorites_delete_public" on movie_favorites for delete using (true);

create policy if not exists "viewer_history_select_public" on viewer_history for select using (true);
create policy if not exists "viewer_history_insert_public" on viewer_history for insert with check (true);
create policy if not exists "viewer_history_update_public" on viewer_history for update using (true) with check (true);
