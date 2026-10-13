-- Chess on the SHARED database (xiangqi project).
-- Uses shared `profiles` and `friendships`; chess-specific tables are
-- prefixed with `chess_` to avoid collisions. Run in Dashboard SQL editor.

-- ============ CHESS STATS (per-game XP, extends shared profiles) ============
create table if not exists chess_stats (
  user_id uuid primary key references profiles(id) on delete cascade,
  xp int not null default 0,
  rating int not null default 800,
  games_played int not null default 0,
  wins int not null default 0,
  created_at timestamptz not null default now()
);
alter table chess_stats enable row level security;
drop policy if exists "chess_stats self" on chess_stats;
create policy "chess_stats self" on chess_stats
  for all using (auth.uid() = user_id);
drop policy if exists "chess_stats leaderboard" on chess_stats;
create policy "chess_stats leaderboard" on chess_stats
  for select using (true);

-- ============ DAILY CHECK-IN ============
create table if not exists chess_checkins (
  user_id uuid not null references profiles(id) on delete cascade,
  checkin_date date not null,
  streak int not null default 1,
  primary key (user_id, checkin_date)
);
alter table chess_checkins enable row level security;
drop policy if exists "chess_checkin self" on chess_checkins;
create policy "chess_checkin self" on chess_checkins
  for all using (auth.uid() = user_id);

create or replace function chess_claim_checkin()
returns table(streak int, xp_awarded int, already_claimed boolean)
language plpgsql security definer as $$
declare
  today date := (now() at time zone 'Asia/Ho_Chi_Minh')::date;
  yesterday date := today - 1;
  prev_streak int;
  new_streak int;
  xp int;
begin
  if exists (select 1 from chess_checkins where user_id = auth.uid() and checkin_date = today) then
    select chess_checkins.streak into new_streak from chess_checkins
      where user_id = auth.uid() and checkin_date = today;
    return query select new_streak, 0, true;
    return;
  end if;
  select chess_checkins.streak into prev_streak from chess_checkins
    where user_id = auth.uid() and checkin_date = yesterday;
  new_streak := coalesce(prev_streak, 0) + 1;
  xp := least(10 + 5 * (new_streak - 1), 40);
  insert into chess_checkins (user_id, checkin_date, streak)
    values (auth.uid(), today, new_streak);
  insert into chess_stats (user_id, xp) values (auth.uid(), xp)
    on conflict (user_id) do update set xp = chess_stats.xp + excluded.xp;
  return query select new_streak, xp, false;
end $$;
revoke all on function chess_claim_checkin() from public;
revoke all on function chess_claim_checkin() from anon;
grant execute on function chess_claim_checkin() to authenticated;

-- ============ VS-COMPUTER GAME HISTORY + XP ============
create table if not exists chess_games (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade,
  player_color text not null,
  ai_level int not null,
  result text not null,
  plies int not null default 0,
  created_at timestamptz not null default now()
);
alter table chess_games enable row level security;
drop policy if exists "chess_games self" on chess_games;
create policy "chess_games self" on chess_games
  for all using (auth.uid() = user_id);

create or replace function chess_record_game_result(
  p_color text, p_level int, p_result text, p_plies int
) returns int language plpgsql security definer as $$
declare xp int;
begin
  xp := case p_result
    when 'win' then 10 + 2 * p_level
    when 'draw' then 5
    else 3 end;
  insert into chess_games (user_id, player_color, ai_level, result, plies)
    values (auth.uid(), p_color, p_level, p_result, p_plies);
  insert into chess_stats (user_id, xp, games_played, wins)
    values (auth.uid(), xp, 1, case when p_result = 'win' then 1 else 0 end)
    on conflict (user_id) do update set
      xp = chess_stats.xp + excluded.xp,
      games_played = chess_stats.games_played + 1,
      wins = chess_stats.wins + excluded.wins;
  return xp;
end $$;
revoke all on function chess_record_game_result(text,int,text,int) from public;
revoke all on function chess_record_game_result(text,int,text,int) from anon;
grant execute on function chess_record_game_result(text,int,text,int) to authenticated;

-- ============ ROOMS ============
create table if not exists chess_rooms (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  name text not null,
  leader_id uuid references profiles(id),
  max_players int not null default 4,
  is_public boolean not null default false,
  status text not null default 'open',
  turn_order uuid[] not null default '{}',
  rules text,
  created_at timestamptz not null default now()
);
alter table chess_rooms enable row level security;

