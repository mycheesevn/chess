import { createClient } from "./client";
import type { RealtimeChannel } from "@supabase/supabase-js";

export interface Room {
  id: string;
  code: string;
  name: string;
  leader_id: string;
  max_players: number;
  is_public: boolean;
  status: string;
  turn_order: string[];
}

export interface RoomMatch {
  id: string;
  room_id: string;
  white_id: string | null;
  black_id: string | null;
  status: string;
  moves: string;
  result: string | null;
  reason: string | null;
  winner_id: string | null;
}

function genCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export async function createRoom(name: string, isPublic: boolean): Promise<Room> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");
  const { data, error } = await supabase
    .from("chess_rooms")
    .insert({
      code: genCode(),
      name,
      leader_id: user.id,
      is_public: isPublic,
      turn_order: [user.id],
    })
    .select()
    .single();
  if (error) throw error;
  await supabase.from("chess_room_members").insert({
    room_id: data.id,
    user_id: user.id,
    role: "player",
  });
  return data as Room;
}

export async function joinRoom(code: string): Promise<Room> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");
  const { data: room, error } = await supabase
    .from("chess_rooms")
    .select("*")
    .eq("code", code.toUpperCase())
    .single();
  if (error || !room) throw new Error("Room not found");
  await supabase.from("chess_room_members").upsert({
    room_id: room.id,
    user_id: user.id,
    role: "player",
  });
  // Add to turn order if not present
  const order: string[] = room.turn_order ?? [];
  if (!order.includes(user.id)) {
    await supabase
      .from("chess_rooms")
      .update({ turn_order: [...order, user.id] })
      .eq("id", room.id);
  }
  return room as Room;
}

export async function listMyRooms(): Promise<Room[]> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  const { data, error } = await supabase
    .from("chess_room_members")
    .select("room:rooms(*)")
    .eq("user_id", user.id);
  if (error) throw error;
  return (data ?? []).map((r: { room: unknown }) => r.room as unknown as Room);
}

export async function listPublicRooms(): Promise<Room[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("chess_rooms")
    .select("*")
    .eq("is_public", true)
    .eq("status", "open")
    .limit(20);
  if (error) throw error;
  return (data ?? []) as Room[];
}

export async function getActiveMatch(roomId: string): Promise<RoomMatch | null> {
  const supabase = createClient();
  const { data } = await supabase
    .from("chess_room_matches")
    .select("*")
    .eq("room_id", roomId)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .single();
  return (data as RoomMatch) ?? null;
}

export async function startMatch(
  roomId: string,
  whiteId: string,
  blackId: string
): Promise<RoomMatch> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("chess_room_matches")
    .insert({ room_id: roomId, white_id: whiteId, black_id: blackId })
    .select()
    .single();
  if (error) throw error;
  return data as RoomMatch;
}

export async function pushMove(matchId: string, uciMoves: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("chess_room_matches")
    .update({ moves: uciMoves })
    .eq("id", matchId)
    .eq("status", "active");
  if (error) throw error;
}

export async function finishRoomMatch(
  matchId: string,
  result: "white" | "black" | "draw",
  reason: string,
  winnerId: string | null
): Promise<void> {
  const supabase = createClient();
  await supabase
    .from("chess_room_matches")
    .update({
      status: "finished",
      result,
      reason,
      winner_id: winnerId,
      finished_at: new Date().toISOString(),
    })
    .eq("id", matchId);
}

/** Latest finished match in a room (for the rematch button). */
export async function getLastFinishedMatch(
  roomId: string
): Promise<RoomMatch | null> {
  const supabase = createClient();
  const { data } = await supabase
    .from("chess_room_matches")
    .select("*")
    .eq("room_id", roomId)
    .eq("status", "finished")
    .order("finished_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(1)
    .single();
  return (data as RoomMatch) ?? null;
}

/**
 * Start an immediate rematch with swapped colors — the chess-native
 * equivalent of PacClone's `rematch(room_id)` RPC (chess rooms are
 * client-driven via direct inserts). Either of the two players of the
 * last finished match can call it, no leader needed.
 */
export async function startRematch(
  roomId: string,
  prevMatchId: string
): Promise<RoomMatch> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");
  const { data: prev } = await supabase
    .from("chess_room_matches")
    .select("*")
    .eq("id", prevMatchId)
    .single();
  const p = prev as RoomMatch | null;
  if (!p) throw new Error("Match not found");
  if (p.status === "active") throw new Error("Match still in progress");
  if (user.id !== p.white_id && user.id !== p.black_id)
    throw new Error("Only the two players can rematch");
  if (await getActiveMatch(roomId))
    throw new Error("A match is already active");
  // Same two players, swapped colors.
  return startMatch(roomId, p.black_id ?? "", p.white_id ?? "");
}

export interface SubscribeMatchOpts {
  /** Track this viewer on the match channel and report viewer counts. */
  onPresence?: (count: number) => void;
  /** Identity to track (falls back to "guest"). */
  userId?: string | null;
}

export function subscribeMatch(
  matchId: string,
  onUpdate: (m: RoomMatch) => void,
  opts?: SubscribeMatchOpts
): RealtimeChannel {
  const supabase = createClient();
  const ch = supabase
    .channel(`match:${matchId}`)
    .on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "chess_room_matches",
        filter: `id=eq.${matchId}`,
      },
      (payload: { new: RoomMatch }) => onUpdate(payload.new as RoomMatch)
    );
  if (opts?.onPresence) {
    const report = () => {
      const state = ch.presenceState();
      let n = 0;
      for (const presences of Object.values(state))
        n += (presences as unknown[]).length;
      opts.onPresence!(n);
    };
    ch.on("presence", { event: "sync" }, report);
  }
  ch.subscribe(async (status: string) => {
    if (status === "SUBSCRIBED" && opts?.onPresence) {
      try {
        await ch.track({ user_id: opts.userId ?? "guest", at: Date.now() });
      } catch {
        /* presence is best-effort */
      }
    }
  });
  return ch;
}

/**
 * Room-level match events: a new match INSERT (e.g. a rematch) so the
 * match view can switch to it without a refresh.
 */
export function subscribeRoomMatches(
  roomId: string,
  onInsert: (m: RoomMatch) => void
): RealtimeChannel {
  const supabase = createClient();
  return supabase
    .channel(`room-matches:${roomId}`)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "chess_room_matches",
        filter: `room_id=eq.${roomId}`,
      },
      (payload: { new: RoomMatch }) => onInsert(payload.new as RoomMatch)
    )
    .subscribe();
}
