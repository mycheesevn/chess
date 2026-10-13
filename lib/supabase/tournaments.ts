import { createClient } from "./client";

export interface Tournament {
  id: string;
  room_id: string;
  name: string;
  status: string;
  pairings: Array<{
    white: string;
    black: string;
    result: string | null;
    match_id?: string | null;
  }>;
}

export async function listTournaments(roomId: string): Promise<Tournament[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("chess_tournaments")
    .select("*")
    .eq("room_id", roomId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Tournament[];
}

export async function createTournament(
  roomId: string,
  name: string
): Promise<Tournament> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("chess_create_tournament", {
    p_room_id: roomId,
    p_name: name,
  });
  if (error) throw error;
  return data as Tournament;
}

export function standings(t: Tournament): Array<{ player: string; score: number }> {
  const scores = new Map<string, number>();
  for (const p of t.pairings) {
    if (!scores.has(p.white)) scores.set(p.white, 0);
    if (!scores.has(p.black)) scores.set(p.black, 0);
    if (p.result === "white") scores.set(p.white, scores.get(p.white)! + 1);
    else if (p.result === "black") scores.set(p.black, scores.get(p.black)! + 1);
    else if (p.result === "draw") {
      scores.set(p.white, scores.get(p.white)! + 0.5);
      scores.set(p.black, scores.get(p.black)! + 0.5);
    }
  }
  return [...scores.entries()]
    .map(([player, score]) => ({ player, score }))
    .sort((a, b) => b.score - a.score);
}

/** Start the next unplayed pairing as a live match (leader, via RPC).
 *  Returns the created match id. */
export async function tournamentNextMatch(tournamentId: string): Promise<string> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("chess_tournament_next_match", {
    p_tournament_id: tournamentId,
  });
  if (error) throw error;
  return (data as { id: string }).id;
}

/** End an open tournament early (leader, via RPC). */
export async function cancelTournament(tournamentId: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.rpc("chess_cancel_tournament", {
    p_tournament_id: tournamentId,
  });
  if (error) throw error;
}