create table if not exists chess_room_members (
  room_id uuid not null references chess_rooms(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  role text not null default 'player',
  joined_at timestamptz not null default now(),
  primary key (room_id, user_id)
);
alter table chess_room_members enable row level security;

create or replace function is_chess_room_member(rid uuid)
returns boolean language sql security definer stable as $$
  select exists (
    select 1 from chess_room_members where room_id = rid and user_id = auth.uid());
$$;
create or replace function is_chess_room_leader(rid uuid)
returns boolean language sql security definer stable as $$
  select exists (
    select 1 from chess_rooms where id = rid and leader_id = auth.uid());
$$;

drop policy if exists "chess_rooms member read" on chess_rooms;
create policy "chess_rooms member read" on chess_rooms
  for select using (is_chess_room_member(id) or is_public);
drop policy if exists "chess_rooms leader update" on chess_rooms;
create policy "chess_rooms leader update" on chess_rooms
  for update using (is_chess_room_leader(id));
drop policy if exists "chess_members read" on chess_room_members;
create policy "chess_members read" on chess_room_members
  for select using (is_chess_room_member(room_id));
drop policy if exists "chess_members self join" on chess_room_members;
create policy "chess_members self join" on chess_room_members
  for insert with check (auth.uid() = user_id);

create table if not exists chess_room_matches (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references chess_rooms(id) on delete cascade,
  white_id uuid references profiles(id),
  black_id uuid references profiles(id),
  status text not null default 'active',
  moves text not null default '',
  result text,
  reason text,
  winner_id uuid references profiles(id),
  created_at timestamptz not null default now(),
  finished_at timestamptz
);
alter table chess_room_matches enable row level security;
drop policy if exists "chess_matches member read" on chess_room_matches;
create policy "chess_matches member read" on chess_room_matches
  for select using (is_chess_room_member(room_id));
drop policy if exists "chess_matches player update" on chess_room_matches;
create policy "chess_matches player update" on chess_room_matches
  for update using (
    status = 'active' and (auth.uid() = white_id or auth.uid() = black_id));

create table if not exists chess_room_comments (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references chess_rooms(id) on delete cascade,
  match_id uuid references chess_room_matches(id) on delete cascade,
  move_number int not null default 0,
  user_id uuid not null references profiles(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);
alter table chess_room_comments enable row level security;
drop policy if exists "chess_comments member read" on chess_room_comments;
create policy "chess_comments member read" on chess_room_comments
  for select using (is_chess_room_member(room_id));
drop policy if exists "chess_comments member write" on chess_room_comments;
create policy "chess_comments member write" on chess_room_comments
  for insert with check (is_chess_room_member(room_id) and auth.uid() = user_id);

create table if not exists chess_match_reactions (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references chess_rooms(id) on delete cascade,
  match_id uuid not null references chess_room_matches(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  emoji text not null,
  created_at timestamptz not null default now()
);
alter table chess_match_reactions enable row level security;
drop policy if exists "chess_reactions member" on chess_match_reactions;
create policy "chess_reactions member" on chess_match_reactions
  for all using (is_chess_room_member(room_id));

alter publication supabase_realtime add table public.chess_rooms;
alter publication supabase_realtime add table public.chess_room_members;
alter publication supabase_realtime add table public.chess_room_matches;
alter publication supabase_realtime add table public.chess_room_comments;
alter publication supabase_realtime add table public.chess_match_reactions;

-- ============ CHALLENGES (shared friendships table, chess-specific challenges) ============
create table if not exists chess_challenges (
  id uuid primary key default gen_random_uuid(),
  challenger_id uuid not null references profiles(id) on delete cascade,
  challenged_id uuid not null references profiles(id) on delete cascade,
  room_id uuid references chess_rooms(id) on delete cascade,
  status text not null default 'pending',
  created_at timestamptz not null default now()
);
alter table chess_challenges enable row level security;
drop policy if exists "chess_challenges party" on chess_challenges;
create policy "chess_challenges party" on chess_challenges
  for all using (auth.uid() = challenger_id or auth.uid() = challenged_id);
alter publication supabase_realtime add table public.chess_challenges;

-- ============ REFERRALS ============
create table if not exists chess_referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_id uuid not null references profiles(id) on delete cascade,
  referee_id uuid not null references profiles(id) on delete cascade unique,
  created_at timestamptz not null default now()
);
alter table chess_referrals enable row level security;
drop policy if exists "chess_referrals party" on chess_referrals;
create policy "chess_referrals party" on chess_referrals
  for select using (auth.uid() = referrer_id or auth.uid() = referee_id);

create or replace function chess_claim_referral(p_referrer_id uuid)
returns boolean language plpgsql security definer as $$
begin
  if p_referrer_id = auth.uid() then return false; end if;
  insert into chess_referrals (referrer_id, referee_id)
    values (p_referrer_id, auth.uid())
  on conflict (referee_id) do nothing;
  if found then
    insert into chess_stats (user_id, xp) values (p_referrer_id, 20)
      on conflict (user_id) do update set xp = chess_stats.xp + 20;
    insert into chess_stats (user_id, xp) values (auth.uid(), 20)
      on conflict (user_id) do update set xp = chess_stats.xp + 20;
    return true;
  end if;
  return false;
end $$;
revoke all on function chess_claim_referral(uuid) from public;
revoke all on function chess_claim_referral(uuid) from anon;
grant execute on function chess_claim_referral(uuid) to authenticated;
