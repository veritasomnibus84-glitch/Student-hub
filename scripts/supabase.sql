-- Student Hub : table de synchronisation (à lancer une fois dans Supabase > SQL Editor).
-- Une ligne par utilisateur ; la règle RLS empêche de lire ou d'écrire la ligne d'un autre.
create table if not exists public.user_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.user_state enable row level security;
drop policy if exists "ma ligne" on public.user_state;
create policy "ma ligne" on public.user_state
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
