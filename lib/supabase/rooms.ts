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
  rules: string | null;
  created_at: string;
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
  tournament_id?: string | null;
  created_at?: string;
  finished_at?: string | null;
}

export interface RoomMember {
  user_id: string;
  role: string;
  joined_at: string;
  name: string;
  avatar_url: string | null;
}

export interface PublicRoom {
  id: string;
  code: string;
  name: string;
  member_count: number;
  max_players: number;
  has_active_match: boolean;
}

export interface HotRoom {
  room_id: string;
  name: string;
  code: string;
  matches_7d: number;
  member_count: number;
}

export interface RoomPreview {
  name: string;
  member_count: number;
  is_public: boolean;
  status: string;
  rules: string | null;
}

export interface GuestRoomDetail {
  id: string;
  code: string;
  name: string;
  max_players: number;
  status: string;
  rules: string | null;
  member_count: number;
  members: Array<{ name: string; role: string }>;
  active_match: {
    id: string;
    white_id: string | null;
    black_id: string | null;
    white_name: string | null;
    black_name: string | null;
    moves: string;
    status: string;
  } | null;
  comments: Array<{ user_name: string; body: string; created_at: string }>;
}

export interface XpEarned {
  play_xp: number;
  host_xp: number;
  daily_xp: number;
}

export interface MyRoomMatch {
  match: RoomMatch;
  roomName: string;
  roomCode: string;
  opponentName: string;
  myColor: "white" | "black";
}

/** Map an RPC error to a stable key the UI translates. */
export function roomErrorKey(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err ?? "");
  for (const key of [
    "room_not_found",
    "room_full",
    "room_closed",
    "not_leader",
    "leader_cannot_leave",
    "leader_must_play",
    "cannot_kick_self",
    "room_need_two_players",
    "match_in_progress",
    "match_not_found",
    "not_allowed",
    "not_enough_players",
    "tournament_in_progress",
    "tournament_finished",
    "tournament_not_found",
    "invalid_role",
  ]) {
    if (msg.includes(key)) return key;
  }
  return "generic";
}

export function displayName(p: {
  full_name?: string | null;
  username?: string | null;
  email?: string | null;
}): string {
  return (
    p.full_name ||
    p.username ||
    (p.email ? p.email.split("@")[0] : null) ||
    "Player"
  );
}

function genCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export async function createRoom(
  name: string,
  isPublic: boolean,
  maxPlayers = 8
): Promise<Room> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");
  // Retry a few times on the (rare) unique-code collision.
  let lastErr: unknown = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    const { data, error } = await supabase
      .from("chess_rooms")
      .insert({
        code: genCode(),
        name,
        leader_id: user.id,
        is_public: isPublic,
        max_players: maxPlayers,
        turn_order: [user.id],
      })
      .select()
      .single();
    if (!error && data) {
      await supabase.from("chess_room_members").insert({
        room_id: data.id,
        user_id: user.id,
        role: "player",
      });
      return data as Room;
    }
    lastErr = error;
    if (error && !/duplicate|unique/i.test(error.message)) break;
  }
  throw lastErr ?? new Error("create failed");
}

/** Join via the chess_join_room RPC — a direct SELECT by code cannot
 *  see private rooms (member-only RLS), so joining must be server-side. */
export async function joinRoom(code: string): Promise<Room> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("chess_join_room", {
    p_code: code.trim().toUpperCase(),
  });
  if (error) throw error;
  return data as Room;
}

export async function fetchRoom(roomId: string): Promise<Room | null> {
  const supabase = createClient();
  const { data } = await supabase
    .from("chess_rooms")
    .select("*")
    .eq("id", roomId)
    .single();
  return (data as Room) ?? null;
}

export async function listMyRooms(): Promise<Room[]> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];
  const { data, error } = await supabase
    .from("chess_room_members")
    .select("room:chess_rooms(*)")
    .eq("user_id", user.id);
  if (error) throw error;
  const rooms: Room[] = ((data ?? []) as Array<{ room: Room | null }>)
    .map((r) => r.room)
    .filter((r): r is Room => !!r);
  rooms.sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? ""));
  return rooms;
}

