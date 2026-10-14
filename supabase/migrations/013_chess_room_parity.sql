-- 013: Room parity with PacClone (boardgame-engagement skill,
-- references/rooms.md). Until now Chess rooms were client-driven
-- direct table writes, which production RLS silently breaks:
--   * chess_rooms had NO insert policy      -> creating a room fails
--   * private rooms are invisible to non-members -> join-by-code fails
--   * turn_order UPDATE policy is leader-only -> joiners never rotate in
--   * chess_room_matches had NO insert policy -> starting a match fails
-- This migration moves every privileged room operation into SECURITY
-- DEFINER RPCs (PacClone pattern), adds the room XP ledger, guest
-- discovery RPCs + anon read policies for public rooms, and the
-- comment-XP trigger. Room status vocabulary: 'open' | 'playing' |
-- 'closed'. Match results: 'white' | 'black' | 'draw'.

-- ---------- 0. Room creation fix ----------
drop policy if exists "chess_rooms leader insert" on chess_rooms;
create policy "chess_rooms leader insert" on chess_rooms
  for insert to authenticated with check (auth.uid() = leader_id);

-- ---------- 1. Room XP ledger (anti-double-award guard) ----------
create table if not exists chess_room_xp_ledger (
  user_id uuid not null references profiles(id) on delete cascade,
  kind text not null check (kind in ('play','host','comment','daily')),
  ref_id uuid not null,
  day date not null default current_date,
  xp int not null,
  primary key (user_id, kind, ref_id, day)
);
alter table chess_room_xp_ledger enable row level security;
drop policy if exists "chess_room_xp self read" on chess_room_xp_ledger;
create policy "chess_room_xp self read" on chess_room_xp_ledger
  for select to authenticated using (auth.uid() = user_id);

-- Internal award helper: inserts into the ledger (idempotent); only
-- when the insert lands, atomically adds XP to chess_stats.
create or replace function public.chess_award_room_xp(
  p_user_id uuid, p_kind text, p_ref_id uuid, p_xp int
) returns boolean
language plpgsql security definer set search_path = public as $$
declare v_inserted boolean := false;
begin
  insert into chess_room_xp_ledger (user_id, kind, ref_id, day, xp)
  values (p_user_id, p_kind, p_ref_id, current_date, p_xp)
  on conflict do nothing
  returning true into v_inserted;
  if coalesce(v_inserted, false) then
    insert into chess_stats (user_id, xp)
    values (p_user_id, p_xp)
    on conflict (user_id) do update set xp = chess_stats.xp + excluded.xp;
    return true;
  end if;
  return false;
end $$;
revoke all on function public.chess_award_room_xp(uuid, text, uuid, int) from public;
revoke all on function public.chess_award_room_xp(uuid, text, uuid, int) from anon;
revoke all on function public.chess_award_room_xp(uuid, text, uuid, int) from authenticated;

-- ---------- 2. Membership RPCs ----------
create or replace function public.chess_join_room(p_code text)
returns chess_rooms
language plpgsql security definer set search_path = public as $$
declare
  v_room chess_rooms;
  v_count int;
begin
  select * into v_room from chess_rooms where code = upper(trim(p_code));
  if not found then raise exception 'room_not_found'; end if;
  if exists (select 1 from chess_room_members
             where room_id = v_room.id and user_id = auth.uid()) then
    return v_room; -- idempotent for existing members
  end if;
  if v_room.status = 'closed' then raise exception 'room_closed'; end if;
  select count(*) into v_count from chess_room_members where room_id = v_room.id;
  if v_count >= v_room.max_players then raise exception 'room_full'; end if;
  insert into chess_room_members (room_id, user_id, role)
  values (v_room.id, auth.uid(), 'player');
  if not (auth.uid() = any (v_room.turn_order)) then
    update chess_rooms
      set turn_order = turn_order || auth.uid()
      where id = v_room.id
      returning * into v_room;
  end if;
  return v_room;
