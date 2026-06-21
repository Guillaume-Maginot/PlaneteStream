-- Planète Stream V2.4 · Sécurité avatars
-- Objectif : permettre à un membre de changer son avatar public,
-- sans pouvoir s'attribuer les avatars réservés fondateur/moderateur.

alter table public.viewers enable row level security;

-- On retire les anciennes policies UPDATE sur viewers pour éviter les doublons hérités.
do $$
declare
  p record;
begin
  for p in
    select policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'viewers'
      and cmd = 'UPDATE'
  loop
    execute format('drop policy if exists %I on public.viewers', p.policyname);
  end loop;
end $$;

create policy "Viewers can update own public avatar"
on public.viewers
for update
to authenticated
using (auth_user_id = auth.uid())
with check (
  auth_user_id = auth.uid()
  and coalesce(role, 'viewer') in ('viewer', 'member', 'vip')
  and coalesce(avatar, 'orbiteur') not in ('fondateur', 'moderateur')
);
