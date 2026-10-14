"use client";

import { useEffect, useState } from "react";
import {
  fetchLeaderboard,
  fetchMyRank,
  checkinHistory,
  type LeaderboardRow,
} from "@/lib/supabase/engagement";
import { fetchFollowingIds } from "@/lib/supabase/friends";
import { useAuth } from "./AuthProvider";
import { StatsView } from "./StatsView";
import { GuestTeaser } from "./GuestTeaser";
import { FriendButton } from "./FriendButton";
import { Pagination, usePagination } from "./Pagination";
import { shareAchievement } from "@/lib/chess/achievementCard";
import { STR } from "@/lib/chess/i18n";
import { levelForXp, levelProgress, ratingTitle, xpForNextLevel } from "@/lib/chess/levels";
import type { Lang } from "@/lib/chess/types";

const LEADERBOARD_PAGE_SIZE = 15;
const RANK_MEDAL = ["🥇", "🥈", "🥉"];

function nameOf(r: LeaderboardRow): string {
  return r.full_name?.trim() || r.username?.trim() || "";
}

export function LeaderboardView({ lang }: { lang: Lang }) {
  const s = STR[lang];
  const { user, chessStats, displayName } = useAuth();
  const [tab, setTab] = useState<"board" | "stats">("board");
  const [rows, setRows] = useState<LeaderboardRow[]>([]);
  const [following, setFollowing] = useState<Set<string>>(new Set());
  const paging = usePagination(rows, LEADERBOARD_PAGE_SIZE);
  const [myRank, setMyRank] = useState<number | null>(null);
  const [streak, setStreak] = useState(0);
  const [loading, setLoading] = useState(true);
  const [sharingAch, setSharingAch] = useState(false);
  const [shareToast, setShareToast] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      setRows([]);
      return;
    }
    setLoading(true);
    Promise.all([fetchLeaderboard(), fetchMyRank(user.id)])
      .then(([r, rank]) => {
        setRows(r);
        setMyRank(rank);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
    fetchFollowingIds().then(setFollowing).catch(() => {});
    checkinHistory()
      .then((rows) => {
        if (rows.length === 0) return;
        const fmt = new Intl.DateTimeFormat("en-CA", {
          timeZone: "Asia/Ho_Chi_Minh",
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        });
        const today = fmt.format(new Date());
        const yesterday = fmt.format(new Date(Date.now() - 86400000));
        const latest = rows[0];
        setStreak(
          latest.date === today || latest.date === yesterday
            ? latest.streak
            : 0
        );
      })
      .catch(() => {});
  }, [user]);

  /** Share the user's leaderboard rank as an achievement card. */
  const shareRank = async () => {
    if (sharingAch || myRank == null) return;
    setSharingAch(true);
    try {
      const outcome = await shareAchievement(
        "rank",
        { title: s.achRankTitle(myRank), rank: myRank },
        lang
      );
      setShareToast(outcome === "shared" ? s.shareDone : s.shareDownloaded);
      window.setTimeout(() => setShareToast(null), 4000);
    } catch {
      /* ignore */
    } finally {
      setSharingAch(false);
    }
  };

  const myLevel = chessStats ? levelForXp(chessStats.xp) : 1;
  const nextXp = chessStats ? xpForNextLevel(chessStats.xp) : null;
  const progress = chessStats ? levelProgress(chessStats.xp).prog : 1;
  const winRate =
    chessStats && chessStats.games_played > 0
      ? Math.round((chessStats.wins / chessStats.games_played) * 100)
      : 0;

  return (
    <div className="ch-view">
      <div className="ch-lb-tabs">
        <button
          type="button"
          className={tab === "board" ? "active" : ""}
          onClick={() => setTab("board")}
        >
          🏆 {s.leaderboard}
        </button>
        <button
          type="button"
          className={tab === "stats" ? "active" : ""}
          onClick={() => setTab("stats")}
        >
          📊 {s.stats}
        </button>
      </div>
      {tab === "stats" ? (
        <StatsView lang={lang} />
      ) : !user ? (
        <>
          <p className="ch-empty-note">{s.leaderboardLogin}</p>
          <GuestTeaser lang={lang} />
        </>
      ) : loading ? (
        <p className="ch-empty-note">{s.loading}</p>
      ) : (
        <>
          {chessStats && (
            <section className="ch-lb-me">
              {shareToast && <div className="ch-toast">{shareToast}</div>}
              <div className="ch-lb-me-row">
                <span className="ch-lb-me-label">
                  #{myRank ?? "–"} · {ratingTitle(chessStats.rating, lang)}
                </span>
                <span className="ch-lb-xp">⭐ {chessStats.rating}</span>
                {myRank != null && (
                  <button
                    type="button"
                    className="ch-btn ch-btn-icon ch-btn-sm"
                    onClick={shareRank}
                    disabled={sharingAch}
                    title={s.achShare}
                    aria-label={s.achShare}
                  >
                    📤
                  </button>
                )}
              </div>
              <div className="ch-lb-me-row">
                <span className="ch-lb-me-label">{displayName}</span>
                <span className="ch-lb-me-sub">
                  Lv {myLevel}
                  {nextXp != null && ` · ${s.xpToNext(nextXp - chessStats.xp, myLevel + 1)}`}
                </span>
              </div>
              <div
                className="ch-progress"
                role="progressbar"
                aria-valuenow={Math.round(progress * 100)}
                aria-valuemin={0}
                aria-valuemax={100}
              >
                <div
                  className="ch-progress-fill"
                  style={{ width: `${progress * 100}%` }}
                />
              </div>
              <div className="ch-stats-row">
                <span>
                  📈 {chessStats.peak_rating} {s.peakRating}
                </span>
                <span>
                  🎯 {winRate}% {s.winRate}
                </span>
                <span>
                  🔥 {streak} {s.dayStreak}
                </span>
                <span>
                  🎮 {chessStats.games_played} {s.gamesPlayed}
                </span>
              </div>
            </section>
          )}
          <h3 className="ch-section-title">{s.topPlayers}</h3>
          {rows.length === 0 ? (
            <p className="ch-empty-note">{s.leaderboardEmpty}</p>
          ) : (
            <ol className="ch-board-list">
              {paging.pageItems.map((r, i) => {
                const rank = paging.page * LEADERBOARD_PAGE_SIZE + i;
                const isMe = user && r.id === user.id;
                return (
                  <li
                    key={r.id}
                    className={`ch-lb-row${isMe ? " ch-lb-me-row-hl" : ""}`}
                  >
                    <span className="ch-lb-rank">
                      {RANK_MEDAL[rank] ?? `#${rank + 1}`}
                    </span>
                    <span className="ch-friend-avatar">
                      {r.avatar_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={r.avatar_url}
                          alt=""
                          className="ch-friend-avatar-img"
                        />
                      ) : (
                        (nameOf(r) || "?").slice(0, 1).toUpperCase()
                      )}
                    </span>
                    <span className="ch-lb-main">
                      <strong>
                        {nameOf(r) || s.noName}
                        {isMe && ` (${s.you})`}
                      </strong>
                      <span className="ch-lb-sub">
                        {ratingTitle(r.rating, lang)} · Lv {levelForXp(r.xp)} ·{" "}
                        {r.wins}/{r.games_played} {s.wins}
                      </span>
                    </span>
                    <span className="ch-lb-xp">⭐ {r.rating}</span>
                    {!isMe && (
                      <FriendButton
                        lang={lang}
                        userId={r.id}
                        following={following}
                        onChanged={(id, now) =>
                          setFollowing((prev) => {
                            const next = new Set(prev);
                            if (now) next.add(id);
                            else next.delete(id);
                            return next;
                          })
                        }
                      />
                    )}
                  </li>
                );
              })}
            </ol>
          )}
          {rows.length > 0 && (
            <Pagination
              page={paging.page}
              pageCount={paging.pageCount}
              onPage={paging.setPage}
            />
          )}
        </>
      )}
    </div>
  );
}
