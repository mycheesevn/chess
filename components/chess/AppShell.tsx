"use client";

import { useEffect, useState } from "react";
import { ChessGame } from "./ChessGame";
import { claimWelcome } from "@/lib/supabase/quests";
import { CheckinView } from "./CheckinView";
import { LeaderboardView } from "./LeaderboardView";
import { RoomView } from "./RoomView";
import { FriendsView } from "./FriendsView";
import { HistoryView } from "./HistoryView";
import { PushSettings } from "./PushSettings";
import { QuestsView } from "./QuestsView";
import { PuzzleView } from "./PuzzleView";
import { CorrView } from "./CorrView";
import { useAuth } from "./AuthProvider";
import { recordGameResult } from "@/lib/supabase/engagement";
import type { Lang } from "@/lib/chess/types";

type View = "play" | "checkin" | "ranks" | "rooms" | "friends" | "history" | "quests" | "corr" | "puzzle" | "push";

export function AppShell() {
  const [view, setView] = useState<View>("play");
  const [lang, setLang] = useState<Lang>(() => {
    try {
      return (localStorage.getItem("chess-lang") as Lang) || "en";
    } catch {
      return "en";
    }
  });
  const { user, chessStats, loading, signInWithGoogle, signInWithFacebook, signOut, displayName, refreshProfile } =
    useAuth();
  const [welcomeMsg, setWelcomeMsg] = useState("");

  // Welcome bonus on first login
  useEffect(() => {
    if (!user) return;
    claimWelcome()
      .then((granted) => {
        if (granted) {
          setWelcomeMsg(
            lang === "vi"
              ? "🎉 Chào mừng! +50 XP tân thủ!"
              : "🎉 Welcome! +50 XP bonus!"
          );
          refreshProfile();
          window.setTimeout(() => setWelcomeMsg(""), 5000);
        }
      })
      .catch(() => {});
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  // Handle ?ref=<user-id> referral links
  useEffect(() => {
    if (!user) return;
    const params = new URLSearchParams(window.location.search);
    const ref = params.get("ref");
    if (!ref || ref === user.id) return;
    (async () => {
      try {
        const { createClient } = await import("@/lib/supabase/client");
        await createClient().rpc("chess_claim_referral", { p_referrer_id: ref });
        await refreshProfile();
        // Clean the URL
        params.delete("ref");
        const qs = params.toString();
        window.history.replaceState(
          null,
          "",
          window.location.pathname + (qs ? `?${qs}` : "")
        );
      } catch {
        /* ignore */
      }
    })();
  }, [user, refreshProfile]);

  const handleGameEnd = async (
    result: "win" | "loss" | "draw",
    color: "white" | "black",
    level: number,
    plies: number,
    uciMoves: string
  ) => {
    if (!user) return; // guests don't earn XP
    try {
      await recordGameResult(color, level, result, plies, uciMoves);
      await refreshProfile();
    } catch {
      /* offline or not configured — skip silently */
    }
  };

  return (
    <div className="ch-app">
      <nav className="ch-nav">
        <div className="ch-nav-tabs" role="tablist">
          <button
            role="tab"
            aria-selected={view === "play"}
            className={view === "play" ? "active" : ""}
            onClick={() => setView("play")}
          >
            ♞ {lang === "vi" ? "Chơi" : "Play"}
          </button>
          <button
            role="tab"
            aria-selected={view === "checkin"}
            className={view === "checkin" ? "active" : ""}
            onClick={() => setView("checkin")}
          >
            📅 {lang === "vi" ? "Điểm danh" : "Check-in"}
          </button>
          <button
            role="tab"
            aria-selected={view === "ranks"}
            className={view === "ranks" ? "active" : ""}
            onClick={() => setView("ranks")}
          >
            🏆 {lang === "vi" ? "Xếp hạng" : "Ranks"}
          </button>
          <button
            role="tab"
            aria-selected={view === "rooms"}
            className={view === "rooms" ? "active" : ""}
            onClick={() => setView("rooms")}
          >
            👥 {lang === "vi" ? "Phòng" : "Rooms"}
          </button>
          <button
            role="tab"
            aria-selected={view === "friends"}
            className={view === "friends" ? "active" : ""}
            onClick={() => setView("friends")}
          >
            👤 {lang === "vi" ? "Bạn" : "Friends"}
          </button>
          <button
            role="tab"
            aria-selected={view === "history"}
            className={view === "history" ? "active" : ""}
            onClick={() => setView("history")}
          >
            📜 {lang === "vi" ? "Lịch sử" : "History"}
          </button>
          <button
            role="tab"
            aria-selected={view === "quests"}
            className={view === "quests" ? "active" : ""}
            onClick={() => setView("quests")}
          >
            🌱 {lang === "vi" ? "Nhiệm vụ" : "Quests"}
          </button>
          <button
            role="tab"
            aria-selected={view === "push"}
            className={view === "push" ? "active" : ""}
            onClick={() => setView("push")}
          >
            🔔
          </button>
          <button
            role="tab"
            aria-selected={view === "corr"}
            className={view === "corr" ? "active" : ""}
            onClick={() => setView("corr")}
          >
            ✉️ {lang === "vi" ? "Cờ thư" : "Correspondence"}
          </button>
          <button
            role="tab"
            aria-selected={view === "puzzle"}
            className={view === "puzzle" ? "active" : ""}
            onClick={() => setView("puzzle")}
          >
            🧩 {lang === "vi" ? "Đố" : "Puzzle"}
          </button>
        </div>
        <div className="ch-nav-auth">
          {loading ? null : user ? (
            <div className="ch-user-chip">
              <span className="ch-xp">
                ⚡{chessStats?.xp ?? 0}
              </span>
              <span>{displayName}</span>
              <button type="button" onClick={signOut} className="ch-btn ch-btn-sm">
                {lang === "vi" ? "Đăng xuất" : "Sign out"}
              </button>
            </div>
          ) : (
            <div className="ch-auth-btns">
              <button
                type="button"
                onClick={signInWithGoogle}
                className="ch-btn ch-btn-primary ch-btn-sm"
              >
                G {lang === "vi" ? "Đăng nhập" : "Sign in"}
              </button>
              <button
                type="button"
                onClick={signInWithFacebook}
                className="ch-btn ch-btn-sm"
              >
                f
              </button>
            </div>
          )}
        </div>
      </nav>

      {view === "play" && <ChessGame onGameEnd={handleGameEnd} lang={lang} setLang={setLang} />}
      {view === "checkin" && <CheckinView lang={lang} />}
      {view === "ranks" && <LeaderboardView lang={lang} />}
      {view === "rooms" && <RoomView lang={lang} />}
      {view === "friends" && <FriendsView lang={lang} />}
      {view === "history" && <HistoryView lang={lang} />}
      {view === "quests" && <QuestsView lang={lang} />}
      {view === "push" && <PushSettings lang={lang} />}
      {view === "corr" && <CorrView lang={lang} />}
      {view === "puzzle" && <PuzzleView lang={lang} />}
      {welcomeMsg && <div className="ch-toast">{welcomeMsg}</div>}
    </div>
  );
}
