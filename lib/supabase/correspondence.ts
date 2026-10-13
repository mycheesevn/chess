import { createClient } from "./client";
import type { RealtimeChannel } from "@supabase/supabase-js";

export interface CorrGame {
  id: string;
  white_id: string;
  black_id: string;
  status: string;
  moves: string;
  result: string | null;
  winner_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface CorrGameRow extends CorrGame {
  white_name: string;
  black_name: string;
}

function displayName(p: { full_name?: string | null; username?: string | null } | null): string {
  return p?.full_name || p?.username || "Player";
}

export async function listMyCorrGames(): Promise<CorrGameRow[]> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  const { data, error } = await supabase
    .from("chess_corr_games")
    .select(
      "*, white:profiles!chess_corr_games_white_id_fkey(full_name, username), black:profiles!chess_corr_games_black_id_fkey(full_name, username)"
    )
    .or(`white_id.eq.${user.id},black_id.eq.${user.id}`)
    .order("updated_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  return ((data ?? []) as unknown as Array<
    CorrGame & {
      white: { full_name?: string | null; username?: string | null } | null;
      black: { full_name?: string | null; username?: string | null } | null;
    }
  >).map((g) => ({
    ...g,
    white_name: displayName(g.white),
    black_name: displayName(g.black),
  }));
}

export async function createCorrGame(opponentId: string): Promise<CorrGame> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");
  if (opponentId === user.id) throw new Error("Cannot play yourself");
  // Randomize colors
  const iAmWhite = Math.random() < 0.5;
  const { data, error } = await supabase
    .from("chess_corr_games")
    .insert({
      white_id: iAmWhite ? user.id : opponentId,
      black_id: iAmWhite ? opponentId : user.id,
    })
    .select()
    .single();
  if (error) throw error;
  return data as CorrGame;
}

export async function getCorrGame(id: string): Promise<CorrGame | null> {
  const supabase = createClient();
  const { data } = await supabase
    .from("chess_corr_games")
    .select("*")
    .eq("id", id)
    .single();
  return (data as CorrGame) ?? null;
}

export async function pushCorrMove(gameId: string, uciMoves: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("chess_corr_games")
    .update({ moves: uciMoves, updated_at: new Date().toISOString() })
    .eq("id", gameId)
    .eq("status", "active");
  if (error) throw error;
}

export async function finishCorrGame(
  gameId: string,
  result: "white" | "black" | "draw",
  winnerId: string | null
): Promise<void> {
  const supabase = createClient();
  await supabase
    .from("chess_corr_games")
    .update({
      status: "finished",
      result,
      winner_id: winnerId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", gameId);
}

export async function resignCorrGame(gameId: string): Promise<void> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");
  const game = await getCorrGame(gameId);
  if (!game || game.status !== "active") return;
  const winnerId = game.white_id === user.id ? game.black_id : game.white_id;
  const result = game.white_id === user.id ? "black" : ("white" as const);
  await finishCorrGame(gameId, result, winnerId);
}

export function subscribeCorrGame(
  gameId: string,
  onUpdate: (g: CorrGame) => void
): RealtimeChannel {
  const supabase = createClient();
  return supabase
    .channel(`corr:${gameId}`)
    .on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "chess_corr_games",
        filter: `id=eq.${gameId}`,
      },
      (payload: { new: CorrGame }) => onUpdate(payload.new as CorrGame)
    )
    .subscribe();
}
