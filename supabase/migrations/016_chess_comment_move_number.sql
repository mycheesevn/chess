-- 016: add move_number to chess_room_comments (PacClone parity: comments anchored to the move they were posted at)
alter table public.chess_room_comments
  add column if not exists move_number integer;
