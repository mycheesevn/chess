-- Daily chess puzzles: solve tracking + XP rewards.
-- Puzzles themselves live in lib/chess/puzzles.ts (deterministic daily pick).

create table if not exists chess_puzzle_solves (
  user_id uuid not null references profiles(id) on delete cascade,
  puzzle_date date not null,
  solved boolean not null default true,
  attempts int not null default 1,
  solved_at timestamptz not null default now(),
  primary key (user_id, puzzle_date)
);
alter table chess_puzzle_solves enable row level security;
drop policy if exists "chess_puzzle_solves self" on chess_puzzle_solves;
create policy "chess_puzzle_solves self" on chess_puzzle_solves
  for all using (auth.uid() = user_id);

-- Record a puzzle solve. Idempotent: +15 XP only on the first solve of the day.
-- Returns true if this call newly solved it (XP awarded), false otherwise.
create or replace function chess_record_puzzle_solve(p_date date)
returns boolean language plpgsql security definer as $$
begin
  if exists (
    select 1 from chess_puzzle_solves
    where user_id = auth.uid() and puzzle_date = p_date
  ) then
    update chess_puzzle_solves
      set attempts = attempts + 1
      where user_id = auth.uid() and puzzle_date = p_date;
    return false;
  end if;
  insert into chess_puzzle_solves (user_id, puzzle_date, solved, attempts)
    values (auth.uid(), p_date, true, 1);
  insert into chess_stats (user_id, xp) values (auth.uid(), 15)
    on conflict (user_id) do update set xp = chess_stats.xp + 15;
  return true;
end $$;
revoke all on function chess_record_puzzle_solve(date) from public;
revoke all on function chess_record_puzzle_solve(date) from anon;
grant execute on function chess_record_puzzle_solve(date) to authenticated;
