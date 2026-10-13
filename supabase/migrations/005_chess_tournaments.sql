-- Chess tournaments (round-robin).
create table if not exists chess_tournaments (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references chess_rooms(id) on delete cascade,
  name text not null,
  status text not null default 'open',
  pairings jsonb not null default '[]',
  created_at timestamptz not null default now(),
  finished_at timestamptz
);
alter table chess_tournaments enable row level security;
drop policy if exists "chess_tournaments member read" on chess_tournaments;
create policy "chess_tournaments member read" on chess_tournaments
  for select using (is_chess_room_member(room_id));

alter table chess_room_matches
  add column if not exists tournament_id uuid
  references chess_tournaments(id) on delete set null;

create or replace function chess_create_tournament(p_room_id uuid, p_name text)
returns chess_tournaments language plpgsql security definer as $$
declare
  v_players uuid[];
  v_pairings jsonb := '[]'::jsonb;
  v_t chess_tournaments;
  i int; j int; n int;
begin
  if not is_chess_room_leader(p_room_id) then raise exception 'not_leader'; end if;
  if exists (select 1 from chess_tournaments where room_id = p_room_id and status = 'open') then
    raise exception 'tournament_in_progress'; end if;
  select array_agg(m.user_id) into v_players
    from chess_room_members m where m.room_id = p_room_id and m.role = 'player';
  n := coalesce(array_length(v_players, 1), 0);
  if n < 3 then raise exception 'not_enough_players'; end if;
  for i in 1..n loop
    for j in i + 1..n loop
      v_pairings := v_pairings || jsonb_build_object(
        'white', case when (i + j) % 2 = 0 then v_players[i] else v_players[j] end,
        'black', case when (i + j) % 2 = 0 then v_players[j] else v_players[i] end,
        'result', null);
    end loop;
  end loop;
  insert into chess_tournaments (room_id, name, pairings)
    values (p_room_id, left(nullif(trim(p_name), ''), 60), v_pairings)
    returning * into v_t;
  return v_t;
end $$;
revoke all on function chess_create_tournament(uuid, text) from public;
revoke all on function chess_create_tournament(uuid, text) from anon;
grant execute on function chess_create_tournament(uuid, text) to authenticated;