export async function listPublicRooms(): Promise<PublicRoom[]> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("chess_list_public_rooms");
  if (error) throw error;
  return (data ?? []) as PublicRoom[];
}

export async function fetchHotRooms(): Promise<HotRoom[]> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("chess_room_leaderboard");
  if (error) throw error;
  return (data ?? []) as HotRoom[];
}

export async function previewRoom(code: string): Promise<RoomPreview | null> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("chess_preview_room", {
    p_code: code.trim().toUpperCase(),
  });
  if (error || !data || (data as unknown[]).length === 0) return null;
  return (data as RoomPreview[])[0];
}

export async function guestRoomDetail(
  roomId: string
): Promise<GuestRoomDetail | null> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("chess_guest_room_detail", {
    p_room_id: roomId,
  });
  if (error || !data) return null;
  return data as GuestRoomDetail;
}

export async function fetchRoomMembers(roomId: string): Promise<RoomMember[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("chess_room_members")
    .select(
      "user_id, role, joined_at, user:profiles(full_name, username, email, avatar_url)"
    )
    .eq("room_id", roomId)
    .order("joined_at", { ascending: true });
  if (error) throw error;
  return (
    (data ?? []) as unknown as Array<{
      user_id: string;
      role: string;
      joined_at: string;
      user: {
        full_name: string | null;
        username: string | null;
        email: string | null;
        avatar_url: string | null;
      } | null;
    }>
  ).map((m) => ({
    user_id: m.user_id,
    role: m.role,
    joined_at: m.joined_at,
    name: m.user ? displayName(m.user) : "Player",
    avatar_url: m.user?.avatar_url ?? null,
  }));
}

/** Display names for arbitrary profile ids (match players, opponents). */
export async function fetchNames(
  ids: string[]
): Promise<Record<string, string>> {
  const unique = [...new Set(ids.filter(Boolean))];
  if (unique.length === 0) return {};
  const supabase = createClient();
  const { data } = await supabase
    .from("profiles")
    .select("id, full_name, username, email")
    .in("id", unique);
  const out: Record<string, string> = {};
  for (const p of (data ?? []) as Array<{
    id: string;
    full_name: string | null;
    username: string | null;
    email: string | null;
  }>) {
    out[p.id] = displayName(p);
  }
  return out;
}

/* ------------------------- membership actions ------------------------- */

export async function leaveRoom(roomId: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.rpc("chess_leave_room", { p_room_id: roomId });
  if (error) throw error;
}

export async function kickMember(roomId: string, userId: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.rpc("chess_kick_member", {
    p_room_id: roomId,
    p_user_id: userId,
  });
  if (error) throw error;
}

export async function setMemberRole(
  roomId: string,
  userId: string,
  role: "player" | "spectator"
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.rpc("chess_set_member_role", {
    p_room_id: roomId,
    p_user_id: userId,
    p_role: role,
  });
  if (error) throw error;
}

export async function setTurnOrder(roomId: string, order: string[]): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.rpc("chess_set_turn_order", {
    p_room_id: roomId,
    p_order: order,
  });
  if (error) throw error;
}

export async function closeRoom(roomId: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.rpc("chess_close_room", { p_room_id: roomId });
  if (error) throw error;
}

export async function updateRoomRules(roomId: string, rules: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.rpc("chess_update_room_rules", {
    p_room_id: roomId,
    p_rules: rules,
  });
  if (error) throw error;
}

export async function setRoomPublic(roomId: string, isPublic: boolean): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.rpc("chess_set_room_public", {
    p_room_id: roomId,
    p_public: isPublic,
  });
  if (error) throw error;
}

/* ----------------------------- matches ----------------------------- */

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

export async function getMatchById(matchId: string): Promise<RoomMatch | null> {
  const supabase = createClient();
  const { data } = await supabase
    .from("chess_room_matches")
    .select("*")
    .eq("id", matchId)
    .single();
  return (data as RoomMatch) ?? null;
}

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

