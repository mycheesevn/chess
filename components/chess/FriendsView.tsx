"use client";

import { useEffect, useRef, useState } from "react";
import {
  acceptChallenge,
  listFriends,
  listPendingChallenges,
  respondChallenge,
  sendChallenge,
  unfollowUser,
  type Challenge,
  type FriendRow,
} from "@/lib/supabase/friends";
import { notifyPushTrigger } from "@/lib/push/client";
import { useAuth } from "./AuthProvider";
import type { Lang } from "@/lib/chess/types";

export function FriendsView({
  lang,
  highlightChallengeId,
  onHighlightConsumed,
  onOpenRoom,
}: {
  lang: Lang;
  /** Deep-link: highlight this incoming challenge (e.g. from a notification). */
  highlightChallengeId?: string | null;
  onHighlightConsumed?: () => void;
  /** Called with the challenge room id after accepting, so the app can open it. */
  onOpenRoom?: (roomId: string) => void;
}) {
  const { user } = useAuth();
  const [friends, setFriends] = useState<FriendRow[]>([]);
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [msg, setMsg] = useState("");
  const highlightRef = useRef<HTMLLIElement | null>(null);

  // Deep-link: scroll to and flash the highlighted challenge once loaded.
  useEffect(() => {
    if (
      highlightChallengeId &&
      challenges.some((c) => c.id === highlightChallengeId)
    ) {
      highlightRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
      const t = setTimeout(() => onHighlightConsumed?.(), 3000);
      return () => clearTimeout(t);
    }
  }, [highlightChallengeId, challenges, onHighlightConsumed]);

  const load = async () => {
    try {
      setFriends(await listFriends());
      setChallenges(await listPendingChallenges());
    } catch {
      /* not configured */
    }
  };

  useEffect(() => {
    if (user) load();
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!user) {
    return (
      <div className="ch-view">
        <p>{lang === "vi" ? "Đăng nhập để kết bạn." : "Sign in to add friends."}</p>
      </div>
    );
  }

  const doRespond = async (c: Challenge, accept: boolean) => {
    if (accept) {
      // Accept, then join the challenge room via its code — the challenged
      // player is not a member yet and rooms RLS hides the private room.
      const roomId = await acceptChallenge(c);
      setMsg(
        lang === "vi"
          ? "Đã chấp nhận! Đang vào phòng…"
          : "Accepted! Opening the room…"
      );
      if (roomId && onOpenRoom) {
        onOpenRoom(roomId);
        return;
      }
    } else {
      await respondChallenge(c.id, false);
      setMsg(lang === "vi" ? "Đã từ chối." : "Declined.");
      // Let the server notify the challenger (it verifies the decline).
      notifyPushTrigger({ kind: "challenge_declined", challengeId: c.id });
    }
    load();
  };

  const doChallenge = async (f: FriendRow) => {
    try {
      const ch = await sendChallenge(
        f.id,
        f.full_name || f.username || undefined
      );
      notifyPushTrigger({ kind: "challenge", challengeId: ch.id });
      setMsg(
        lang === "vi" ? `Đã gửi lời thách đấu!` : `Challenge sent!`
      );
    } catch {
      setMsg(lang === "vi" ? "Lỗi." : "Error.");
    }
  };

  const doUnfollow = async (f: FriendRow) => {
    await unfollowUser(f.id);
    load();
  };

  return (
    <div className="ch-view">
      <h2>👤 {lang === "vi" ? "Bạn bè" : "Friends"}</h2>
      {msg && <p className="ch-msg">{msg}</p>}

      <div className="ch-room-form">
        <span>🎁 {lang === "vi" ? "Mời bạn bè (+20 XP cả hai):" : "Invite friends (+20 XP both):"}</span>
        <button
          type="button"
          className="ch-btn ch-btn-sm"
          onClick={() => {
            const link = `${window.location.origin}?ref=${user.id}`;
            navigator.clipboard.writeText(link).catch(() => {});
            setMsg(lang === "vi" ? "Đã copy link mời!" : "Invite link copied!");
          }}
        >
          {lang === "vi" ? "Copy link mời" : "Copy invite link"}
        </button>
      </div>

      {challenges.length > 0 && (
        <>
          <h3>⚔️ {lang === "vi" ? "Lời thách đấu" : "Challenges"}</h3>
          <ul className="ch-board-list">
            {challenges.map((c) => (
              <li
                key={c.id}
                ref={c.id === highlightChallengeId ? highlightRef : undefined}
                className={`ch-lb-row${
                  c.id === highlightChallengeId ? " ch-challenge-highlight" : ""
                }`}
              >
                <span className="ch-lb-name">
                  {c.challenger_name} {lang === "vi" ? "thách đấu bạn!" : "challenges you!"}
                </span>
                <button
                  type="button"
                  className="ch-btn ch-btn-primary ch-btn-sm"
                  onClick={() => doRespond(c, true)}
                >
                  {lang === "vi" ? "Nhận" : "Accept"}
                </button>
                <button
                  type="button"
                  className="ch-btn ch-btn-sm"
                  onClick={() => doRespond(c, false)}
                >
                  {lang === "vi" ? "Từ chối" : "Decline"}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}

      <h3>
        {lang === "vi" ? `Đang theo dõi (${friends.length})` : `Following (${friends.length})`}
      </h3>
      {friends.length === 0 ? (
        <p className="ch-hint">
          {lang === "vi"
            ? "Kết bạn từ bảng xếp hạng để thách đấu."
            : "Follow players from the leaderboard to challenge them."}
        </p>
      ) : (
        <ul className="ch-board-list">
          {friends.map((f) => (
            <li key={f.id} className="ch-lb-row">
              <span className="ch-lb-name">{f.full_name || f.username || "Player"}</span>
              <button
                type="button"
                className="ch-btn ch-btn-primary ch-btn-sm"
                onClick={() => doChallenge(f)}
              >
                ⚔️ {lang === "vi" ? "Thách đấu" : "Challenge"}
              </button>
              <button
                type="button"
                className="ch-btn ch-btn-sm"
                onClick={() => doUnfollow(f)}
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
