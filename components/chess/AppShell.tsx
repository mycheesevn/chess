"use client";

import { useCallback, useEffect, useState, type CSSProperties } from "react";
import { ChessGame, type TcMs } from "./ChessGame";
import { LEVELS } from "@/lib/chess/ai";
import { STR } from "@/lib/chess/i18n";
import { LEVEL_THRESHOLDS, levelForXp } from "@/lib/chess/levels";
import {
  setBoardTheme,
  useBoardTheme,
  type BoardTheme,
} from "@/lib/chess/boardTheme";
import { claimWelcome } from "@/lib/supabase/quests";
import { bumpGuestStat } from "@/lib/guestStats";
import { CheckinView } from "./CheckinView";
import { LeaderboardView } from "./LeaderboardView";
import { RoomView } from "./RoomView";
import { FriendsView } from "./FriendsView";
import { HistoryView } from "./HistoryView";
import { SetupView } from "./SetupView";
import { LibraryView } from "./LibraryView";
import { positionToFen } from "@/lib/chess/fen";
import { AuthModal } from "./AuthModal";
import { ProfileModal } from "./ProfileModal";
import { isMuted, setMuted } from "@/lib/chess/sound";
import {
  useBigCheckBanner,
  setBigCheckBanner,
} from "@/lib/chess/checkBanner";
import { PushSettings } from "./PushSettings";
import { QuestsView } from "./QuestsView";
import { PuzzleView } from "./PuzzleView";
import { CorrView } from "./CorrView";
import { NotificationsView } from "./NotificationsView";
import { fetchUnreadCount } from "@/lib/supabase/notifications";
import { notifyPushTrigger } from "@/lib/push/client";
import {
  acceptChallenge,
  respondChallenge,
  startPresence,
  subscribeChallenges,
  type IncomingChallenge,
} from "@/lib/supabase/friends";
import { useAuth } from "./AuthProvider";
import { recordGameResult } from "@/lib/supabase/engagement";
import type { Board as BoardT, Color, Lang, Level } from "@/lib/chess/types";

type View =
  | "play"
  | "checkin"
  | "ranks"
  | "rooms"
  | "friends"
  | "history"
  | "quests"
  | "corr"
  | "puzzle"
  | "library"
  | "setup"
  | "notifications";

// Drawer modes in PacClone's fixed order (community doesn't
// exist in Chess yet). Friends and Notifications are NOT here — they live
// in the avatar menu (no duplicate navigation).
const NAV_ENTRIES: Array<{ view: View; icon: string; vi: string; en: string }> = [
  { view: "play", icon: "", vi: "Đánh với máy", en: "Vs computer" },
  { view: "puzzle", icon: "", vi: "Thế cờ hằng ngày", en: "Daily puzzle" },
  { view: "library", icon: "📚", vi: "Thư viện bí kíp", en: "Playbook library" },
  { view: "setup", icon: "🧩", vi: "Sắp xếp bàn cờ", en: "Board setup" },
  { view: "history", icon: "", vi: "Lịch sử", en: "History" },
  { view: "ranks", icon: "", vi: "Xếp hạng", en: "Leaderboard" },
  { view: "rooms", icon: "👥", vi: "Phòng chơi", en: "Rooms" },
  { view: "corr", icon: "✉️", vi: "Cờ thư", en: "Correspondence" },
  { view: "checkin", icon: "📅", vi: "Điểm danh", en: "Check-in" },
  { view: "quests", icon: "🌱", vi: "Nhiệm vụ", en: "Quests" },
];

interface BeforeInstallPromptEvent extends Event {
  prompt: () => void;
  userChoice: Promise<{ outcome: string }>;
}

