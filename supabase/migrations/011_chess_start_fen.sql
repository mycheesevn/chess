-- Store the FEN start position for vs-computer games.
-- Standard games use the standard start FEN; games launched from the
-- board setup editor need their custom start position so History replay
-- and replay-video export do not incorrectly replay from move one of
-- the standard initial position.

alter table chess_games
  add column if not exists start_fen text not null
  default 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

create or replace function chess_record_game_result(
  p_color text,
  p_level int,
  p_result text,
  p_plies int,
  p_moves text default '',
  p_start_fen text default 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
) returns int language plpgsql security definer as $$
declare xp int;
begin
  xp := case p_result
    when 'win' then 10 + 2 * p_level
    when 'draw' then 5
    else 3 end;
  insert into chess_games (
    user_id, player_color, ai_level, result, plies, moves, start_fen
  )
  values (
    auth.uid(),
    p_color,
    p_level,
    p_result,
    p_plies,
    p_moves,
    coalesce(
      nullif(p_start_fen, ''),
      'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
    )
  );
  insert into chess_stats (user_id, xp, games_played, wins)
    values (auth.uid(), xp, 1, case when p_result = 'win' then 1 else 0 end)
    on conflict (user_id) do update set
      xp = chess_stats.xp + excluded.xp,
      games_played = chess_stats.games_played + 1,
      wins = chess_stats.wins + excluded.wins;
  return xp;
end $$;

revoke all on function chess_record_game_result(text,int,text,int,text,text) from public;
revoke all on function chess_record_game_result(text,int,text,int,text,text) from anon;
grant execute on function chess_record_game_result(text,int,text,int,text,text) to authenticated;
