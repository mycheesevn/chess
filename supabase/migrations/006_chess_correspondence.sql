-- Correspondence (async) chess: slow games where each side moves
-- whenever they are online. One row per game, moves as space-separated UCI.
-- Run in Dashboard SQL editor.

-- ============ CORRESPONDENCE GAMES ============
create table if not exists chess_corr_games (
  id uuid primary key default gen_random_uuid(),
  white_id uuid not null references profiles(id) on delete cascade,
  black_id uuid not null references profiles(id) on delete cascade,
  status text not null default 'active',
  moves text not null default '',
  result text,
  winner_id uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table chess_corr_games enable row level security;

drop policy if exists "chess_corr_games player read" on chess_corr_games;
create policy "chess_corr_games player read" on chess_corr_games
  for select using (auth.uid() = white_id or auth.uid() = black_id);
drop policy if exists "chess_corr_games player insert" on chess_corr_games;
create policy "chess_corr_games player insert" on chess_corr_games
  for insert with check (auth.uid() = white_id or auth.uid() = black_id);
drop policy if exists "chess_corr_games player update" on chess_corr_games;
create policy "chess_corr_games player update" on chess_corr_games
  for update using (
    status = 'active' and (auth.uid() = white_id or auth.uid() = black_id));

-- Realtime so opponent moves arrive live
alter publication supabase_realtime add table public.chess_corr_games;