/** Board style picker for the identity menus' Settings sections. */
function BoardStyleField({ lang }: { lang: Lang }) {
  const theme = useBoardTheme();
  return (
    <label className="ch-field">
      <span>{lang === "vi" ? "Kiểu bàn cờ" : "Board style"}</span>
      <select
        value={theme}
        onChange={(e) => setBoardTheme(e.target.value as BoardTheme)}
        className="ch-select"
      >
        <option value="wood">{lang === "vi" ? "🪵 Gỗ" : "🪵 Wood"}</option>
        <option value="green">
          {lang === "vi" ? "🟩 Xanh lá" : "🟩 Green"}
        </option>
      </select>
    </label>
  );
}

/**
 * Sound + effect toggles for the identity menus' Settings sections
 * (PacClone pattern: sound on/off button, big-check-banner checkbox —
 * banner defaults OFF).
 */
function SettingsToggles({ lang }: { lang: Lang }) {
  const [muted, setMutedState] = useState(() => isMuted());
  const bigCheck = useBigCheckBanner();
  return (
    <>
      <button
        type="button"
        className="ch-btn ch-btn-sm"
        onClick={() => {
          const m = !muted;
          setMuted(m);
          setMutedState(m);
        }}
        aria-label={muted ? (lang === "vi" ? "Bật âm thanh" : "Turn sound on") : (lang === "vi" ? "Tắt âm thanh" : "Turn sound off")}
      >
        {muted ? "🔇" : "🔊"}{" "}
        {muted
          ? lang === "vi" ? "Bật âm thanh" : "Turn sound on"
          : lang === "vi" ? "Tắt âm thanh" : "Turn sound off"}
      </button>
      <label className="ch-check-toggle">
        <input
          type="checkbox"
          checked={bigCheck}
          onChange={(e) => setBigCheckBanner(e.target.checked)}
        />
        <span>
          {lang === "vi"
            ? 'Hiện chữ "Chiếu!" to ở giữa bàn cờ'
            : 'Show big "Check!" banner mid-board'}
        </span>
      </label>
    </>
  );
}

