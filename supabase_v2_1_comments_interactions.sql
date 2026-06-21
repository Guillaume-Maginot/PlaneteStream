-- Planète Stream V2.1 · Avis & interactions
-- À exécuter seulement si les boutons Modifier / Supprimer / Répondre ne passent pas côté Supabase.
-- Ce script ne casse pas les données. Il confirme juste les colonnes et policies nécessaires.

begin;

alter table public.comments
  add column if not exists auth_user_id uuid references auth.users(id) on delete set null,
  add column if not exists viewer_uuid uuid references public.viewers(id) on delete set null,
  add column if not exists parent_id uuid references public.comments(id) on delete cascade,
  add column if not exists edited_at timestamptz,
  add column if not exists likes_count integer not null default 0;

create index if not exists comments_parent_id_idx on public.comments(parent_id);
create index if not exists comments_auth_user_id_idx on public.comments(auth_user_id);
create index if not exists comments_viewer_uuid_idx on public.comments(viewer_uuid);

alter table public.comments enable row level security;

-- On recrée seulement les policies comments de la V2 Auth-only.
drop policy if exists "comments_read_all" on public.comments;
drop policy if exists "comments_insert_authenticated_owner" on public.comments;
drop policy if exists "comments_update_owner_or_staff" on public.comments;
drop policy if exists "comments_delete_owner_or_staff" on public.comments;

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

commit;