export async function fetchPastMatches(
  roomId: string,
  limit = 50
): Promise<RoomMatch[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from("chess_room_matches")
    .select("*")
    .eq("room_id", roomId)
    .eq("status", "finished")
    .order("finished_at", { ascending: false, nullsFirst: false })
    .limit(limit);
  return (data ?? []) as RoomMatch[];
}

/** Start the next match via RPC: first two of the rotation order play,
 *  the first then rotates to the end (PacClone rule). */
export async function startNextMatch(roomId: string): Promise<RoomMatch> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("chess_start_next_match", {
    p_room_id: roomId,
  });
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

/** Finish via RPC: idempotent, awards room XP, writes tournament
 *  results back. Returns the caller's earned XP for the toast. */
export async function finishRoomMatch(
  matchId: string,
  result: "white" | "black" | "draw",
  reason: string
): Promise<XpEarned | null> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("chess_finish_room_match", {
    p_match_id: matchId,
    p_result: result,
    p_reason: reason,
  });
  if (error) throw error;
  return (data as XpEarned) ?? null;
}

export async function cancelMatch(matchId: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.rpc("chess_cancel_room_match", {
    p_match_id: matchId,
  });
  if (error) throw error;
}

/** Rematch via RPC: either player of the last finished match, colors
 *  swapped, no leader needed. */
export async function startRematch(roomId: string): Promise<RoomMatch> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("chess_rematch", {
    p_room_id: roomId,
  });
  if (error) throw error;
  return data as RoomMatch;
}

/** Finished room matches where I played — for the History section. */
export async function fetchMyRoomMatches(limit = 50): Promise<MyRoomMatch[]> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];
  const { data } = await supabase
    .from("chess_room_matches")
    .select("*")
    .eq("status", "finished")
    .or(`white_id.eq.${user.id},black_id.eq.${user.id}`)
    .order("finished_at", { ascending: false, nullsFirst: false })
    .limit(limit);
  const matches = (data ?? []) as RoomMatch[];
  if (matches.length === 0) return [];
  const roomIds = [...new Set(matches.map((m) => m.room_id))];
  const { data: roomRows } = await supabase
    .from("chess_rooms")
    .select("id, name, code")
    .in("id", roomIds);
  const roomById = new Map(
    ((roomRows ?? []) as Array<{ id: string; name: string; code: string }>).map(
      (r) => [r.id, r]
    )
  );
  const oppIds = matches.map((m) =>
    m.white_id === user.id ? m.black_id : m.white_id
  );
  const names = await fetchNames(oppIds.filter((x): x is string => !!x));
  return matches.map((m) => {
    const myColor = m.white_id === user.id ? "white" : "black";
    const oppId = myColor === "white" ? m.black_id : m.white_id;
    return {
      match: m,
      roomName: roomById.get(m.room_id)?.name ?? "—",
      roomCode: roomById.get(m.room_id)?.code ?? "",
      opponentName: (oppId && names[oppId]) || "Player",
      myColor,
    } as MyRoomMatch;
  });
}

/* ---------------------------- realtime ---------------------------- */

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

export interface SubscribeRoomOpts {
  myUserId: string | null;
  onChange: () => void;
  onKicked: () => void;
}

/** Room-level subscription: member changes (incl. being kicked),
 *  room updates — the detail screen refetches on any of these. */
export function subscribeRoom(roomId: string, opts: SubscribeRoomOpts): RealtimeChannel {
  const supabase = createClient();
  return supabase
    .channel(`room:${roomId}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "chess_room_members",
        filter: `room_id=eq.${roomId}`,
      },
      (payload: { eventType: string; old: { user_id?: string } }) => {
        if (
          payload.eventType === "DELETE" &&
          opts.myUserId &&
          payload.old?.user_id === opts.myUserId
        ) {
          opts.onKicked();
          return;
        }
        opts.onChange();
      }
    )
    .on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "chess_rooms",
        filter: `id=eq.${roomId}`,
      },
      () => opts.onChange()
    )
    .subscribe();
}
