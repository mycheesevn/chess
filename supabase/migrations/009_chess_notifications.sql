-- In-app notification inbox for chess: every push-worthy event is also stored
-- here so users can review missed notifications later.
-- Run in the Supabase Dashboard SQL editor.
--
-- NOTE: chess tables are chess_-prefixed and reference public.profiles(id),
-- matching the other chess tables.

create table if not exists public.chess_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  kind text not null, -- 'challenge' | 'challenge_declined' | 'turn' | 'corr' | 'corr_end'
  title text not null,
  body text not null default '',
  url text not null default '/',
  ref_id uuid,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists chess_notifications_user_idx
  on public.chess_notifications(user_id, created_at desc);
alter table public.chess_notifications enable row level security;

drop policy if exists "Users can view own chess notifications" on public.chess_notifications;
create policy "Users can view own chess notifications"
  on public.chess_notifications for select to authenticated
  using (user_id = auth.uid());

drop policy if exists "Users can mark own chess notifications read" on public.chess_notifications;
create policy "Users can mark own chess notifications read"
  on public.chess_notifications for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- NOTE: no client INSERT policy on purpose — rows are written by the
-- server-side push trigger with the service-role key.
