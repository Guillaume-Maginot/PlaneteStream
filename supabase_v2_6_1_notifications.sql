-- Planète Stream V2.6.1 · Messages du Hall
-- Notifications internes discrètes pour réponses aux critiques et messages.

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_viewer_id uuid not null references public.viewers(id) on delete cascade,
  actor_viewer_id uuid references public.viewers(id) on delete set null,
  type text not null default 'reply',
  movie_id text,
  comment_id uuid references public.comments(id) on delete cascade,
  parent_comment_id uuid references public.comments(id) on delete set null,
  message text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists notifications_recipient_created_idx
on public.notifications(recipient_viewer_id, created_at desc);

create index if not exists notifications_recipient_unread_idx
on public.notifications(recipient_viewer_id, read_at)
where read_at is null;

alter table public.notifications enable row level security;

drop policy if exists "Notifications can be read by recipient" on public.notifications;
drop policy if exists "Notifications can be updated by recipient" on public.notifications;
drop policy if exists "Notifications can be deleted by recipient" on public.notifications;
drop policy if exists "Authenticated viewers can create notifications" on public.notifications;

create policy "Notifications can be read by recipient"
on public.notifications
for select
to authenticated
using (
  exists (
    select 1
    from public.viewers v
    where v.id = notifications.recipient_viewer_id
      and v.auth_user_id = auth.uid()
  )
);

create policy "Notifications can be updated by recipient"
on public.notifications
for update
to authenticated
using (
  exists (
    select 1
    from public.viewers v
    where v.id = notifications.recipient_viewer_id
      and v.auth_user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.viewers v
    where v.id = notifications.recipient_viewer_id
      and v.auth_user_id = auth.uid()
  )
);

create policy "Notifications can be deleted by recipient"
on public.notifications
for delete
to authenticated
using (
  exists (
    select 1
    from public.viewers v
    where v.id = notifications.recipient_viewer_id
      and v.auth_user_id = auth.uid()
  )
);

create policy "Authenticated viewers can create notifications"
on public.notifications
for insert
to authenticated
with check (
  exists (
    select 1
    from public.viewers v
    where v.id = notifications.actor_viewer_id
      and v.auth_user_id = auth.uid()
  )
  and recipient_viewer_id <> actor_viewer_id
);
