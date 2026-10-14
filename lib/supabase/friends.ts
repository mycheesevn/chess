// Chess friends (one-way follows) + 1:1 challenges.
//
// Uses the SHARED `friendships` table — its columns are
// (id, user_id, friend_id, created_at), exactly like PacClone's.
// Challenges live in `chess_challenges`; the room code is denormalized
// onto the challenge row because the challenged player is NOT a room
// member yet and rooms RLS hides the private room from them.

import { createClient } from "./client";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { createRoom, joinRoom } from "./rooms";

export interface FriendRow {
  id: string;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
}

export function displayNameOf(p: {
  full_name?: string | null;
  username?: string | null;
}): string {
  return p.full_name?.trim() || p.username?.trim() || "Player";
}

async function currentUserId(): Promise<string | null> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

/** Follow another user. Idempotent (unique constraint). */
export async function followUser(followedId: string): Promise<void> {
  const supabase = createClient();
  const uid = await currentUserId();
  if (!uid) throw new Error("Not signed in");
  if (uid === followedId) return;
  const { error } = await supabase
    .from("friendships")
    .upsert(
      { user_id: uid, friend_id: followedId },
      { onConflict: "user_id,friend_id" }
    );
  if (error) throw error;
}

export async function unfollowUser(followedId: string): Promise<void> {
  const supabase = createClient();
  const uid = await currentUserId();
  if (!uid) throw new Error("Not signed in");
  const { error } = await supabase
    .from("friendships")
    .delete()
    .eq("user_id", uid)
    .eq("friend_id", followedId);
  if (error) throw error;
}

export async function listFriends(): Promise<FriendRow[]> {
  const supabase = createClient();
  const uid = await currentUserId();
  if (!uid) return [];
  const { data, error } = await supabase
    .from("friendships")
    .select(
      "friend_id, created_at, profiles!friendships_friend_id_fkey(id, username, full_name, avatar_url)"
    )
    .eq("user_id", uid)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((r: Record<string, unknown>) => {
    const p = r.profiles as Record<string, unknown> | null;
    return {
      id: r.friend_id as string,
      username: (p?.username as string) ?? null,
      full_name: (p?.full_name as string) ?? null,
      avatar_url: (p?.avatar_url as string) ?? null,
    };
  });
}

export async function isFollowing(followedId: string): Promise<boolean> {
  const supabase = createClient();
  const uid = await currentUserId();
  if (!uid) return false;
  const { data } = await supabase
    .from("friendships")
    .select("friend_id")
    .eq("user_id", uid)
    .eq("friend_id", followedId)
    .maybeSingle();
  return !!data;
}

/* ------------------------------ challenges ------------------------------ */

export interface Challenge {
  id: string;
  challenger_id: string;
  challenged_id: string;
  room_id: string | null;
  room_code: string | null;
  status: string;
  created_at: string;
  challenger_name?: string;
}

export interface IncomingChallenge {
  id: string;
  challenger_id: string;
  room_id: string | null;
  room_code: string | null;
  challenger_name: string;
}

/** Challenge a friend: leader-only 2-player room + challenge row carrying
 *  the room code (PacClone's hard-won pattern). */
export async function sendChallenge(
  challengedId: string,
  friendName?: string
): Promise<Challenge> {
  const supabase = createClient();
  const uid = await currentUserId();
  if (!uid) throw new Error("Not signed in");
  const { data: me } = await supabase
    .from("profiles")
    .select("full_name, username")
    .eq("id", uid)
    .single();
  const myName = displayNameOf({
    full_name: (me as Record<string, unknown> | null)?.full_name as
      | string
      | null,
    username: (me as Record<string, unknown> | null)?.username as
      | string
      | null,
  });
  const room = await createRoom(`${myName} vs ${friendName || "Player"}`, false, 2);
  const base = {
    room_id: room.id,
    challenger_id: uid,
    challenged_id: challengedId,
    status: "pending",
  };
  // Prefer the room_code stored on the challenge row; fall back to the
  // plain insert if the column is not migrated yet.
  {
    const withCode = await supabase
      .from("chess_challenges")
      .insert({ ...base, room_code: room.code })
      .select()
      .single();
    if (!withCode.error) return withCode.data as Challenge;
    const plain = await supabase
      .from("chess_challenges")
      .insert(base)
      .select()
      .single();
    if (plain.error) throw plain.error;
    return { ...plain.data, room_code: room.code } as Challenge;
  }
}

export async function respondChallenge(
  id: string,
  accept: boolean
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("chess_challenges")
    .update({ status: accept ? "accepted" : "declined" })
    .eq("id", id);
  if (error) throw error;
}

/** Accept a challenge: mark accepted, join the challenge room via its code
 *  (idempotent — server-side), return the room id. */