export function AppShell() {
  const [view, setView] = useState<View>("play");
  const [deepLinkCorrId, setDeepLinkCorrId] = useState<string | null>(null);
  const [deepLinkChallengeId, setDeepLinkChallengeId] = useState<string | null>(
    null
  );
  // Room id to auto-open when the rooms view appears (challenge accept).
  const [pendingRoomId, setPendingRoomId] = useState<string | null>(null);
  const [deepLinkRoomCode, setDeepLinkRoomCode] = useState<string | null>(null);
  // Realtime incoming challenge popup.
  const [incomingChallenge, setIncomingChallenge] =
    useState<IncomingChallenge | null>(null);
  const [declinedToast, setDeclinedToast] = useState<string | null>(null);
  const [lang, setLangState] = useState<Lang>(() => {
    try {
      return (localStorage.getItem("chess-lang") as Lang) || "vi";
    } catch {
      return "vi";
    }
  });
  const {
    user,
    profile,
    chessStats,
    loading,
    signOut,
    displayName,
    refreshProfile,
  } = useAuth();
  const [welcomeMsg, setWelcomeMsg] = useState("");

  // Shell UI state: drawer (☰), identity dropdown menu, collapsible settings.
  const [menuOpen, setMenuOpen] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  // Auth modal (gear menu: Log in / Sign up) — mode "in" or "up", null = closed.
  const [authOpen, setAuthOpen] = useState<null | "in" | "up">(null);
  // Profile modal (identity menu: 👤 Hồ sơ) — mirrors PacClone's position.
  const [profileOpen, setProfileOpen] = useState(false);
  const [settingsExpanded, setSettingsExpanded] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  // Play configuration owned here — it lives in the drawer's play-settings
  // section (PacClone pattern); ChessGame receives it as controlled props.
  const [level, setLevel] = useState<Level>(5);
  const [playerColor, setPlayerColor] = useState<Color>("white");
  const [tcMs, setTcMs] = useState<TcMs>("none");
  const [configNonce, setConfigNonce] = useState(0);
  // One-shot custom position handed from SetupView to ChessGame.
  const [customStart, setCustomStart] = useState<{
    fen: string;
    nonce: number;
  } | null>(null);
  const handleCustomPlay = useCallback(
    (board: BoardT, color: Color, turn: Color) => {
      setPlayerColor(color);
      setCustomStart({ fen: positionToFen(board, turn), nonce: Date.now() });
      setView("play");
    },
    []
  );
  const handleCustomStartConsumed = useCallback((nonce: number) => {
    setCustomStart((current) => (current?.nonce === nonce ? null : current));
  }, []);
  // PWA install prompt (drawer "Install app" section, only when available).
  const [installPrompt, setInstallPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  useEffect(() => {
    const h = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", h);
    return () => window.removeEventListener("beforeinstallprompt", h);
  }, []);
  // Guest teaser (and future guest CTAs) ask to open the auth modal.
  useEffect(() => {
    const open = () => setAuthOpen("in");
    window.addEventListener("ch:open-auth", open);
    return () => window.removeEventListener("ch:open-auth", open);
  }, []);
  const onInstallClick = async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    try {
      await installPrompt.userChoice;
    } catch {
      /* ignore */
    }
    setInstallPrompt(null);
  };

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    try {
      localStorage.setItem("chess-lang", l);
    } catch {
      /* ignore */
    }
    document.documentElement.lang = l;
  }, []);

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

  // Unread notification count for the avatar badge: on login + every 60s.
  const refreshUnread = useCallback(async () => {
    if (!user) {
      setUnreadCount(0);
      return;
    }
    try {
      setUnreadCount(await fetchUnreadCount());
    } catch {
      /* ignore */
    }
  }, [user]);
  useEffect(() => {
    refreshUnread();
    const t = window.setInterval(refreshUnread, 60000);
    return () => window.clearInterval(t);
  }, [refreshUnread]);

  // Realtime challenge popup + declined toast while logged in.
  useEffect(() => {
    if (!user) return;
    const unsub = subscribeChallenges(
      user.id,
      (c) => setIncomingChallenge(c),
      (name) => {
        setDeclinedToast(
          lang === "vi"
            ? `😞 ${name} đã từ chối lời thách đấu của bạn.`
            : `😞 ${name} declined your challenge.`
        );
        window.setTimeout(() => setDeclinedToast(null), 4000);
      }
    );
    return unsub;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // Online presence while logged in (friends list shows online dots).
  useEffect(() => {
    if (!user) return;
    const stop = startPresence(user.id);
    return stop;
  }, [user?.id]);

  const doAcceptChallenge = async (c: IncomingChallenge) => {
    // Accept the challenge, then join the challenge room via its code
    // (the challenged player is not a member yet and rooms RLS hides the
    // private room from them).
    const roomId = await acceptChallenge(c);
    setIncomingChallenge(null);
    if (roomId) {
      setPendingRoomId(roomId);
      setView("rooms");
    }
  };

  const doDeclineChallenge = async (c: IncomingChallenge) => {
    await respondChallenge(c.id, false);
    setIncomingChallenge(null);
    // Let the server notify the challenger (it verifies the decline).
    notifyPushTrigger({ kind: "challenge_declined", challengeId: c.id });
  };

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

  // Handle ?room=CODE, ?corr=<uuid> and ?challenge=<uuid> deep links (from
  // push notifications and invite links).
  // Runs on mount AND on window focus: tapping a notification while the app
  // is already open makes the service worker navigate the existing tab, so a
  // mount-only parser would miss it and the tap would appear to do nothing.
  const parseDeepLink = useCallback(() => {
    try {
      const q = new URLSearchParams(window.location.search);
      const corr = q.get("corr");
      const challenge = q.get("challenge");
      const room = q.get("room");
      let consumed = false;
      if (room && /^[A-Za-z0-9]{6}$/.test(room)) {
        setDeepLinkRoomCode(room.toUpperCase());
        setView("rooms");
        consumed = true;
      } else if (corr && /^[0-9a-f-]{36}$/i.test(corr)) {
        setDeepLinkCorrId(corr);
        setView("corr");
        consumed = true;
      } else if (challenge && /^[0-9a-f-]{36}$/i.test(challenge)) {
        setDeepLinkChallengeId(challenge);
        setView("friends");
        consumed = true;
      }
      if (consumed) window.history.replaceState({}, "", window.location.pathname);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    parseDeepLink();
  }, [parseDeepLink]);

  useEffect(() => {
    const onFocus = () => parseDeepLink();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [parseDeepLink]);

  const go = useCallback((v: View) => {
    setView(v);
    setMenuOpen(false);
    setAccountMenuOpen(false);
  }, []);

  const handleGameEnd = async (
    result: "win" | "loss" | "draw",
    color: "white" | "black",
    level: number,
    plies: number,
    uciMoves: string,
    startFen: string
  ) => {
    if (!user) {
      // Guests don't earn XP, but their games feed the signup teaser
      // (PacClone guestStats pattern).
      bumpGuestStat("games");
      return;
    }
    try {
      await recordGameResult(color, level, result, plies, uciMoves, startFen);
      await refreshProfile();
    } catch {
      /* offline or not configured — skip silently */
    }
  };

  const avatarUrl = profile?.avatar_url || null;
  const s = STR[lang];
  // Level + XP progress ring around the header avatar (PacClone pattern).
  const myLevel = chessStats ? levelForXp(chessStats.xp) : 1;
  const xpCurTh = LEVEL_THRESHOLDS[myLevel - 1] ?? 0;
  const xpNextTh = LEVEL_THRESHOLDS[myLevel] ?? null;
  const myLevelProg =
    chessStats && xpNextTh && xpNextTh > xpCurTh
      ? (chessStats.xp - xpCurTh) / (xpNextTh - xpCurTh)
      : 1;
  const myXpIntoLevel = chessStats ? chessStats.xp - xpCurTh : 0;
  const myXpForNext = xpNextTh ? xpNextTh - xpCurTh : 1;

  return (
    <div className="ch-app">
      <header className="ch-topbar">
        <button
          type="button"
          className="ch-menu-btn"
          onClick={() => setMenuOpen(true)}
          aria-label="Menu"
          title="Menu"
        >
          ☰
        </button>
        <div className="ch-brand">
          <h1 className="ch-title">♞ {lang === "vi" ? "Cờ vua" : "Chess"}</h1>
        </div>
        <div className="ch-account">
          {loading ? null : user ? (
            <div className="ch-user" role="group" aria-label="Account">
              {chessStats && (
                <button
                  type="button"
                  className="ch-chip"
                  onClick={() => go("ranks")}
                  title={lang === "vi" ? "Xếp hạng" : "Leaderboard"}
                >
                  ⭐ {chessStats.rating} · Lv {myLevel}
                </button>
              )}
              <button
                type="button"
                className="ch-account-btn"
                onClick={() => setAccountMenuOpen((v) => !v)}
                aria-haspopup="menu"
                aria-expanded={accountMenuOpen}
                title={displayName}
                style={{ position: "relative" }}
              >
                {unreadCount > 0 && (
                  <span aria-hidden="true" className="ch-dot" />
                )}
                <span
                  className="ch-level-ring"
                  style={{ "--p": myLevelProg } as CSSProperties}
                  title={`Lv ${myLevel} · ${myXpIntoLevel}/${myXpForNext} XP`}
                >
                  <span className="ch-account-avatar">
                    {avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={avatarUrl} alt="" />
                    ) : (
                      "👤"
                    )}
                  </span>
                </span>
                <span className="ch-account-name">{displayName}</span>
                <span aria-hidden="true" className="ch-caret">
                  ▾
                </span>
              </button>
              {accountMenuOpen && (
                <>
                  <div
                    className="ch-menu-backdrop"
                    onClick={() => setAccountMenuOpen(false)}
                  />
                  <div className="ch-account-menu" role="menu">
                    <div className="ch-account-menu-head">
                      <span className="ch-account-avatar large">
                        {avatarUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={avatarUrl} alt="" />
                        ) : (
                          "👤"
                        )}
                      </span>
                      <div className="ch-account-menu-id">
                        <strong>{displayName}</strong>
                        <span className="ch-muted">{user.email}</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      role="menuitem"
                      className="ch-account-menu-item"
                      onClick={() => {
                        setAccountMenuOpen(false);
                        setProfileOpen(true);
                      }}
                    >
                      👤 {STR[lang].profile}
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      className="ch-account-menu-item"
                      onClick={() => go("notifications")}
                    >
                      🔔 {lang === "vi" ? "Thông báo" : "Notifications"}
                      {unreadCount > 0 && (
                        <span aria-hidden="true" className="ch-badge">
                          {unreadCount > 99 ? "99+" : unreadCount}
                        </span>
                      )}
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      className="ch-account-menu-item"
                      onClick={() => go("friends")}
                    >
                      👤 {lang === "vi" ? "Bạn bè" : "Friends"}
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      className="ch-account-menu-item"
                      aria-expanded={settingsExpanded}
                      onClick={() => setSettingsExpanded((v) => !v)}
                    >
                      ⚙️ {lang === "vi" ? "Cài đặt" : "Settings"}
                      <span aria-hidden="true" className="ch-caret">
                        {settingsExpanded ? "▾" : "▸"}
                      </span>
                    </button>
                    {settingsExpanded && (
                      <div className="ch-account-menu-settings">
                        <div
                          className="ch-lang"
                          role="group"
                          aria-label="Language / Ngôn ngữ"
                        >
                          <button
                            type="button"
                            className={lang === "en" ? "active" : ""}
                            onClick={() => setLang("en")}
                          >
                            EN
                          </button>
                          <button
                            type="button"
                            className={lang === "vi" ? "active" : ""}
                            onClick={() => setLang("vi")}
                          >
                            VI
                          </button>
                        </div>
                        <BoardStyleField lang={lang} />
                        <SettingsToggles lang={lang} />
                        <PushSettings lang={lang} />
                      </div>
                    )}
                    <button
                      type="button"
                      role="menuitem"
                      className="ch-account-menu-item"
                      onClick={() => {
                        setAccountMenuOpen(false);
                        signOut();
                      }}
                    >
                      🚪 {lang === "vi" ? "Đăng xuất" : "Sign out"}
                    </button>
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="ch-user" role="group" aria-label="Account">
              <button
                type="button"
                className="ch-account-btn"
                onClick={() => setAccountMenuOpen((v) => !v)}
                aria-haspopup="menu"
                aria-expanded={accountMenuOpen}
                title={lang === "vi" ? "Cài đặt" : "Settings"}
              >
                <span className="ch-account-avatar">⚙️</span>
              </button>
              {accountMenuOpen && (
                <>
                  <div
                    className="ch-menu-backdrop"
                    onClick={() => setAccountMenuOpen(false)}
                  />
                  <div className="ch-account-menu" role="menu">
                    <div className="ch-account-menu-settings">
                      <div
                        className="ch-lang"
                        role="group"
                        aria-label="Language / Ngôn ngữ"
                      >
                        <button
                          type="button"
                          className={lang === "en" ? "active" : ""}
                          onClick={() => setLang("en")}
                        >
                          EN
                        </button>
                        <button
                          type="button"
                          className={lang === "vi" ? "active" : ""}
                          onClick={() => setLang("vi")}
                        >
                          VI
                        </button>
                      </div>
                      <BoardStyleField lang={lang} />
                      <SettingsToggles lang={lang} />
                    </div>
                    <button
                      type="button"
                      role="menuitem"
                      className="ch-account-menu-item"
                      onClick={() => {
                        setAccountMenuOpen(false);
                        setAuthOpen("in");
                      }}
                    >
                      🔑 {s.authLogin}
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      className="ch-account-menu-item"
                      onClick={() => {
                        setAccountMenuOpen(false);
                        setAuthOpen("up");
                      }}
                    >
                      📝 {s.authSignup}
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </header>

      {menuOpen && (
        <div className="ch-drawer-root">
          <div
            className="ch-backdrop"
            onClick={() => setMenuOpen(false)}
            aria-hidden="true"
          />
          <aside className="ch-drawer" role="dialog" aria-label="Menu">
            <div className="ch-drawer-head">
              <strong>Menu</strong>
              <button
                type="button"
                className="ch-btn ch-btn-icon"
                onClick={() => setMenuOpen(false)}
                aria-label={lang === "vi" ? "Đóng" : "Close"}
              >
                ✕
              </button>
            </div>
            <div className="ch-drawer-body">
              <section>
                <h2>{lang === "vi" ? "Chế độ" : "Mode"}</h2>
                <div className="ch-drawer-modes" role="tablist" aria-label="Mode">
                  {NAV_ENTRIES.map((e) => (
                    <button
                      key={e.view}
                      type="button"
                      role="tab"
                      aria-selected={view === e.view}
                      data-active={view === e.view}
                      onClick={() => go(e.view)}
                    >
                      {e.icon ? `${e.icon} ` : ""}
                      {lang === "vi" ? e.vi : e.en}
                    </button>
                  ))}
                </div>
              </section>
              <section>
                <h2>{lang === "vi" ? "📖 Hướng dẫn" : "📖 Guides"}</h2>
                <div className="ch-drawer-modes">
                  <a href="/blog" className="ch-blog-drawer-link">
                    {lang === "vi" ? "📖 Hướng dẫn" : "📖 Guides"}
                  </a>
                </div>
              </section>
              {installPrompt && (
                <section>
                  <div className="ch-drawer-modes">
                    <button
                      type="button"
                      className="ch-btn ch-btn-primary"
                      onClick={onInstallClick}
                    >
                      {lang === "vi" ? "📲 Cài ứng dụng" : "📲 Install app"}
                    </button>
                  </div>
                </section>
              )}
              {view === "play" && (
                <section>
                  <h2>{lang === "vi" ? "Cài đặt" : "Settings"}</h2>
                  <label className="ch-field">
                    <span>{s.level}</span>
                    <select
                      value={level}
                      onChange={(e) => setLevel(Number(e.target.value))}
                      className="ch-select"
                    >
                      {LEVELS.map((l) => (
                        <option key={l.level} value={l.level}>
                          {s.levelLabel(l.level)} — {s.levelDesc[l.level - 1]}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="ch-field">
                    <span>{s.youPlay}</span>
                    <select
                      value={playerColor}
                      onChange={(e) => {
                        setPlayerColor(e.target.value as Color);
                        setConfigNonce((n) => n + 1);
                      }}
                      className="ch-select"
                    >
                      <option value="white">{s.whiteFirst}</option>
                      <option value="black">{s.blackSecond}</option>
                    </select>
                  </label>
                  <label className="ch-field">
                    <span>{s.timeControl}</span>
                    <select
                      value={tcMs === "none" ? "none" : String(tcMs)}
                      onChange={(e) => {
                        setTcMs(
                          e.target.value === "none"
                            ? "none"
                            : Number(e.target.value)
                        );
                        setConfigNonce((n) => n + 1);
                      }}
                      className="ch-select"
                    >
                      <option value="none">{s.noTimeControl}</option>
                      <option value={60000}>{s.minutes(1)}</option>
                      <option value={180000}>{s.minutes(3)}</option>
                      <option value={300000}>{s.minutes(5)}</option>
                      <option value={600000}>{s.minutes(10)}</option>
                    </select>
                  </label>
                </section>
              )}
            </div>
          </aside>
        </div>
      )}

      {view === "play" && (
        <ChessGame
          onGameEnd={handleGameEnd}
          lang={lang}
          level={level}
          onLevelChange={setLevel}
          playerColor={playerColor}
          onPlayerColorChange={setPlayerColor}
          tcMs={tcMs}
          onTcChange={setTcMs}
          configNonce={configNonce}
          customStart={customStart}
          onCustomStartConsumed={handleCustomStartConsumed}
        />
      )}
      {view !== "play" && view !== "history" && view !== "puzzle" && view !== "setup" && view !== "library" && (
        <div className="ch-scroll-area">
          {view === "checkin" && <CheckinView lang={lang} />}
          {view === "ranks" && <LeaderboardView lang={lang} />}
          {view === "rooms" && (
            <RoomView
              lang={lang}
              initialRoomId={pendingRoomId}
              onInitialConsumed={() => setPendingRoomId(null)}
              initialRoomCode={deepLinkRoomCode}
              onRoomCodeConsumed={() => setDeepLinkRoomCode(null)}
              onRequireLogin={() => setAuthOpen("in")}
            />
          )}
          {view === "friends" && (
            <FriendsView
              lang={lang}
              highlightChallengeId={deepLinkChallengeId}
              onHighlightConsumed={() => setDeepLinkChallengeId(null)}
              onOpenRoom={(id) => {
                setPendingRoomId(id);
                setView("rooms");
              }}
              onWatchRoom={(code) => {
                setDeepLinkRoomCode(code);
                setView("rooms");
              }}
            />
          )}
          {view === "quests" && <QuestsView lang={lang} />}
          {view === "notifications" && (
            <NotificationsView lang={lang} onChanged={refreshUnread} />
          )}
          {view === "corr" && (
            <CorrView
              lang={lang}
              initialGameId={deepLinkCorrId}
              onInitialConsumed={() => setDeepLinkCorrId(null)}
            />
          )}
        </div>
      )}
      {/* History, puzzle, setup, and library own their roots: their boards
          use the full play layout so they render at the same size as the
          play board. */}
      {view === "history" && <HistoryView lang={lang} />}
      {view === "puzzle" && <PuzzleView lang={lang} />}
      {view === "setup" && (
        <SetupView
          lang={lang}
          onPlay={handleCustomPlay}
          level={level}
          onLevelChange={setLevel}
        />
      )}
      {view === "library" && <LibraryView lang={lang} />}
      {authOpen && (
        <AuthModal
          lang={lang}
          initialMode={authOpen}
          onClose={() => setAuthOpen(null)}
        />
      )}
      {profileOpen && (
        <ProfileModal lang={lang} onClose={() => setProfileOpen(false)} />
      )}
      {welcomeMsg && <div className="ch-toast">{welcomeMsg}</div>}      {declinedToast && <div className="ch-toast">{declinedToast}</div>}
      {incomingChallenge && (
        <div className="ch-modal-root" role="dialog" aria-modal="true">
          <div className="ch-modal">
            <h3>
              ⚔️{" "}
              {lang === "vi"
                ? `${incomingChallenge.challenger_name} thách đấu bạn!`
                : `${incomingChallenge.challenger_name} challenges you!`}
            </h3>
            <div className="ch-modal-actions">
              <button
                type="button"
                className="ch-btn ch-btn-primary"
                onClick={() => doAcceptChallenge(incomingChallenge)}
              >
                ⚔️ {lang === "vi" ? "Nhận" : "Accept"}
              </button>
              <button
                type="button"
                className="ch-btn"
                onClick={() => doDeclineChallenge(incomingChallenge)}
              >
                {lang === "vi" ? "Từ chối" : "Decline"}
              </button>
            </div>
          </div>
        </div>
      )}
      <footer className="ch-footer">
        {lang === "vi"
          ? "Bản quyền thuộc về SynerWork Inc. Mọi quyền được bảo lưu."
          : "Copyright by SynerWork Inc. All rights reserved."}
      </footer>
    </div>
  );
}
