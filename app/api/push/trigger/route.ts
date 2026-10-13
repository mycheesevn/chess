import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { needAuth } from "../_auth";
import { sendPushToUser } from "@/lib/push/server";

/**
 * Event-verified push triggers for chess. Server re-checks DB state before sending.
 * kinds:
 *  - { kind: "challenge", challengeId } — notify the challenged player.
 *  - { kind: "turn", matchId } — notify whoever's turn it now is (room match).
 *  - { kind: "corr", gameId } — notify the opponent in a correspondence game.
 */

const lastSent = new Map<string, number>();
function throttled(key: string, minIntervalMs: number): boolean {
  const now = Date.now();
  const prev = lastSent.get(key) || 0;
  if (now - prev < minIntervalMs) return true;
  lastSent.set(key, now);
  return false;
}

function service() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) throw new Error("push_not_configured");
  return createClient(url, serviceKey);
}

function displayName(p: { full_name?: string | null; username?: string | null } | null): string {
  if (!p) return "A player";
  return p.full_name || p.username || "A player";
}

export async function POST(req: Request) {
  const auth = await needAuth(req);
  if ("error" in auth) return auth.error;
  const { uid } = auth;

  let body: { kind?: string; challengeId?: string; matchId?: string; gameId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  try {
    if (body.kind === "challenge" && body.challengeId) {
      return await onChallenge(uid, body.challengeId);
    }
    if (body.kind === "turn" && body.matchId) {
      return await onTurn(uid, body.matchId);
    }
    if (body.kind === "corr" && body.gameId) {
      return await onCorr(uid, body.gameId);
    }
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "failed";
    const status = msg === "push_not_configured" ? 500 : 400;
    return NextResponse.json({ error: msg }, { status });
  }
}

async function onChallenge(challengerId: string, challengeId: string) {
  if (throttled(`challenge:${challengeId}`, 5 * 60 * 1000)) {
    return NextResponse.json({ ok: true, skipped: "throttled" });
  }
  const sb = service();
  const { data: ch, error } = await sb
    .from("chess_challenges")
    .select("id, challenger_id, challenged_id, status, room_id, created_at")
    .eq("id", challengeId)
    .single();
  if (error || !ch) throw new Error("not_found");
  if (ch.challenger_id !== challengerId) throw new Error("forbidden");
  if (ch.status !== "pending") throw new Error("not_pending");
  if (Date.now() - new Date(ch.created_at).getTime() > 10 * 60 * 1000) {
    throw new Error("stale");
  }
  const { data: me } = await sb
    .from("profiles")
    .select("full_name, username")
    .eq("id", challengerId)
    .single();
  const name = displayName(me);
  const { sent } = await sendPushToUser(ch.challenged_id, {
    title: "⚔️ Challenge!",
    body: `${name} challenged you to a chess game.`,
    url: "/",
    tag: `challenge-${ch.id}`,
  });
  return NextResponse.json({ ok: true, sent });
}

async function onTurn(moverId: string, matchId: string) {
  if (throttled(`turn:${matchId}:${moverId}`, 30 * 1000)) {
    return NextResponse.json({ ok: true, skipped: "throttled" });
  }
  const sb = service();
  const { data: m, error } = await sb
    .from("chess_room_matches")
    .select("id, room_id, white_id, black_id, status, moves")
    .eq("id", matchId)
    .single();
  if (error || !m) throw new Error("not_found");
  if (m.status !== "active") throw new Error("not_active");
  const plies = m.moves ? m.moves.trim().split(/\s+/).filter(Boolean).length : 0;
  const toMoveId = plies % 2 === 0 ? m.white_id : m.black_id;
  if (!toMoveId || toMoveId === moverId) throw new Error("not_their_turn");
  if (moverId !== m.white_id && moverId !== m.black_id) throw new Error("forbidden");

  const { data: room } = await sb.from("chess_rooms").select("name").eq("id", m.room_id).single();
  const { sent } = await sendPushToUser(toMoveId, {
    title: "♟️ Your move!",
    body: room?.name ? `Your turn in room ${room.name}.` : "Your turn to move.",
    url: "/",
    tag: `turn-${m.id}-${plies}`,
  });
  return NextResponse.json({ ok: true, sent });
}

async function onCorr(moverId: string, gameId: string) {
  if (throttled(`corr:${gameId}:${moverId}`, 30 * 1000)) {
    return NextResponse.json({ ok: true, skipped: "throttled" });
  }
  const sb = service();
  const { data: g, error } = await sb
    .from("chess_corr_games")
    .select("id, white_id, black_id, status, moves")
    .eq("id", gameId)
    .single();
  if (error || !g) throw new Error("not_found");
  if (g.status !== "active") throw new Error("not_active");
  if (moverId !== g.white_id && moverId !== g.black_id) throw new Error("forbidden");
  const plies = g.moves ? g.moves.trim().split(/\s+/).filter(Boolean).length : 0;
  const toMoveId = plies % 2 === 0 ? g.white_id : g.black_id;
  if (!toMoveId || toMoveId === moverId) throw new Error("not_their_turn");

  const { data: me } = await sb
    .from("profiles")
    .select("full_name, username")
    .eq("id", moverId)
    .single();
  const name = displayName(me);
  const { sent } = await sendPushToUser(toMoveId, {
    title: "✉️ Correspondence — your move!",
    body: `${name} moved. Your turn.`,
    url: "/",
    tag: `corr-${g.id}-${plies}`,
  });
  return NextResponse.json({ ok: true, sent });
}
