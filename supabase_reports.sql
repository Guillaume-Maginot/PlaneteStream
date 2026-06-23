-- Planète Stream · Signalements et modération
-- À lancer dans Supabase SQL Editor avant le déploiement du code.

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_viewer_id uuid not null references public.viewers(id) on delete cascade,
  target_type text not null default 'comment' check (target_type in ('comment')),
  target_id uuid not null references public.comments(id) on delete cascade,
  movie_id text,
  reason text not null check (reason in ('spam','insulte','spoiler','inapproprie','autre')),
  details text,
  status text not null default 'new' check (status in ('new','reviewed','ignored','closed')),
  created_at timestamptz not null default now(),
  handled_by uuid references public.viewers(id) on delete set null,
  handled_at timestamptz
);

create unique index if not exists reports_unique_reporter_target
  on public.reports(reporter_viewer_id, target_type, target_id);

create index if not exists reports_status_created_idx
  on public.reports(status, created_at desc);

create index if not exists reports_movie_idx
  on public.reports(movie_id);

alter table public.reports enable row level security;

create or replace function public.ps_is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.viewers v
    where v.auth_user_id = auth.uid()
      and (
        lower(coalesce(v.role,'')) in ('admin','founder','fondateur','moderator','moderateur','architecte')
        or lower(coalesce(v.badge,'')) in ('founder','fondateur','moderator','moderateur','architecte')
      )
  );
$$;

drop policy if exists "reports_insert_own" on public.reports;
create policy "reports_insert_own"
  on public.reports
  for insert
  to authenticated
  with check (
    exists (
      select 1 from public.viewers v
      where v.id = reporter_viewer_id
        and v.auth_user_id = auth.uid()
    )
  );

drop policy if exists "reports_select_own_or_staff" on public.reports;
create policy "reports_select_own_or_staff"
  on public.reports
  for select
  to authenticated
  using (
    public.ps_is_staff()
    or exists (
      select 1 from public.viewers v
      where v.id = reporter_viewer_id
        and v.auth_user_id = auth.uid()
    )
  );

drop policy if exists "reports_update_staff" on public.reports;
create policy "reports_update_staff"
  on public.reports
  for update
  to authenticated
  using (public.ps_is_staff())
  with check (public.ps_is_staff());

drop policy if exists "reports_delete_staff" on public.reports;
create policy "reports_delete_staff"
  on public.reports
  for delete
  to authenticated
  using (public.ps_is_staff());

-- Les modos/fondateurs/architectes peuvent supprimer un commentaire signalé directement depuis le site.
drop policy if exists "comments_delete_staff" on public.comments;
create policy "comments_delete_staff"
  on public.comments
  for delete
  to authenticated
  using (public.ps_is_staff());

-- Variante utile si ta table comments n'avait pas encore de policy SELECT publique/authentifiée.
drop policy if exists "comments_select_authenticated" on public.comments;
create policy "comments_select_authenticated"
  on public.comments
  for select
  to authenticated
  using (true);
