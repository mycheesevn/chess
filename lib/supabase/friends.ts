import { createClient } from "./client";

export interface FriendRow {
  id: string;
  username: string | null;
  full_name: string | null;
}

export async function followUser(followedId: string): Promise<void> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");
  const { error } = await supabase.from("friendships").insert({
    follower_id: user.id,
    followed_id: followedId,
  });
  if (error) throw error;
}

export async function unfollowUser(followedId: string): Promise<void> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");
  await supabase
    .from("friendships")
    .delete()
    .eq("follower_id", user.id)
    .eq("followed_id", followedId);
}

export async function listFriends(): Promise<FriendRow[]> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  const { data, error } = await supabase
    .from("friendships")
    .select("followed:profiles!friendships_followed_id_fkey(id, username, full_name)")
    .eq("follower_id", user.id);
  if (error) throw error;
  return (data ?? []).map((r: { followed: FriendRow }) => r.followed);
}

export async function isFollowing(followedId: string): Promise<boolean> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;
  const { data } = await supabase
    .from("friendships")
    .select("follower_id")
    .eq("follower_id", user.id)
    .eq("followed_id", followedId)
    .single();
  return !!data;
}

export interface Challenge {
  id: string;
  challenger_id: string;
  challenged_id: string;
  room_id: string | null;
  status: string;
  challenger_name?: string;
}

export async function sendChallenge(challengedId: string): Promise<Challenge> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");
  // Create a 2-player room for the challenge
  const { data: room, error: roomErr } = await supabase
    .from("chess_rooms")
    .insert({
      code: Math.random().toString(36).slice(2, 8).toUpperCase(),
      name: `Challenge`,
      leader_id: user.id,
      max_players: 2,
      is_public: false,
      turn_order: [user.id, challengedId],
    })
    .select()
    .single();
  if (roomErr) throw roomErr;
  await supabase.from("chess_room_members").insert([
    { room_id: room.id, user_id: user.id, role: "player" },
    { room_id: room.id, user_id: challengedId, role: "player" },
  ]);
  const { data, error } = await supabase
    .from("chess_challenges")
    .insert({
      challenger_id: user.id,
      challenged_id: challengedId,
      room_id: room.id,
    })
    .select()
    .single();
  if (error) throw error;
  return data as Challenge;
}

export async function respondChallenge(
  challengeId: string,
  accept: boolean
): Promise<void> {
  const supabase = createClient();
  await supabase
    .from("chess_challenges")
    .update({ status: accept ? "accepted" : "declined" })
    .eq("id", challengeId);
}

export async function listPendingChallenges(): Promise<Challenge[]> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  const { data, error } = await supabase
    .from("chess_challenges")
    .select("*, challenger:profiles!chess_challenges_challenger_id_fkey(full_name, username)")
    .eq("challenged_id", user.id)
    .eq("status", "pending")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(
    (c: Record<string, unknown> & {
      challenger?: { full_name?: string | null; username?: string | null };
    }) => ({
      ...(c as unknown as Challenge),
      challenger_name:
        c.challenger?.full_name || c.challenger?.username || "Someone",
    })
  );
}
