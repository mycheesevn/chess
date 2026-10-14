import { createClient } from "./client";
import { STANDARD_START_FEN } from "@/lib/chess/fen";

export interface CheckinResult {
  streak: number;
  xp_awarded: number;
  already_claimed: boolean;
}

export async function claimCheckin(): Promise<CheckinResult> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("chess_claim_checkin");
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return {
    streak: row.streak,
    xp_awarded: row.xp_awarded,
    already_claimed: row.already_claimed,
  };
}

export async function checkinHistory(): Promise<{ date: string; streak: number }[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("chess_checkins")
    .select("checkin_date, streak")
    .order("checkin_date", { ascending: false })
    .limit(7);
  if (error) throw error;
  return (data ?? []).map((r: { checkin_date: string; streak: number }) => ({
    date: r.checkin_date,
    streak: r.streak,
  }));
}

export async function recordGameResult(
  color: "white" | "black",
  level: number,
  result: "win" | "loss" | "draw",
  plies: number,
  moves: string = "",
  startFen: string = STANDARD_START_FEN
): Promise<number> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("chess_record_game_result", {
    p_color: color,
    p_level: level,
    p_result: result,
    p_plies: plies,
    p_moves: moves,
    p_start_fen: startFen,
  });
  if (error) throw error;
  return data as number;
}

export interface ChessGameRow {
  id: string;
  player_color: string;
  ai_level: number;
  result: string;
  plies: number;
  moves: string;
  start_fen?: string | null;
  created_at: string;
}

export async function fetchGameHistory(limit = 100): Promise<ChessGameRow[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("chess_games")
    .select("id, player_color, ai_level, result, plies, moves, start_fen, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as ChessGameRow[];
}

export interface LeaderboardRow {
  id: string;
  username: string | null;
  full_name: string | null;
  xp: number;
  rating: number;
  games_played: number;
  wins: number;
}

export async function fetchLeaderboard(limit = 50): Promise<LeaderboardRow[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("chess_stats")
    .select("xp, rating, games_played, wins, user:profiles!inner(id, username, full_name)")
    .order("rating", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return ((data ?? []) as unknown as Array<{
    xp: number;
    rating: number;
    games_played: number;
    wins: number;
    user: { id: string; username: string | null; full_name: string | null };
  }>).map((r) => ({
    id: r.user.id,
    username: r.user.username,
    full_name: r.user.full_name,
    xp: r.xp,
    rating: r.rating,
    games_played: r.games_played,
    wins: r.wins,
  }));
}

/** 1-based rank of a user by rating (null when they have no stats row). */
export async function fetchMyRank(userId: string): Promise<number | null> {
  const supabase = createClient();
  const { data: me } = await supabase
    .from("chess_stats")
    .select("rating")
    .eq("user_id", userId)
    .maybeSingle();
  if (!me) return null;
  const { count } = await supabase
    .from("chess_stats")
    .select("user_id", { count: "exact", head: true })
    .gt("rating", (me as { rating: number }).rating ?? 800);
  return (count ?? 0) + 1;
}

export interface ChessStats {
  xp: number;
  rating: number;
  games_played: number;
  wins: number;
}

export async function fetchMyStats(userId: string): Promise<ChessStats | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("chess_stats")
    .select("xp, rating, games_played, wins")
    .eq("user_id", userId)
    .single();
  if (error) return null;
  return data as ChessStats;
}
