"use client";

import { useEffect, useRef, useState } from "react";
import {
  fetchComments,
  postComment,
  sendReaction,
  subscribeComments,
  subscribeReactions,
  type RoomComment,
} from "@/lib/supabase/comments";
import { useAuth } from "./AuthProvider";
import type { Lang } from "@/lib/chess/types";

const EMOJIS = ["👏", "🔥", "😱", "👍", "😮"];

export function MatchSocial({
  roomId,
  matchId,
  lang,
  moveNumber,
}: {
  roomId: string;
  matchId: string;
  lang: Lang;
  moveNumber?: number | null;
}) {
  const { user } = useAuth();
  const [comments, setComments] = useState<RoomComment[]>([]);
  const [draft, setDraft] = useState("");
  const [floaters, setFloaters] = useState<{ id: number; emoji: string }[]>([]);
  const [lastSent, setLastSent] = useState(0);
  const floaterId = useRef(0);

  useEffect(() => {
    fetchComments(matchId).then(setComments).catch(() => {});
    const cc = subscribeComments(matchId, (c) =>
      setComments((prev) => [...prev, c])
    );
    const rc = subscribeReactions(matchId, (emoji) => {
      const id = ++floaterId.current;
      setFloaters((prev) => [...prev, { id, emoji }]);
      window.setTimeout(
        () => setFloaters((prev) => prev.filter((f) => f.id !== id)),
        2000
      );
    });
    return () => {
      cc.unsubscribe();
      rc.unsubscribe();
    };
  }, [matchId]);

  const doPost = async () => {
    const body = draft.trim();
    if (!body || !user) return;
    setDraft("");
    try {
      await postComment(roomId, matchId, body, moveNumber ?? null);
      const fresh = await fetchComments(matchId);
      setComments(fresh);
    } catch {
      /* ignore */
    }
  };

  const doReact = async (emoji: string) => {
    if (!user) return;
    const now = Date.now();
    if (now - lastSent < 1500) return; // throttle
    setLastSent(now);
    try {
      await sendReaction(roomId, matchId, emoji);
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="ch-social">
      <div className="ch-floaters" aria-hidden="true">
        {floaters.map((f) => (
          <span key={f.id} className="ch-floater">
            {f.emoji}
          </span>
        ))}
      </div>

      {user ? (
        <div className="ch-reaction-bar">
          {EMOJIS.map((e) => (
            <button key={e} type="button" onClick={() => doReact(e)}>
              {e}
            </button>
          ))}
        </div>
      ) : (
        <p className="ch-hint">
          {lang === "vi"
            ? "Đăng nhập để reaction và bình luận."
            : "Sign in to react and comment."}
        </p>
      )}

      <div className="ch-comments">
        {comments.map((c) => (
          <div key={c.id} className="ch-comment">
            {c.avatar_url ? (
              <img src={c.avatar_url} alt="" className="ch-comment-avatar" />
            ) : (
              <span className="ch-comment-avatar ch-comment-avatar-fallback">♟</span>
            )}
            <div className="ch-comment-body">
              <div className="ch-comment-meta">
                <strong>{c.user_name}</strong>
                {c.move_number != null && (
                  <span className="ch-comment-move">
                    {lang === "vi" ? `nước ${c.move_number}` : `move ${c.move_number}`}
                  </span>
                )}
                <time className="ch-comment-time">
                  {new Date(c.created_at).toLocaleString(
                    lang === "vi" ? "vi-VN" : "en-US",
                    { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" }
                  )}
                </time>
              </div>
              <div>{c.body}</div>
            </div>
          </div>
        ))}
      </div>

      {user && (
        <div className="ch-comment-form">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && doPost()}
            placeholder={lang === "vi" ? "Bình luận..." : "Comment..."}
            className="ch-input"
            maxLength={500}
          />
          <button type="button" className="ch-btn ch-btn-sm" onClick={doPost}>
            {lang === "vi" ? "Gửi" : "Send"}
          </button>
        </div>
      )}
    </div>
  );
}
