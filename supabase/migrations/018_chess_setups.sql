-- 018_chess_setups.sql
-- Saved board setups: users arrange a position in the setup editor
-- and want to reuse it later without re-placing every piece. One row
-- per saved position (name + FEN, which carries board + side to move
-- + derived castling). Same self-RLS pattern as chess_games: the
-- client CRUDs its own rows directly, no RPC needed.

create table if not exists chess_setups (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  name text not null,
  fen text not null,
  created_at timestamptz not null default now()
);
create index if not exists chess_setups_user_idx
  on chess_setups (user_id, created_at desc);

alter table chess_setups enable row level security;
drop policy if exists "chess_setups self" on chess_setups;
create policy "chess_setups self" on chess_setups
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