end $$;
revoke all on function public.chess_join_room(text) from public;
revoke all on function public.chess_join_room(text) from anon;
grant execute on function public.chess_join_room(text) to authenticated;

create or replace function public.chess_leave_room(p_room_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if is_chess_room_leader(p_room_id) then
    raise exception 'leader_cannot_leave';
  end if;
  delete from chess_room_members
    where room_id = p_room_id and user_id = auth.uid();
  update chess_rooms
    set turn_order = array_remove(turn_order, auth.uid())
    where id = p_room_id;
end $$;
revoke all on function public.chess_leave_room(uuid) from public;
revoke all on function public.chess_leave_room(uuid) from anon;
grant execute on function public.chess_leave_room(uuid) to authenticated;

create or replace function public.chess_kick_member(p_room_id uuid, p_user_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_chess_room_leader(p_room_id) then raise exception 'not_leader'; end if;
  if p_user_id = auth.uid() then raise exception 'cannot_kick_self'; end if;
  delete from chess_room_members
    where room_id = p_room_id and user_id = p_user_id;
  update chess_rooms
    set turn_order = array_remove(turn_order, p_user_id)
    where id = p_room_id;
end $$;
revoke all on function public.chess_kick_member(uuid, uuid) from public;
revoke all on function public.chess_kick_member(uuid, uuid) from anon;
grant execute on function public.chess_kick_member(uuid, uuid) to authenticated;

create or replace function public.chess_set_member_role(
  p_room_id uuid, p_user_id uuid, p_role text
) returns void
language plpgsql security definer set search_path = public as $$
declare v_room chess_rooms;
begin
  if not is_chess_room_leader(p_room_id) then raise exception 'not_leader'; end if;
  if p_role not in ('player','spectator') then raise exception 'invalid_role'; end if;
  select * into v_room from chess_rooms where id = p_room_id;
  if p_user_id = v_room.leader_id and p_role = 'spectator' then
    raise exception 'leader_must_play';
  end if;
  update chess_room_members set role = p_role
    where room_id = p_room_id and user_id = p_user_id;
  if p_role = 'spectator' then
    update chess_rooms
      set turn_order = array_remove(turn_order, p_user_id)
      where id = p_room_id;
  elsif not (p_user_id = any (v_room.turn_order)) then
    update chess_rooms
      set turn_order = turn_order || p_user_id
      where id = p_room_id;
  end if;
end $$;
revoke all on function public.chess_set_member_role(uuid, uuid, text) from public;
revoke all on function public.chess_set_member_role(uuid, uuid, text) from anon;
grant execute on function public.chess_set_member_role(uuid, uuid, text) to authenticated;

create or replace function public.chess_set_turn_order(p_room_id uuid, p_order uuid[])
returns void
language plpgsql security definer set search_path = public as $$
declare v_clean uuid[];
begin
  if not is_chess_room_leader(p_room_id) then raise exception 'not_leader'; end if;
  -- Keep the requested order for current players only (deduped)…
  select coalesce(array_agg(m.user_id order by array_position(p_order, m.user_id)), '{}')
    into v_clean
    from chess_room_members m
    where m.room_id = p_room_id and m.role = 'player'
      and m.user_id = any (p_order);
  -- …then append any current players the list forgot, by join order.
  select v_clean || coalesce(array_agg(m.user_id order by m.joined_at), '{}')
    into v_clean
    from chess_room_members m
    where m.room_id = p_room_id and m.role = 'player'
      and not (m.user_id = any (v_clean));
  update chess_rooms set turn_order = v_clean where id = p_room_id;
end $$;
revoke all on function public.chess_set_turn_order(uuid, uuid[]) from public;
revoke all on function public.chess_set_turn_order(uuid, uuid[]) from anon;
grant execute on function public.chess_set_turn_order(uuid, uuid[]) to authenticated;

create or replace function public.chess_close_room(p_room_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_chess_room_leader(p_room_id) then raise exception 'not_leader'; end if;
  update chess_rooms set status = 'closed' where id = p_room_id;
end $$;
revoke all on function public.chess_close_room(uuid) from public;
revoke all on function public.chess_close_room(uuid) from anon;
grant execute on function public.chess_close_room(uuid) to authenticated;

create or replace function public.chess_update_room_rules(p_room_id uuid, p_rules text)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_chess_room_leader(p_room_id) then raise exception 'not_leader'; end if;
  update chess_rooms
    set rules = nullif(left(trim(coalesce(p_rules, '')), 500), '')
    where id = p_room_id;
end $$;
revoke all on function public.chess_update_room_rules(uuid, text) from public;
revoke all on function public.chess_update_room_rules(uuid, text) from anon;
grant execute on function public.chess_update_room_rules(uuid, text) to authenticated;

create or replace function public.chess_set_room_public(p_room_id uuid, p_public boolean)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_chess_room_leader(p_room_id) then raise exception 'not_leader'; end if;
  update chess_rooms set is_public = p_public where id = p_room_id;
end $$;
revoke all on function public.chess_set_room_public(uuid, boolean) from public;
revoke all on function public.chess_set_room_public(uuid, boolean) from anon;
grant execute on function public.chess_set_room_public(uuid, boolean) to authenticated;

-- ---------- 3. Match RPCs ----------
-- Sanitized rotation order shared by start_next_match: current
-- players in stored turn_order first, then any unlisted players.
create or replace function public.chess_start_next_match(p_room_id uuid)
returns chess_room_matches
language plpgsql security definer set search_path = public as $$
declare
  v_room chess_rooms;
  v_order uuid[];
  v_match chess_room_matches;
begin
  if not is_chess_room_leader(p_room_id) then raise exception 'not_leader'; end if;
  select * into v_room from chess_rooms where id = p_room_id;
  if v_room.status = 'closed' then raise exception 'room_closed'; end if;
  if exists (select 1 from chess_room_matches
             where room_id = p_room_id and status = 'active') then
    raise exception 'match_in_progress';
  end if;
  select coalesce(array_agg(m.user_id order by array_position(v_room.turn_order, m.user_id)), '{}')
    into v_order
    from chess_room_members m
    where m.room_id = p_room_id and m.role = 'player'
      and m.user_id = any (v_room.turn_order);
  select v_order || coalesce(array_agg(m.user_id order by m.joined_at), '{}')
    into v_order
    from chess_room_members m
    where m.room_id = p_room_id and m.role = 'player'
      and not (m.user_id = any (v_order));
  if coalesce(array_length(v_order, 1), 0) < 2 then
    raise exception 'room_need_two_players';
  end if;
  insert into chess_room_matches (room_id, white_id, black_id)
  values (p_room_id, v_order[1], v_order[2])
  returning * into v_match;
  -- Rotate: the first player goes to the end so everyone cycles.
  update chess_rooms
    set turn_order = v_order[2:] || v_order[1], status = 'playing'
    where id = p_room_id;
  return v_match;
end $$;
revoke all on function public.chess_start_next_match(uuid) from public;
revoke all on function public.chess_start_next_match(uuid) from anon;
grant execute on function public.chess_start_next_match(uuid) to authenticated;

create or replace function public.chess_finish_room_match(
  p_match_id uuid, p_result text, p_reason text
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_match chess_room_matches;
  v_room chess_rooms;
  v_winner uuid;
  v_plies int;
  v_play int := 0;
  v_host int := 0;
  v_daily int := 0;
  v_nil uuid := '00000000-0000-0000-0000-000000000000';
  v_host_today int;
  v_pairings jsonb;
  v_new_pairings jsonb;
  v_elem jsonb;
  v_remaining int;
  v_ok boolean;
begin
  select * into v_match from chess_room_matches where id = p_match_id;
  if not found then raise exception 'match_not_found'; end if;
  select * into v_room from chess_rooms where id = v_match.room_id;
  if auth.uid() <> v_match.white_id and auth.uid() <> v_match.black_id
     and auth.uid() <> v_room.leader_id then
    raise exception 'not_allowed';
  end if;
  if v_match.status <> 'active' then
    return jsonb_build_object('play_xp', 0, 'host_xp', 0, 'daily_xp', 0);
  end if;
  v_winner := case p_result
    when 'white' then v_match.white_id
    when 'black' then v_match.black_id
    else null end;
  update chess_room_matches
    set status = 'finished', result = p_result, reason = p_reason,
        winner_id = v_winner, finished_at = now()
    where id = p_match_id;
  update chess_rooms set status = 'open'
    where id = v_match.room_id and status = 'playing';

  v_plies := case when trim(v_match.moves) = '' then 0
    else array_length(string_to_array(trim(v_match.moves), ' '), 1) end;

  -- Match XP (anti-farm: only games with >= 10 plies pay out).
  -- Award calls run into v_ok FIRST: side-effecting functions must
  -- never sit inside an AND condition (Postgres may reorder it).
  if v_plies >= 10 then
    if p_result = 'draw' then
      v_ok := chess_award_room_xp(v_match.white_id, 'play', p_match_id, 8);
      if v_ok and auth.uid() = v_match.white_id then v_play := 8; end if;
      v_ok := chess_award_room_xp(v_match.black_id, 'play', p_match_id, 8);
      if v_ok and auth.uid() = v_match.black_id then v_play := 8; end if;
    else
      v_ok := chess_award_room_xp(v_winner, 'play', p_match_id, 15);
      if v_ok and auth.uid() = v_winner then v_play := 15; end if;
      v_ok := chess_award_room_xp(
        case when v_winner = v_match.white_id
             then v_match.black_id else v_match.white_id end,
        'play', p_match_id, 5);
      if v_ok and auth.uid() <> v_winner
         and (auth.uid() = v_match.white_id or auth.uid() = v_match.black_id)
      then v_play := 5; end if;
    end if;
    -- Host bonus +5/match, capped at 10 XP/day.
    select coalesce(sum(xp), 0) into v_host_today from chess_room_xp_ledger
      where user_id = v_room.leader_id and kind = 'host' and day = current_date;
    if v_host_today < 10 then
      v_ok := chess_award_room_xp(v_room.leader_id, 'host', p_match_id, 5);
      if v_ok and auth.uid() = v_room.leader_id then v_host := 5; end if;
    end if;
    -- Daily participation +10 once/day for both players.
    v_ok := chess_award_room_xp(v_match.white_id, 'daily', v_nil, 10);
    if v_ok and auth.uid() = v_match.white_id then v_daily := 10; end if;
    v_ok := chess_award_room_xp(v_match.black_id, 'daily', v_nil, 10);
    if v_ok and auth.uid() = v_match.black_id then v_daily := 10; end if;
  end if;

  -- Tournament write-back: stamp this pairing's result; auto-finish
  -- the tournament when every pairing has a result.
  if v_match.tournament_id is not null then
    select pairings into v_pairings from chess_tournaments
      where id = v_match.tournament_id;
    if v_pairings is not null then
      v_new_pairings := '[]'::jsonb;
      for v_elem in select * from jsonb_array_elements(v_pairings) loop
        if v_elem ->> 'match_id' = p_match_id::text then
          v_elem := v_elem || jsonb_build_object('result', p_result);
        end if;
        v_new_pairings := v_new_pairings || v_elem;
      end loop;
      select count(*) into v_remaining from jsonb_array_elements(v_new_pairings) e
        where e ->> 'result' is null;
      update chess_tournaments
        set pairings = v_new_pairings,
            status = case when v_remaining = 0 then 'finished' else status end,
            finished_at = case when v_remaining = 0 then now() else finished_at end
        where id = v_match.tournament_id;
    end if;
  end if;

  return jsonb_build_object('play_xp', v_play, 'host_xp', v_host, 'daily_xp', v_daily);
end $$;
revoke all on function public.chess_finish_room_match(uuid, text, text) from public;
revoke all on function public.chess_finish_room_match(uuid, text, text) from anon;
grant execute on function public.chess_finish_room_match(uuid, text, text) to authenticated;

create or replace function public.chess_cancel_room_match(p_match_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare v_match chess_room_matches;
begin
  select * into v_match from chess_room_matches where id = p_match_id;
  if not found then raise exception 'match_not_found'; end if;
  if not is_chess_room_leader(v_match.room_id) then
    raise exception 'not_leader';
  end if;
  update chess_room_matches
    set status = 'cancelled', reason = 'cancelled', finished_at = now()
    where id = p_match_id and status = 'active';
  update chess_rooms set status = 'open'
    where id = v_match.room_id and status = 'playing';
end $$;
revoke all on function public.chess_cancel_room_match(uuid) from public;
revoke all on function public.chess_cancel_room_match(uuid) from anon;
grant execute on function public.chess_cancel_room_match(uuid) to authenticated;

create or replace function public.chess_rematch(p_room_id uuid)
returns chess_room_matches
language plpgsql security definer set search_path = public as $$
declare
  v_prev chess_room_matches;
  v_match chess_room_matches;
begin
  select * into v_prev from chess_room_matches
    where room_id = p_room_id and status = 'finished'
    order by finished_at desc nulls last, created_at desc
    limit 1;
  if not found then raise exception 'match_not_found'; end if;
  if auth.uid() <> v_prev.white_id and auth.uid() <> v_prev.black_id then
    raise exception 'not_allowed';
  end if;
  if exists (select 1 from chess_room_matches
             where room_id = p_room_id and status = 'active') then
    raise exception 'match_in_progress';
  end if;
  -- Same two players, swapped colors.
  insert into chess_room_matches (room_id, white_id, black_id)
  values (p_room_id, v_prev.black_id, v_prev.white_id)
  returning * into v_match;
  update chess_rooms set status = 'playing' where id = p_room_id;
  return v_match;
end $$;
revoke all on function public.chess_rematch(uuid) from public;
revoke all on function public.chess_rematch(uuid) from anon;
grant execute on function public.chess_rematch(uuid) to authenticated;

-- ---------- 4. Tournament RPCs ----------
create or replace function public.chess_tournament_next_match(p_tournament_id uuid)
returns chess_room_matches
language plpgsql security definer set search_path = public as $$
declare
  v_t chess_tournaments;
  v_pairings jsonb;
  v_new_pairings jsonb := '[]'::jsonb;
  v_elem jsonb;
  v_white uuid;
  v_black uuid;
  v_match chess_room_matches;
  v_stamped boolean := false;
begin
  select * into v_t from chess_tournaments where id = p_tournament_id;
  if not found then raise exception 'tournament_not_found'; end if;
  if not is_chess_room_leader(v_t.room_id) then raise exception 'not_leader'; end if;
  if v_t.status <> 'open' then raise exception 'tournament_finished'; end if;
  if exists (select 1 from chess_room_matches
             where room_id = v_t.room_id and status = 'active') then
    raise exception 'match_in_progress';
  end if;
  for v_elem in select * from jsonb_array_elements(v_t.pairings) loop
    if not v_stamped and v_elem ->> 'result' is null then
      v_white := (v_elem ->> 'white')::uuid;
      v_black := (v_elem ->> 'black')::uuid;
      insert into chess_room_matches (room_id, white_id, black_id, tournament_id)
      values (v_t.room_id, v_white, v_black, p_tournament_id)
      returning * into v_match;
      v_elem := v_elem || jsonb_build_object('match_id', v_match.id);
      v_stamped := true;
    end if;
    v_new_pairings := v_new_pairings || v_elem;
  end loop;
  if not v_stamped then raise exception 'tournament_finished'; end if;
  update chess_tournaments set pairings = v_new_pairings where id = p_tournament_id;
  update chess_rooms set status = 'playing' where id = v_t.room_id;
  return v_match;
end $$;
revoke all on function public.chess_tournament_next_match(uuid) from public;
revoke all on function public.chess_tournament_next_match(uuid) from anon;
grant execute on function public.chess_tournament_next_match(uuid) to authenticated;

create or replace function public.chess_cancel_tournament(p_tournament_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare v_t chess_tournaments;
begin
  select * into v_t from chess_tournaments where id = p_tournament_id;
  if not found then raise exception 'tournament_not_found'; end if;
  if not is_chess_room_leader(v_t.room_id) then raise exception 'not_leader'; end if;
  update chess_tournaments
    set status = 'finished', finished_at = now()
    where id = p_tournament_id and status = 'open';
end $$;
revoke all on function public.chess_cancel_tournament(uuid) from public;
revoke all on function public.chess_cancel_tournament(uuid) from anon;
grant execute on function public.chess_cancel_tournament(uuid) to authenticated;

-- Tournaments were never added to the realtime publication.
do $$ begin
  alter publication supabase_realtime add table public.chess_tournaments;
exception when duplicate_object then null;
end $$;

-- ---------- 5. Comment XP trigger (+2/comment, cap 10/day) ----------
create or replace function public.chess_award_comment_xp()
returns trigger
language plpgsql security definer set search_path = public as $$
declare v_today int;
begin
  if length(trim(new.body)) >= 4 then
    select coalesce(sum(xp), 0) into v_today from chess_room_xp_ledger
      where user_id = new.user_id and kind = 'comment' and day = current_date;
    if v_today < 10 then
      perform chess_award_room_xp(new.user_id, 'comment', new.id, 2);
    end if;
  end if;
  perform chess_award_room_xp(
    new.user_id, 'daily', '00000000-0000-0000-0000-000000000000', 10);
  return new;
end $$;
revoke all on function public.chess_award_comment_xp() from public;
revoke all on function public.chess_award_comment_xp() from anon;
revoke all on function public.chess_award_comment_xp() from authenticated;
drop trigger if exists chess_comments_xp on chess_room_comments;
create trigger chess_comments_xp
  after insert on chess_room_comments
  for each row execute function public.chess_award_comment_xp();

-- ---------- 6. Discovery & guest RPCs (anon-safe) ----------
create or replace function public.chess_preview_room(p_code text)
returns table (name text, member_count bigint, is_public boolean, status text, rules text)
language sql security definer stable set search_path = public as $$
  select r.name,
         (select count(*) from chess_room_members m where m.room_id = r.id),
         r.is_public, r.status, r.rules
  from chess_rooms r
  where r.code = upper(trim(p_code));
$$;
revoke all on function public.chess_preview_room(text) from public;
grant execute on function public.chess_preview_room(text) to anon, authenticated;

create or replace function public.chess_list_public_rooms()
returns table (id uuid, code text, name text, member_count bigint,
               max_players int, has_active_match boolean)
language sql security definer stable set search_path = public as $$
  select r.id, r.code, r.name,
         (select count(*) from chess_room_members m where m.room_id = r.id),
         r.max_players,
         exists (select 1 from chess_room_matches mt
                 where mt.room_id = r.id and mt.status = 'active')
  from chess_rooms r
  where r.is_public and r.status <> 'closed'
  order by 6 desc, 4 desc
  limit 30;
$$;
revoke all on function public.chess_list_public_rooms() from public;
grant execute on function public.chess_list_public_rooms() to anon, authenticated;

create or replace function public.chess_room_leaderboard()
returns table (room_id uuid, name text, code text,
               matches_7d bigint, member_count bigint)
language sql security definer stable set search_path = public as $$
  select r.id, r.name, r.code,
         (select count(*) from chess_room_matches m
          where m.room_id = r.id and m.status = 'finished'
            and m.created_at > now() - interval '7 days'),
         (select count(*) from chess_room_members mb where mb.room_id = r.id)
  from chess_rooms r
  where r.is_public and r.status <> 'closed'
  order by 4 desc, 5 desc
  limit 20;
$$;
revoke all on function public.chess_room_leaderboard() from public;
grant execute on function public.chess_room_leaderboard() to anon, authenticated;

-- Guest room detail: profile names are resolved server-side so the
-- profiles table is never exposed to anon.
create or replace function public.chess_guest_room_detail(p_room_id uuid)
returns jsonb
language plpgsql security definer stable set search_path = public as $$
declare
  v_room chess_rooms;
  v_match chess_room_matches;
  v_result jsonb;
begin
  select * into v_room from chess_rooms where id = p_room_id;
  if not found or not v_room.is_public or v_room.status = 'closed' then
    return null;
  end if;
  select * into v_match from chess_room_matches
    where room_id = p_room_id and status = 'active'
    order by created_at desc limit 1;
  select jsonb_build_object(
    'id', v_room.id,
    'code', v_room.code,
    'name', v_room.name,
    'max_players', v_room.max_players,
    'status', v_room.status,
    'rules', v_room.rules,
    'member_count', (select count(*) from chess_room_members where room_id = p_room_id),
    'members', coalesce((
      select jsonb_agg(jsonb_build_object(
        'name', coalesce(nullif(p.full_name, ''), nullif(p.username, ''),
                         split_part(u.email, '@', 1), 'Player'),
        'role', m.role) order by m.joined_at)
      from chess_room_members m join profiles p on p.id = m.user_id
      left join auth.users u on u.id = p.id
      where m.room_id = p_room_id), '[]'::jsonb),
    'active_match', case when v_match.id is null then null else jsonb_build_object(
      'id', v_match.id,
      'white_id', v_match.white_id,
      'black_id', v_match.black_id,
      'white_name', (select coalesce(nullif(p.full_name, ''), nullif(p.username, ''),
                             split_part(u.email, '@', 1), 'Player')
                     from profiles p left join auth.users u on u.id = p.id
                     where p.id = v_match.white_id),
      'black_name', (select coalesce(nullif(p.full_name, ''), nullif(p.username, ''),
                             split_part(u.email, '@', 1), 'Player')
                     from profiles p left join auth.users u on u.id = p.id
                     where p.id = v_match.black_id),
      'moves', v_match.moves,
      'status', v_match.status) end,
    'comments', coalesce((
      select jsonb_agg(c order by created_at desc) from (
        select jsonb_build_object(
          'user_name', coalesce(nullif(p.full_name, ''), nullif(p.username, ''),
                                split_part(u.email, '@', 1), 'Player'),
          'body', cm.body,
          'created_at', cm.created_at) as c,
          cm.created_at
        from chess_room_comments cm join profiles p on p.id = cm.user_id
        left join auth.users u on u.id = p.id
        where cm.room_id = p_room_id
        order by cm.created_at desc limit 20) t), '[]'::jsonb)
  ) into v_result;
  return v_result;
end $$;
revoke all on function public.chess_guest_room_detail(uuid) from public;
grant execute on function public.chess_guest_room_detail(uuid) to anon, authenticated;

-- ---------- 7. Anon read policies for public rooms ----------
-- Lets guests actually load the board/comments of a public room and
-- receive realtime updates. Write access stays member-only.
drop policy if exists "chess_matches public read" on chess_room_matches;
create policy "chess_matches public read" on chess_room_matches
  for select to anon, authenticated using (
    exists (select 1 from chess_rooms r
            where r.id = room_id and r.is_public and r.status <> 'closed'));
drop policy if exists "chess_comments public read" on chess_room_comments;
create policy "chess_comments public read" on chess_room_comments
  for select to anon, authenticated using (
    exists (select 1 from chess_rooms r
            where r.id = room_id and r.is_public and r.status <> 'closed'));
drop policy if exists "chess_reactions public read" on chess_match_reactions;
create policy "chess_reactions public read" on chess_match_reactions
  for select to anon, authenticated using (
    exists (select 1 from chess_rooms r
            where r.id = room_id and r.is_public and r.status <> 'closed'));
