"use client";

import { useEffect, useState } from "react";
import { fetchLeaderboard, type LeaderboardRow } from "@/lib/supabase/engagement";
import { followUser } from "@/lib/supabase/friends";
import { useAuth } from "./AuthProvider";
import { levelForXp, titleForLevel } from "@/lib/chess/levels";
import type { Lang } from "@/lib/chess/types";

function nameOf(r: LeaderboardRow): string {
  return r.full_name || r.username || "Player";
}

export function LeaderboardView({ lang }: { lang: Lang }) {
  const { user } = useAuth();
  const [rows, setRows] = useState<LeaderboardRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [following, setFollowing] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchLeaderboard(15)
      .then(setRows)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const toggleFollow = async (id: string) => {
    if (!user || id === user.id) return;
    try {
      if (following.has(id)) return; // already following (unfollow via Friends tab)
      await followUser(id);
      setFollowing(new Set(following).add(id));
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="ch-view">
      <h2>🏆 {lang === "vi" ? "Bảng xếp hạng" : "Leaderboard"}</h2>
      {loading ? (
        <p>…</p>
      ) : rows.length === 0 ? (
        <p>{lang === "vi" ? "Chưa có dữ liệu." : "No data yet."}</p>
      ) : (
        <ol className="ch-board-list">
          {rows.map((r, i) => {
            const lvl = levelForXp(r.xp);
            return (
              <li key={r.id} className="ch-lb-row">
                <span className="ch-lb-rank">#{i + 1}</span>
                <span className="ch-lb-name">{nameOf(r)}</span>
                <span className="ch-lb-title">{titleForLevel(lvl, lang)}</span>
                <span className="ch-lb-xp">⚡{r.xp}</span>
                {user && r.id !== user.id && (
                  <button
                    type="button"
                    className="ch-btn ch-btn-sm"
                    disabled={following.has(r.id)}
                    onClick={() => toggleFollow(r.id)}
                    title={lang === "vi" ? "Theo dõi" : "Follow"}
                  >
                    {following.has(r.id) ? "✓" : "＋"}
                  </button>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