export async function acceptChallenge(
  c: Pick<Challenge, "id" | "room_id" | "room_code">
): Promise<string | null> {
  await respondChallenge(c.id, true);
  if (c.room_code) {
    try {
      await joinRoom(c.room_code);
    } catch {
      /* already a member or room closed */
    }
  }
  return c.room_id;
}

export async function declineChallenge(id: string): Promise<void> {
  await respondChallenge(id, false);
}

const CHALLENGE_SELECT_WITH_CODE =
  "id, challenger_id, challenged_id, room_id, room_code, status, created_at, challenger:profiles!chess_challenges_challenger_id_fkey(full_name, username)";
const CHALLENGE_SELECT_PLAIN =
  "id, challenger_id, challenged_id, room_id, status, created_at, challenger:profiles!chess_challenges_challenger_id_fkey(full_name, username)";

/** Pending challenges where I'm the challenged (last 24h). */
export async function listPendingChallenges(): Promise<Challenge[]> {
  const supabase = createClient();
  const uid = await currentUserId();
  if (!uid) return [];
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  // NOTE: select() must come before the filters in this supabase-js version
  // (from().eq() throws "eq is not a function").
  let data: Record<string, unknown>[] | null = null;
  {
    const res = await supabase
      .from("chess_challenges")
      .select(CHALLENGE_SELECT_WITH_CODE)
      .eq("challenged_id", uid)
      .eq("status", "pending")
      .gt("created_at", since)
      .order("created_at", { ascending: false })
      .limit(10);
    if (res.error) {
      const retry = await supabase
        .from("chess_challenges")
        .select(CHALLENGE_SELECT_PLAIN)
        .eq("challenged_id", uid)
        .eq("status", "pending")
        .gt("created_at", since)
        .order("created_at", { ascending: false })
        .limit(10);
      if (retry.error) throw retry.error;
      data = retry.data as Record<string, unknown>[] | null;
    } else {
      data = res.data as Record<string, unknown>[] | null;
    }
  }
  return (data ?? []).map((c) => {
    const p = c.challenger as Record<string, unknown> | null;
    return {
      id: c.id as string,
      challenger_id: c.challenger_id as string,
      challenged_id: c.challenged_id as string,
      room_id: (c.room_id as string) ?? null,
      room_code: (c.room_code as string) ?? null,
      status: c.status as string,
      created_at: c.created_at as string,
      challenger_name: displayNameOf({
        full_name: p?.full_name as string | null,
        username: p?.username as string | null,
      }),
    } as Challenge;
  });
}

/**
 * Realtime challenge events for the current user:
 * - INSERT where I'm the challenged -> incoming challenge popup.
 * - UPDATE where I'm the challenger and it was declined -> toast.
 * Requires chess_challenges in the supabase_realtime publication
 * (migration 002). Without it this silently does nothing — the Friends
 * view list still works as fallback.
 */
export function subscribeChallenges(
  uid: string,
  onIncoming: (c: IncomingChallenge) => void,
  onDeclined?: (challengedName: string) => void
): () => void {
  let supabase;
  try {
    supabase = createClient();
  } catch {
    return () => {};
  }
  const ch: RealtimeChannel = supabase.channel(`challenges:${uid}`);
  ch.on(
    "postgres_changes",
    {
      event: "INSERT",
      schema: "public",
      table: "chess_challenges",
      filter: `challenged_id=eq.${uid}`,
    },
    async (payload: { new: Record<string, unknown> }) => {
      const row = payload.new;
      if (row.status !== "pending") return;
      // The room code is stored on the challenge row (rooms RLS hides the
      // room from the challenged player until they accept and join).
      const storedCode = String(row.room_code ?? "");
      const { data: prof } = await supabase
        .from("profiles")
        .select("full_name, username")
        .eq("id", row.challenger_id as string)
        .single();
      const p = prof as Record<string, unknown> | null;
      onIncoming({
        id: String(row.id ?? ""),
        challenger_id: String(row.challenger_id ?? ""),
        room_id: (row.room_id as string | null) ?? null,
        room_code: storedCode || null,
        challenger_name: displayNameOf({
          full_name: p?.full_name as string | null,
          username: p?.username as string | null,
        }),
      });
    }
  );
  ch.on(
    "postgres_changes",
    {
      event: "UPDATE",
      schema: "public",
      table: "chess_challenges",
      filter: `challenger_id=eq.${uid}`,
    },
    async (payload: { new: Record<string, unknown> }) => {
      const row = payload.new;
      if (row.status !== "declined" || !onDeclined) return;
      const { data: prof } = await supabase
        .from("profiles")
        .select("full_name, username")
        .eq("id", row.challenged_id as string)
        .single();
      const p = prof as Record<string, unknown> | null;
      onDeclined(
        displayNameOf({
          full_name: p?.full_name as string | null,
          username: p?.username as string | null,
        })
      );
    }
  );
  ch.subscribe();
  return () => {
    supabase.removeChannel(ch);
  };
}
