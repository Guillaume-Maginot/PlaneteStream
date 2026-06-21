-- Planète Stream · Communauté v2 Auth-only
-- Objectif : une seule identité officielle, Supabase Auth + viewers.auth_user_id.
-- À exécuter dans Supabase SQL Editor.

begin;

-- Extensions utiles
create extension if not exists pgcrypto;

-- Colonnes nécessaires
alter table public.viewers
  add column if not exists auth_user_id uuid references auth.users(id) on delete cascade,
  add column if not exists role text not null default 'viewer',
  add column if not exists created_at timestamptz default now(),
  add column if not exists last_seen timestamptz default now();

alter table public.comments
  add column if not exists auth_user_id uuid references auth.users(id) on delete set null,
  add column if not exists viewer_uuid uuid references public.viewers(id) on delete set null,
  add column if not exists parent_id uuid references public.comments(id) on delete cascade,
  add column if not exists edited_at timestamptz,
  add column if not exists likes_count integer not null default 0;

alter table public.comment_likes
  add column if not exists created_at timestamptz default now();

alter table public.movie_favorites
  add column if not exists created_at timestamptz default now();

alter table public.viewer_history
  add column if not exists progress integer default 0,
  add column if not exists updated_at timestamptz default now();

-- Contraintes / index, sans casser si déjà présents
create unique index if not exists viewers_auth_user_id_key on public.viewers(auth_user_id) where auth_user_id is not null;
create unique index if not exists viewers_pseudo_key on public.viewers(lower(pseudo));
create index if not exists comments_movie_id_idx on public.comments(movie_id);
create index if not exists comments_viewer_uuid_idx on public.comments(viewer_uuid);
create index if not exists comments_auth_user_id_idx on public.comments(auth_user_id);
create index if not exists comments_parent_id_idx on public.comments(parent_id);
create unique index if not exists comment_likes_unique_idx on public.comment_likes(viewer_id, comment_id);
create unique index if not exists movie_favorites_unique_idx on public.movie_favorites(viewer_id, movie_id);
create unique index if not exists viewer_history_unique_idx on public.viewer_history(viewer_id, movie_id);

-- RLS activée
alter table public.viewers enable row level security;
alter table public.comments enable row level security;
alter table public.comment_likes enable row level security;
alter table public.movie_favorites enable row level security;
alter table public.viewer_history enable row level security;

-- Nettoyage de toutes les anciennes policies sur les tables communauté
-- On retire les couches héritées du système current_viewer_id().
do $$
declare
  r record;
begin
  for r in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in ('viewers','comments','comment_likes','movie_favorites','viewer_history')
  loop
    execute format('drop policy if exists %I on %I.%I', r.policyname, r.schemaname, r.tablename);
  end loop;
end $$;

-- Fonction simple pour reconnaître un admin/modérateur via viewers.role.
create or replace function public.current_ps_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select role from public.viewers where auth_user_id = auth.uid() limit 1),
    'guest'
  );
$$;

grant execute on function public.current_ps_role() to anon, authenticated;

-- VIEWERS : profil public lisible, création/modification uniquement par le compte Auth propriétaire.
create policy "viewers_read_all"
on public.viewers
for select
to anon, authenticated
using (true);

create policy "viewers_insert_own_auth_profile"
on public.viewers
for insert
to authenticated
with check (auth_user_id = auth.uid());

create policy "viewers_update_own_or_staff"
on public.viewers
for update
to authenticated
using (
  auth_user_id = auth.uid()
  or public.current_ps_role() in ('admin','moderator')
)
with check (
  auth_user_id = auth.uid()
  or public.current_ps_role() in ('admin','moderator')
);

-- COMMENTS : lecture publique, écriture verrouillée par Auth.
create policy "comments_read_all"
on public.comments
for select
to anon, authenticated
using (true);

create policy "comments_insert_authenticated_owner"
on public.comments
for insert
to authenticated
with check (
  auth_user_id = auth.uid()
  and viewer_uuid in (
    select id from public.viewers where auth_user_id = auth.uid()
  )
);

create policy "comments_update_owner_or_staff"
on public.comments
for update
to authenticated
using (
  auth_user_id = auth.uid()
  or public.current_ps_role() in ('admin','moderator')
)
with check (
  auth_user_id = auth.uid()
  or public.current_ps_role() in ('admin','moderator')
);

create policy "comments_delete_owner_or_staff"
on public.comments
for delete
to authenticated
using (
  auth_user_id = auth.uid()
  or public.current_ps_role() in ('admin','moderator')
);

-- LIKES : un compte connecté like avec son propre profil viewer.
create policy "comment_likes_read_all"
on public.comment_likes
for select
to anon, authenticated
using (true);

create policy "comment_likes_insert_own"
on public.comment_likes
for insert
to authenticated
with check (
  viewer_id in (
    select id from public.viewers where auth_user_id = auth.uid()
  )
);

create policy "comment_likes_delete_own"
on public.comment_likes
for delete
to authenticated
using (
  viewer_id in (
    select id from public.viewers where auth_user_id = auth.uid()
  )
);

-- FAVORIS : privés au compte, lisibles/modifiables uniquement par le propriétaire.
create policy "movie_favorites_read_own"
on public.movie_favorites
for select
to authenticated
using (
  viewer_id in (
    select id from public.viewers where auth_user_id = auth.uid()
  )
);

create policy "movie_favorites_insert_own"
on public.movie_favorites
for insert
to authenticated
with check (
  viewer_id in (
    select id from public.viewers where auth_user_id = auth.uid()
  )
);

create policy "movie_favorites_delete_own"
on public.movie_favorites
for delete
to authenticated
using (
  viewer_id in (
    select id from public.viewers where auth_user_id = auth.uid()
  )
);

-- HISTORIQUE : privé au compte.
create policy "viewer_history_read_own"
on public.viewer_history
for select
to authenticated
using (
  viewer_id in (
    select id from public.viewers where auth_user_id = auth.uid()
  )
);

create policy "viewer_history_insert_own"
on public.viewer_history
for insert
to authenticated
with check (
  viewer_id in (
    select id from public.viewers where auth_user_id = auth.uid()
  )
);

create policy "viewer_history_update_own"
on public.viewer_history
for update
to authenticated
using (
  viewer_id in (
    select id from public.viewers where auth_user_id = auth.uid()
  )
)
with check (
  viewer_id in (
    select id from public.viewers where auth_user_id = auth.uid()
  )
);

commit;

-- Après exécution, vérification rapide :
-- select tablename, policyname, cmd, qual, with_check from pg_policies where tablename in ('viewers','comments','comment_likes','movie_favorites','viewer_history') order by tablename, policyname;
