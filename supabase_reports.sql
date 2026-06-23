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


-- Correction anti-doublon : on retire les anciens index éventuels qui bloquaient
-- un second signalement du même message par un autre membre.
drop index if exists public.reports_unique_target;
drop index if exists public.reports_target_unique;
drop index if exists public.reports_unique_report_target;
drop index if exists public.reports_unique_target_type_target_id;
drop index if exists public.reports_unique_target_id;

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

-- Lecture publique des critiques : les invités doivent voir les avis déjà publiés.
-- Les actions restent réservées aux comptes connectés côté code/RLS.
drop policy if exists "comments_select_authenticated" on public.comments;
drop policy if exists "comments_select_public" on public.comments;
create policy "comments_select_public"
  on public.comments
  for select
  to anon, authenticated
  using (true);


-- Synchronisation des alertes de modération : quand un signalement est traité
-- par un membre de l'équipe, les notifications associées peuvent être marquées
-- comme lues pour toute l'équipe afin d'éviter les alertes fantômes.
drop policy if exists "notifications_update_staff_reports" on public.notifications;
create policy "notifications_update_staff_reports"
  on public.notifications
  for update
  to authenticated
  using (
    public.ps_is_staff()
    and type = 'report'
  )
  with check (
    public.ps_is_staff()
    and type = 'report'
  );

-- Planète Stream · Bannissements temporaires
-- À relancer dans Supabase pour ajouter les durées de ban et autoriser les modos à poser un ban temporaire.

alter table public.viewers
  add column if not exists banned_until timestamptz,
  add column if not exists ban_reason text,
  add column if not exists banned_by uuid references public.viewers(id) on delete set null;

create index if not exists viewers_ban_active_idx
  on public.viewers(banned_at, banned_until);

create or replace function public.ps_current_staff_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select case
    when exists (
      select 1 from public.viewers v
      where v.auth_user_id = auth.uid()
        and (
          lower(coalesce(v.role,'')) in ('admin','founder','fondateur','architecte')
          or lower(coalesce(v.badge,'')) in ('founder','fondateur','architecte')
        )
    ) then 'admin'
    when exists (
      select 1 from public.viewers v
      where v.auth_user_id = auth.uid()
        and (
          lower(coalesce(v.role,'')) in ('moderator','moderateur')
          or lower(coalesce(v.badge,'')) in ('moderator','moderateur')
        )
    ) then 'moderator'
    else 'viewer'
  end;
$$;

create or replace function public.ps_current_viewer_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select v.id
  from public.viewers v
  where v.auth_user_id = auth.uid()
  limit 1;
$$;

create or replace function public.ps_viewer_is_active(viewer_uuid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select not exists (
    select 1
    from public.viewers v
    where v.id = viewer_uuid
      and v.banned_at is not null
      and (v.banned_until is null or v.banned_until > now())
  );
$$;

-- Les membres bannis ne doivent plus pouvoir poster tant que le ban est actif.
-- Ces policies complètent l'existant : si tes policies portent d'autres noms, elles restent en place.
drop policy if exists "comments_insert_active_viewer" on public.comments;
create policy "comments_insert_active_viewer"
  on public.comments
  for insert
  to authenticated
  with check (
    public.ps_viewer_is_active(viewer_uuid)
  );

-- Autorise les modérateurs à poser uniquement des bans temporaires sur des viewers simples.
-- Fondateurs / Architecte gardent le permanent et le déban.
drop policy if exists "viewers_update_staff_bans" on public.viewers;
create policy "viewers_update_staff_bans"
  on public.viewers
  for update
  to authenticated
  using (
    public.ps_current_staff_role() in ('admin','moderator')
    and id <> public.ps_current_viewer_id()
    and lower(coalesce(role,'')) not in ('admin','founder','fondateur','architecte')
    and lower(coalesce(badge,'')) not in ('founder','fondateur','architecte')
    and not (
      public.ps_current_staff_role() = 'moderator'
      and lower(coalesce(role,'')) in ('moderator','moderateur')
    )
  )
  with check (
    public.ps_current_staff_role() = 'admin'
    or (
      public.ps_current_staff_role() = 'moderator'
      and banned_at is not null
      and banned_until is not null
      and banned_until <= now() + interval '7 days 5 minutes'
    )
  );
