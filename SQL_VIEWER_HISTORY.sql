-- Planète Stream · Journal de bord administration communauté
-- À exécuter une seule fois dans Supabase SQL Editor.
-- IMPORTANT : ne pas confondre avec public.viewer_history, qui sert à l'historique de visionnage.

create table if not exists public.viewer_admin_history (
  id uuid primary key default gen_random_uuid(),
  target_viewer_id uuid references public.viewers(id) on delete set null,
  staff_viewer_id uuid references public.viewers(id) on delete set null,
  action text not null,
  old_value jsonb not null default '{}'::jsonb,
  new_value jsonb not null default '{}'::jsonb,
  reason text,
  created_at timestamptz not null default now()
);

create index if not exists viewer_admin_history_created_at_idx
  on public.viewer_admin_history (created_at desc);

create index if not exists viewer_admin_history_target_viewer_id_idx
  on public.viewer_admin_history (target_viewer_id);

create index if not exists viewer_admin_history_staff_viewer_id_idx
  on public.viewer_admin_history (staff_viewer_id);

alter table public.viewer_admin_history enable row level security;

drop policy if exists viewer_admin_history_staff_select on public.viewer_admin_history;
create policy viewer_admin_history_staff_select
on public.viewer_admin_history
for select
to authenticated
using (public.current_ps_role() = any (array['admin','founder','moderator']));

drop policy if exists viewer_admin_history_staff_insert on public.viewer_admin_history;
create policy viewer_admin_history_staff_insert
on public.viewer_admin_history
for insert
to authenticated
with check (public.current_ps_role() = any (array['admin','founder','moderator']));
