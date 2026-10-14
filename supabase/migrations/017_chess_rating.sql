-- 017_chess_rating.sql
-- Chess's rating was DEAD: chess_stats.rating has existed since 002,
-- but chess_record_game_result never updated it — every player sat at
-- 800 forever and the leaderboard sorted by a constant. This makes it
-- live with PacClone's Elo model (identical to CCT's 006): start 800,
-- AI pseudo-ratings by level (300…2400), expected score
-- 1/(1+10^((opp-me)/400)), K = 40 under 20 recorded games else 24,
-- floor 100, peak tracked. Rating moves on vs-COMPUTER results only
-- (PacClone parity — room matches award XP only).

alter table chess_stats add column if not exists peak_rating int not null default 800;

-- AI pseudo-rating by level (PacClone AI_RATINGS).
create or replace function public.chess_ai_rating(p_level int)
returns int
language sql
immutable
set search_path = public
as $$
  select case p_level
    when 1 then 300
    when 2 then 500
    when 3 then 700
    when 4 then 900
    when 5 then 1100
    when 6 then 1300
    when 7 then 1500
    when 8 then 1700
    when 9 then 1900
    when 10 then 2100
    when 11 then 2250
    else 2400
  end;
$$;
revoke all on function public.chess_ai_rating(int) from public;
revoke all on function public.chess_ai_rating(int) from anon;
revoke all on function public.chess_ai_rating(int) from authenticated;

-- Record RPC v2 (the live 6-arg signature from 011): identical
-- XP/history behavior + the Elo update. Delta rounding uses
-- floor(x + 0.5) to match JS Math.round exactly.
create or replace function public.chess_record_game_result(
  p_color text,
  p_level int,
  p_result text,
  p_plies int,
  p_moves text default '',
  p_start_fen text default 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
) returns int language plpgsql security definer set search_path = public as $$
declare
  xp int;
  v_uid uuid := auth.uid();
  v_rating int;
  v_games int;
  v_score numeric;
  v_expected numeric;
  v_k int;
  v_new int;
begin
  xp := case p_result
    when 'win' then 10 + 2 * p_level
    when 'draw' then 5
    else 3 end;

  select rating, games_played into v_rating, v_games
    from chess_stats where user_id = v_uid;
  v_rating := coalesce(v_rating, 800);
  v_games := coalesce(v_games, 0);
  v_score := case p_result when 'win' then 1 when 'draw' then 0.5 else 0 end;
  v_expected := 1.0 / (1.0 + power(10.0, (public.chess_ai_rating(p_level) - v_rating) / 400.0));
  v_k := case when v_games < 20 then 40 else 24 end;
  v_new := greatest(100, v_rating + floor(v_k * (v_score - v_expected) + 0.5)::int);

  insert into chess_games (
    user_id, player_color, ai_level, result, plies, moves, start_fen
  )
  values (
    v_uid,
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
  insert into chess_stats (user_id, xp, games_played, wins, rating, peak_rating)
    values (
      v_uid, xp, 1,
      case when p_result = 'win' then 1 else 0 end,
      v_new,
      greatest(800, v_new)
    )
    on conflict (user_id) do update set
      xp = chess_stats.xp + excluded.xp,
      games_played = chess_stats.games_played + 1,
      wins = chess_stats.wins + excluded.wins,
      rating = v_new,
      peak_rating = greatest(chess_stats.peak_rating, v_new);
  return xp;
end $$;
revoke all on function public.chess_record_game_result(text,int,text,int,text,text) from public;
revoke all on function public.chess_record_game_result(text,int,text,int,text,text) from anon;
grant execute on function public.chess_record_game_result(text,int,text,int,text,text) to authenticated;
