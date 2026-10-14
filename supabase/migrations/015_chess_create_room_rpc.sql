-- 015: Fix room creation under RLS (the Friends "Thách đấu" silent failure).
--
-- Root cause: creating a room was a client-side INSERT ... SELECT on
-- chess_rooms. The rooms SELECT policy ("member read") only matches
-- members or public rooms, and the leader's member row is inserted
-- AFTER the room — so the just-created PRIVATE room was invisible to
-- its own creator, the .single() read returned zero rows, creation
-- threw, and the Friends view swallowed the error (nothing happened
-- on screen). PacClone never hits this because it creates rooms via a
-- SECURITY DEFINER create_room RPC.
--
-- Fix, both layers:
--   1. The leader can always read their own rooms.
--   2. chess_create_room(): PacClone-pattern SECURITY DEFINER RPC —
--      server-side code generation, room + leader member row in one
--      call, returns the room. The client switches to it.
-- Idempotent. Run in the Dashboard SQL editor.

-- 1. Leader read access to own rooms.
drop policy if exists "chess_rooms member read" on chess_rooms;
create policy "chess_rooms member read" on chess_rooms
  for select using (
    is_chess_room_member(id) or is_chess_room_leader(id) or is_public
  );

-- 2. Room-code generator (same alphabet/length as the client used:
--    ABCDEFGHJKLMNPQRSTUVWXYZ23456789, 6 chars). Internal helper.
create or replace function public.chess_gen_room_code()
returns text
language plpgsql volatile set search_path = public as $$
declare
  v_alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_code text := '';
  i int;
begin
  for i in 1..6 loop
    v_code := v_code || substr(
      v_alphabet, 1 + floor(random() * length(v_alphabet))::int, 1);
  end loop;
  return v_code;
end $$;
revoke all on function public.chess_gen_room_code() from public;
revoke all on function public.chess_gen_room_code() from anon;
revoke all on function public.chess_gen_room_code() from authenticated;

-- 3. Create-room RPC (PacClone create_room pattern).
create or replace function public.chess_create_room(
  p_name text,
  p_is_public boolean default false,
  p_max_players int default 8
) returns chess_rooms
language plpgsql security definer set search_path = public as $$
declare
  v_room chess_rooms;
  v_code text;
  v_name text := nullif(trim(coalesce(p_name, '')), '');
  v_max int := coalesce(p_max_players, 8);
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if v_name is null then v_name := 'Phòng chơi'; end if;
  v_name := left(v_name, 60);
  if v_max < 2 then v_max := 2; end if;
  if v_max > 20 then v_max := 20; end if;
  loop
    v_code := chess_gen_room_code();
    exit when not exists (select 1 from chess_rooms where code = v_code);
  end loop;
  insert into chess_rooms (code, name, leader_id, is_public, max_players, turn_order)
  values (v_code, v_name, auth.uid(), coalesce(p_is_public, false), v_max,
          array[auth.uid()])
  returning * into v_room;
  insert into chess_room_members (room_id, user_id, role)
  values (v_room.id, auth.uid(), 'player');
  return v_room;
end $$;
revoke all on function public.chess_create_room(text, boolean, int) from public;
revoke all on function public.chess_create_room(text, boolean, int) from anon;
grant execute on function public.chess_create_room(text, boolean, int) to authenticated;
