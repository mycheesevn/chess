"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Board, type FightAnim } from "./Board";
import { VectorPiece } from "./Pieces";
import { MatchSocial } from "./MatchSocial";
import { sendReaction, subscribeReactions } from "@/lib/supabase/comments";
import { notifyPushTrigger } from "@/lib/push/client";
import {
  applyMove,
  gameStatus,
  initialBoard,
  INITIAL_CASTLING,
  inCheck,
  legalMovesForSquare,
} from "@/lib/chess/engine";
import { toSAN } from "@/lib/chess/notation";
import { STR } from "@/lib/chess/i18n";
import { moveToUci, uciToMove } from "@/lib/chess/uci";
import {
  cancelMatch,
  fetchNames,
  finishRoomMatch,
  getActiveMatch,
  getMatchById,
  pushMove,
  roomErrorKey,
  startRematch,
  subscribeMatch,
  subscribeRoomMatches,
  type RoomMatch,
  type XpEarned,
} from "@/lib/supabase/rooms";
import { useAuth } from "./AuthProvider";
import { burstConfetti } from "@/lib/chess/confetti";
import {
  playApplause,
  playCapture,
  playCheck,
  playCheckmateFanfare,
  playLose,
  playMove,
  playSadTrombone,
  playSelect,
  playWin,
} from "@/lib/chess/sound";
import type {
  Board as BoardT,
  CastlingRights,
  Color,
  Lang,
  Move,
  Piece,
  PieceType,
} from "@/lib/chess/types";
import { opposite } from "@/lib/chess/types";

const PROMO_CHOICES: PieceType[] = ["Q", "R", "B", "N"];

interface BoardState {
  board: BoardT;
  turn: Color;
  castling: CastlingRights;
  ep: { x: number; y: number } | null;
  halfmove: number;
  lastMove: Move | null;
}

function emptyState(): BoardState {
  return {
    board: initialBoard(),
    castling: { ...INITIAL_CASTLING },
    ep: null,
    turn: "white",
    halfmove: 0,
    lastMove: null,
  };
}

function stepState(st: BoardState, m: Move): BoardState {
  const piece = st.board[m.fromY][m.fromX];
  const captured =
    st.board[m.toY][m.toX] ||
    (piece?.type === "P" && st.ep && m.toX === st.ep.x && m.toY === st.ep.y
      ? st.board[m.fromY][m.toX]
      : null);
  const r = applyMove(st.board, m, st.castling, st.ep);
  return {
    board: r.board,
    castling: r.castling,
    ep: r.ep,
    turn: opposite(st.turn),
    halfmove: piece?.type === "P" || captured ? 0 : st.halfmove + 1,
    lastMove: m,
  };
}

/** Replay UCI moves → final state + SAN list (with +/# suffixes). */
function replay(movesStr: string, lang: Lang): { state: BoardState; sans: string[] } {
  let st = emptyState();
  const sans: string[] = [];
  const ucis = movesStr.trim().split(/\s+/).filter(Boolean);
  for (const uci of ucis) {
    const m = uciToMove(uci);
    const after = stepState(st, m);
    const gst = gameStatus(after.board, after.turn, after.castling, after.ep, after.halfmove);
    const suffix =
      gst.over && gst.kind === "checkmate"
        ? "#"
        : inCheck(after.board, after.turn)
          ? "+"
          : "";
    sans.push(toSAN(st.board, m, st.turn, st.castling, st.ep, lang, suffix));
    st = after;
  }
  return { state: st, sans };
}

export function reasonLabel(reason: string | null, lang: Lang): string {
  const map: Record<string, [string, string]> = {
    checkmate: ["Chiếu hết", "Checkmate"],
    stalemate: ["Hết nước đi", "Stalemate"],
    resign: ["Đầu hàng", "Resignation"],
    cancelled: ["Đã hủy", "Cancelled"],
    "fifty-move": ["Luật 50 nước", "Fifty-move rule"],
    "insufficient-material": ["Không đủ quân chiếu hết", "Insufficient material"],
    repetition: ["Lặp lại 3 lần", "Threefold repetition"],
    draw: ["Hòa", "Draw"],
  };
  const pair = reason ? map[reason] : undefined;
  if (!pair) return "";
  return lang === "vi" ? pair[0] : pair[1];
}

export function RoomMatchView({
  roomId,
  matchId,
  lang,
  isLeader = false,
  guest = false,
  hideSocial = false,
  namesOverride,
  roomCode,
  onBackToRoom,
  onExitRoom,
  onViewMatch,
  onRequireLogin,
}: {
  roomId: string;
  matchId: string | null;
  lang: Lang;
  isLeader?: boolean;
  guest?: boolean;
  hideSocial?: boolean;
  namesOverride?: { white: string | null; black: string | null };
  /** Room invite code — appended to the share-result text (PacClone pattern). */
  roomCode?: string | null;
  onBackToRoom?: () => void;
  onExitRoom?: () => void;
  onViewMatch?: (matchId: string) => void;
  /** Guests: tapping the react teaser asks the host to open login. */
  onRequireLogin?: () => void;
}) {
  const s = STR[lang];
  const { user } = useAuth();
  const [match, setMatch] = useState<RoomMatch | null>(null);
  const [selected, setSelected] = useState<{ x: number; y: number } | null>(null);
  const [pendingPromo, setPendingPromo] = useState<Move | null>(null);
  const [viewerCount, setViewerCount] = useState(0);
  const [rematching, setRematching] = useState(false);
  const [actionMsg, setActionMsg] = useState("");
  const [xpEarned, setXpEarned] = useState<XpEarned | null>(null);
  const [fight, setFight] = useState<FightAnim | null>(null);
  const [names, setNames] = useState<{ white: string; black: string }>({
    white: "Player",
    black: "Player",
  });
  const [armResign, setArmResign] = useState(false);
  const [armCancel, setArmCancel] = useState(false);
  const [shared, setShared] = useState(false);
  const matchRef = useRef<RoomMatch | null>(null);
  matchRef.current = match;
  const finishedRef = useRef(false);
  const fightTimer = useRef<number | null>(null);
  const movesBoxRef = useRef<HTMLDivElement | null>(null);
  /** Checkmate drama: banner + big shake + gold flash, once per match (PacClone parity). */
  const [mateBannerKey, setMateBannerKey] = useState(0);
  const [mateFxKey, setMateFxKey] = useState(0);
  const [bigShakeKey, setBigShakeKey] = useState(0);
  const celebratedMateRef = useRef<string | null>(null);

  /* ------------------------------ reaction floaters ------------------------------ */
  /** Floating reaction emoji over the board (realtime, PacClone pattern):
   *  floaters render INSIDE the board container (.ch-board-fit), never in the
   *  aside/panel — otherwise they float below the board on mobile. */
  const [floaters, setFloaters] = useState<{ id: number; emoji: string; x: number }[]>([]);
  const floaterId = useRef(0);
  useEffect(() => {
    if (!match?.id) return;
    const ch = subscribeReactions(match.id, (emoji) => {
      const id = ++floaterId.current;
      const x = 8 + Math.random() * 76; // % across the board
      setFloaters((f) => [...f.slice(-11), { id, emoji, x }]);
      window.setTimeout(
        () => setFloaters((f) => f.filter((fl) => fl.id !== id)),
        2200
      );
    });
    return () => {
      ch.unsubscribe();
    };
  }, [match?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  /* The reaction bar itself lives in the actions row directly under the
   * board (PacClone anatomy) — NOT in the side panel. Sending is throttled;
   * the floater appears via the realtime echo above, for the sender too. */
  const REACTION_EMOJIS = ["👏", "🔥", "😱", "👍", "😮"];
  const lastReactRef = useRef(0);
  const doReact = async (emoji: string) => {
    if (!user || !match) return;
    const now = Date.now();
    if (now - lastReactRef.current < 1500) return; // throttle
    lastReactRef.current = now;
    try {
      await sendReaction(roomId, match.id, emoji);
    } catch {
      /* ignore */
    }
  };

  /* ------------------------------ loading ------------------------------ */
  useEffect(() => {
    let live = true;
    finishedRef.current = false;
    setXpEarned(null);
    setFight(null);
    const load = matchId ? getMatchById(matchId) : getActiveMatch(roomId);
    load.then((m) => {
      if (live) setMatch(m);
    });
    return () => {
      live = false;
    };
  }, [roomId, matchId]);

  useEffect(() => {
    if (!match) return;
    const ch = subscribeMatch(
      match.id,
      (m) => {
        const local = (matchRef.current?.moves ?? "").trim().split(/\s+/).filter(Boolean).length;
        const remote = (m.moves ?? "").trim().split(/\s+/).filter(Boolean).length;
        // Accept status changes even with equal moves (finish/cancel).
        if (remote >= local || m.status !== matchRef.current?.status) setMatch(m);
      },
      // Guests count as viewers too (PacClone pattern; identity falls back to "guest").
      { onPresence: setViewerCount, userId: user?.id }
    );
    return () => {
      ch.unsubscribe();
    };
  }, [match?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Switch to a newly created match in this room (e.g. a rematch).
  useEffect(() => {
    if (guest) return;
    const ch = subscribeRoomMatches(roomId, (m) => {
      if (m.status !== "active") return;
      const cur = matchRef.current;
      if (cur && cur.id === m.id) return;
      if (onViewMatch) {
        onViewMatch(m.id);
        return;
      }
      finishedRef.current = false;
      setSelected(null);
      setPendingPromo(null);
      setMatch(m);
    });
    return () => {
      ch.unsubscribe();
    };
  }, [roomId, guest, onViewMatch]);

  // Player display names.
  useEffect(() => {
    if (namesOverride) {
      setNames({
        white: namesOverride.white ?? "Player",
        black: namesOverride.black ?? "Player",
      });
      return;
    }
    if (!match?.white_id && !match?.black_id) return;
    fetchNames([match.white_id ?? "", match.black_id ?? ""]).then((map) => {
      setNames({
        white: (match.white_id && map[match.white_id]) || "Player",
        black: (match.black_id && map[match.black_id]) || "Player",
      });
    });
  }, [match?.white_id, match?.black_id, namesOverride]); // eslint-disable-line react-hooks/exhaustive-deps

  const { state: bs, sans } = useMemo(
    () => replay(match?.moves ?? "", lang),
    [match?.moves, lang]
  );
  const plyCount = sans.length;

  const myColor: Color | null = useMemo(() => {
    if (!user || !match) return null;
    if (match.white_id === user.id) return "white";
    if (match.black_id === user.id) return "black";
    return null; // spectator
  }, [user, match]);

  const status = useMemo(
    () => gameStatus(bs.board, bs.turn, bs.castling, bs.ep, bs.halfmove),
    [bs]
  );
  const isActive = match?.status === "active";
  const isFinished = match?.status === "finished";
  const isCancelled = match?.status === "cancelled";

  /* --------------- move sounds + glide animation --------------- */
  const soundedPly = useRef(0);
  useEffect(() => {
    if (!match) return;
    const ucis = (match.moves ?? "").trim().split(/\s+/).filter(Boolean);
    const n = ucis.length;
    if (n > soundedPly.current) {
      const prev = replay(ucis.slice(0, n - 1).join(" "), lang).state;
      const m = uciToMove(ucis[n - 1]);
      const piece: Piece | undefined = prev.board[m.fromY][m.fromX] ?? undefined;
      let captured: Piece | null = prev.board[m.toY][m.toX];
      if (!captured && piece?.type === "P" && prev.ep && m.toX === prev.ep.x && m.toY === prev.ep.y) {
        captured = prev.board[m.fromY][m.toX];
      }
      if (soundedPly.current > 0 || n === 1) {
        // Animate + sound only live moves, not the initial history load.
        if (piece) {
          const shown: Piece = m.promotion ? { type: m.promotion, color: piece.color } : piece;
          setFight({ id: n, move: m, piece: shown, captured });
          if (fightTimer.current) window.clearTimeout(fightTimer.current);
          fightTimer.current = window.setTimeout(() => setFight(null), captured ? 1050 : 620);
        }
        if (captured) playCapture();
        else playMove();
        if (inCheck(bs.board, bs.turn) && !status.over) playCheck();
      }
      soundedPly.current = n;
    } else if (n < soundedPly.current) {
      soundedPly.current = n; // new match — resync silently
    }
  }, [match?.moves, match?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    return () => {
      if (fightTimer.current) window.clearTimeout(fightTimer.current);
    };
  }, []);

  // Keep the move list pinned to the latest move.
  useEffect(() => {
    const el = movesBoxRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [plyCount]);

  /* ------------------------------ finishing ------------------------------ */
  const reportFinish = useCallback(
    async (result: "white" | "black" | "draw", reason: string) => {
      if (!match) return;
      try {
        const earned = await finishRoomMatch(match.id, result, reason);
        if (earned && earned.play_xp + earned.host_xp + earned.daily_xp > 0) {
          setXpEarned(earned);
        }
      } catch {
        /* realtime will still flip the row */
      }
      const fresh = await getMatchById(match.id);
      if (fresh) setMatch(fresh);
    },
    [match]
  );

  // Natural game over (checkmate/stalemate/…) — the mover's client
  // reports; the RPC is idempotent so both clients may call safely.
  useEffect(() => {
    if (!status.over || !match || match.status !== "active" || finishedRef.current) return;
    finishedRef.current = true;
    const result =
      status.kind === "checkmate"
        ? status.winner === "white"
          ? ("white" as const)
          : ("black" as const)
        : ("draw" as const);
    reportFinish(result, status.kind);
  }, [status, match, myColor, reportFinish]);

  // Checkmate drama: banner + big board shake + gold flash + crowd sounds.
  // Runs once per match for players and spectators alike (PacClone parity).
  useEffect(() => {
    if (
      match?.status !== "finished" ||
      match?.reason !== "checkmate" ||
      celebratedMateRef.current === match?.id
    ) {
      return;
    }
    celebratedMateRef.current = match.id;
    setBigShakeKey((k) => k + 1);
    setMateFxKey((k) => k + 1);
    setMateBannerKey((k) => k + 1);
    window.setTimeout(() => setMateFxKey(0), 1300);
    const iWon = match.winner_id === user?.id;
    if (iWon) {
      window.setTimeout(() => {
        playCheckmateFanfare();
        burstConfetti();
      }, 450);
      window.setTimeout(() => playApplause(), 1700);
    } else if (myColor) {
      window.setTimeout(() => playSadTrombone(), 450);
    } else {
      // Spectator: celebrate the winner with fanfare + applause.
      window.setTimeout(() => playCheckmateFanfare(), 450);
      window.setTimeout(() => playApplause(), 1700);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [match?.status, match?.reason, match?.id]);

  // Non-checkmate finishes: win/lose jingles for the players.
  useEffect(() => {
    if (match?.status === "finished" && myColor && match?.reason !== "checkmate") {
      if (match.winner_id === user?.id) playWin();
      else playLose();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [match?.status, match?.reason, match?.id]);

  const doMove = useCallback(
    async (move: Move) => {
      if (!match || match.status !== "active") return;
      const uci = moveToUci(move);
      const newMoves = ((match.moves ?? "").trim() + " " + uci).trim();
      setMatch({ ...match, moves: newMoves }); // optimistic
      try {
        await pushMove(match.id, newMoves);
        notifyPushTrigger({ kind: "turn", matchId: match.id });
      } catch {
        /* realtime will correct */
      }
      setSelected(null);
      setPendingPromo(null);
    },
    [match]
  );

  const doRematch = useCallback(async () => {
    if (!match || match.status === "active" || !myColor) return;
    setRematching(true);
    setActionMsg("");
    try {
      const m = await startRematch(roomId);
      if (onViewMatch) onViewMatch(m.id);
      // Otherwise the room INSERT subscription switches both players.
    } catch (e) {
      setActionMsg(
        roomErrorKey(e) === "match_in_progress"
          ? lang === "vi"
            ? "Đang có ván khác diễn ra."
            : "Another match is in progress."
          : lang === "vi"
            ? "Không thể bắt đầu ván mới."
            : "Could not start a rematch."
      );
    } finally {
      setRematching(false);
    }
  }, [match, myColor, roomId, lang, onViewMatch]);

  const doResign = useCallback(async () => {
    if (!match || !myColor || match.status !== "active") return;
    finishedRef.current = true;
    await reportFinish(myColor === "white" ? "black" : "white", "resign");
  }, [match, myColor, reportFinish]);

  const doCancel = useCallback(async () => {
    if (!match || match.status !== "active") return;
    try {
      await cancelMatch(match.id);
      const fresh = await getMatchById(match.id);
      if (fresh) setMatch(fresh);
    } catch {
      /* ignore */
    }
  }, [match]);

  const doShare = useCallback(async () => {
    if (!match) return;
    const winnerText = isCancelled
      ? lang === "vi"
        ? "Ván đã hủy"
        : "Match cancelled"
      : match.result === "draw"
        ? lang === "vi"
          ? "Hòa"
          : "Draw"
        : match.result === "white"
          ? `⚪ ${names.white} ${lang === "vi" ? "thắng" : "wins"}`
          : `⚫ ${names.black} ${lang === "vi" ? "thắng" : "wins"}`;
    const text = `♟ ${names.white} vs ${names.black} — ${winnerText}${
      match.reason ? ` (${reasonLabel(match.reason, lang)})` : ""
    } · ${plyCount} ${lang === "vi" ? "nước" : "plies"}${
      roomCode
        ? ` · ${lang === "vi" ? "Mã phòng" : "Room code"}: ${roomCode} — ${window.location.origin}/?room=${roomCode}`
        : ""
    }`;
    try {
      await navigator.clipboard.writeText(text);
      setShared(true);
      window.setTimeout(() => setShared(false), 2000);
    } catch {
      /* clipboard unavailable */
    }
  }, [match, names, isCancelled, plyCount, lang, roomCode]);

  /* ------------------------------ board input ------------------------------ */
  const targets = useMemo(
    () =>
      selected && myColor
        ? legalMovesForSquare(bs.board, bs.turn, selected.x, selected.y, bs.castling, bs.ep)
        : [],
    [selected, bs, myColor]
  );

  const onSquareClick = useCallback(
    (x: number, y: number) => {
      if (!myColor || bs.turn !== myColor || status.over || !match || match.status !== "active")
        return;
      if (pendingPromo) return;
      const hit = targets.find((t) => t.toX === x && t.toY === y);
      if (hit) {
        const piece = bs.board[hit.fromY][hit.fromX];
        const promoRank = piece?.color === "white" ? 0 : 7;
        if (piece?.type === "P" && y === promoRank) {
          setPendingPromo(hit);
          return;
        }
        doMove(hit);
        return;
      }
      const piece = bs.board[y][x];
      const own = piece && piece.color === myColor;
      setSelected(own ? { x, y } : null);
      if (own) playSelect();
    },
    [myColor, bs, status, match, targets, pendingPromo, doMove]
  );

  const checkAt = useMemo(() => {
    if (!inCheck(bs.board, bs.turn) || status.over) return null;
    for (let y = 0; y < 8; y++)
      for (let x = 0; x < 8; x++) {
        const p = bs.board[y][x];
        if (p && p.type === "K" && p.color === bs.turn) return { x, y };
      }
    return null;
  }, [bs, status]);

  if (!match) {
    return (
      <div className="ch-room-match">
        <p className="ch-hint">
          {lang === "vi" ? "Chưa có ván đấu nào." : "No match yet."}
        </p>
        {onBackToRoom && (
          <button type="button" className="ch-btn ch-btn-sm" onClick={onBackToRoom}>
            ← {lang === "vi" ? "Về phòng" : "Back to room"}
          </button>
        )}
      </div>
    );
  }

  const watchers = myColor ? Math.max(0, viewerCount - 2) : viewerCount;
  const xpTotal = xpEarned ? xpEarned.play_xp + xpEarned.host_xp + xpEarned.daily_xp : 0;
  const resultTitle = isCancelled
    ? lang === "vi"
      ? "Ván đấu đã bị hủy"
      : "Match cancelled"
    : match.result === "white"
      ? `⚪ ${names.white} ${lang === "vi" ? "thắng!" : "wins!"}`
      : match.result === "black"
        ? `⚫ ${names.black} ${lang === "vi" ? "thắng!" : "wins!"}`
        : lang === "vi"
          ? "Hòa!"
          : "Draw!";

  return (
    <div className="ch-room-match">
      <div className="ch-room-match-main">
        <div className="ch-room-board-col">
        <div className="ch-board-area">
          <div
            key={`room-board-${bigShakeKey}`}
            className={`ch-board-fit${bigShakeKey > 0 ? " shake-big" : ""}`}
          >
            <Board
              board={bs.board}
              flipped={myColor === "black"}
              selected={selected}
              targets={targets}
              lastMove={bs.lastMove}
              checkAt={checkAt}
              checkKey={plyCount}
              checkBadge={s.checkBadge}
              fight={fight}
              interactive={!!myColor && bs.turn === myColor && !status.over && isActive}
              boardLabel={`${names.white} vs ${names.black}`}
              onSquareClick={onSquareClick}
            />
            {mateBannerKey > 0 && (
              <div
                key={mateBannerKey}
                className="ch-mate-banner"
                onAnimationEnd={() => setMateBannerKey(0)}
              >
                <span>♚ {lang === "vi" ? "Chiếu hết!" : "Checkmate!"}</span>
              </div>
            )}
            {mateFxKey > 0 && <div key={mateFxKey} className="ch-mate-flash" />}
            {floaters.map((f) => (
              <span
                key={f.id}
                className="ch-reaction-float"
                style={{ left: `${f.x}%` }}
                aria-hidden="true"
              >
                {f.emoji}
              </span>
            ))}
            {pendingPromo && (
              <div className="ch-promo-overlay">
                <div className="ch-promo-dialog">
                  <div className="ch-promo-choices">
                    {PROMO_CHOICES.map((pt) => (
                      <button
                        key={pt}
                        type="button"
                        onClick={() => doMove({ ...pendingPromo, promotion: pt })}
                      >
                        <svg viewBox="0 0 100 100" className="ch-promo-piece" aria-hidden="true">
                          <VectorPiece type={pt} color={myColor ?? "white"} />
                        </svg>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
        {isActive && !status.over && (
          <div className="ch-room-match-actions">
            {user && !guest && (
              <div
                className="ch-reaction-bar"
                role="group"
                aria-label={lang === "vi" ? "Thả biểu tượng" : "React"}
              >
                {REACTION_EMOJIS.map((e) => (
                  <button
                    key={e}
                    type="button"
                    className="ch-reaction-btn"
                    onClick={() => doReact(e)}
                  >
                    {e}
                  </button>
                ))}
              </div>
            )}
            {guest && onRequireLogin && (
              <button type="button" className="ch-btn ch-btn-sm" onClick={onRequireLogin}>
                👏🔥 {lang === "vi" ? "Đăng nhập để thả biểu tượng" : "Log in to react"}
              </button>
            )}
            {myColor &&
              (armResign ? (
                <button
                  type="button"
                  className="ch-btn ch-btn-sm ch-btn-danger"
                  onClick={() => {
                    setArmResign(false);
                    doResign();
                  }}
                >
                  {lang === "vi" ? "Xác nhận đầu hàng?" : "Confirm resignation?"}
                </button>
              ) : (
                <button
                  type="button"
                  className="ch-btn ch-btn-sm"
                  onClick={() => {
                    setArmResign(true);
                    window.setTimeout(() => setArmResign(false), 3000);
                  }}
                >
                  🏳 {lang === "vi" ? "Đầu hàng" : "Resign"}
                </button>
              ))}
            {isLeader &&
              (armCancel ? (
                <button
                  type="button"
                  className="ch-btn ch-btn-sm ch-btn-danger"
                  onClick={() => {
                    setArmCancel(false);
                    doCancel();
                  }}
                >
                  {lang === "vi" ? "Xác nhận hủy ván?" : "Confirm cancel?"}
                </button>
              ) : (
                <button
                  type="button"
                  className="ch-btn ch-btn-sm"
                  onClick={() => {
                    setArmCancel(true);
                    window.setTimeout(() => setArmCancel(false), 3000);
                  }}
                >
                  ✕ {lang === "vi" ? "Hủy ván" : "Cancel match"}
                </button>
              ))}
          </div>
        )}
        </div>
        <aside className="ch-panel ch-room-side">
          {onExitRoom && (
            <button type="button" className="ch-btn ch-btn-sm ch-room-exit" onClick={onExitRoom}>
              ← {lang === "vi" ? "Danh sách phòng" : "Room list"}
            </button>
          )}
          {onBackToRoom && !isFinished && !isCancelled && (
            <button type="button" className="ch-btn ch-btn-sm" onClick={onBackToRoom}>
              ← {lang === "vi" ? "Về phòng" : "Back to room"}
            </button>
          )}
      <div className="ch-room-vs">
        <span>⚪ {names.white}</span>
        <span className="ch-room-vs-mid">vs</span>
        <span>⚫ {names.black}</span>
      </div>
      <div className="ch-room-status">
        {isFinished || isCancelled ? (
          <span>
            {resultTitle}
            {match.reason && !isCancelled ? ` · ${reasonLabel(match.reason, lang)}` : ""}
          </span>
        ) : status.over ? (
          <span>{lang === "vi" ? "Đang chốt kết quả…" : "Finalizing…"}</span>
        ) : (
          <span>
            {bs.turn === "white" ? `⚪ ${names.white}` : `⚫ ${names.black}`}
            {lang === "vi" ? " đi" : " to move"}
            {myColor === bs.turn && (lang === "vi" ? " (bạn)" : " (you)")}
            {myColor === null && (lang === "vi" ? " · khán giả" : " · spectating")}
          </span>
        )}
        {watchers > 0 && (
          <span className="ch-viewers" title={lang === "vi" ? "Đang xem" : "Watching"}>
            👁 {watchers}
          </span>
        )}
      </div>

      {(isFinished || isCancelled) && (
        <div className="ch-result-panel">
          {isFinished && (
            <p className="ch-result-title">
              {match.result === "draw"
                ? lang === "vi"
                  ? "🤝 Hòa!"
                  : "🤝 Draw!"
                : `🏆 ${match.result === "white" ? names.white : names.black} ${
                    lang === "vi" ? "thắng!" : "wins!"
                  }`}
              {match.reason && !isCancelled ? ` · ${reasonLabel(match.reason, lang)}` : ""}
            </p>
          )}
          {isCancelled && (
            <p className="ch-result-title">
              {lang === "vi" ? "Ván đấu đã bị hủy." : "This match was cancelled."}
            </p>
          )}
          {xpTotal > 0 && (
            <p className="ch-xp-earned">
              ⭐ {lang === "vi" ? `Bạn nhận +${xpTotal} XP` : `You earned +${xpTotal} XP`}
            </p>
          )}
          <div className="ch-row-gap">
            {myColor && !isCancelled && (
              <button
                type="button"
                className="ch-btn ch-btn-primary ch-btn-sm"
                disabled={rematching}
                onClick={doRematch}
              >
                🔁 {lang === "vi" ? "Đấu lại" : "Rematch"}
              </button>
            )}
            <button type="button" className="ch-btn ch-btn-sm" onClick={doShare}>
              {shared
                ? lang === "vi"
                  ? "Đã chép kết quả!"
                  : "Result copied!"
                : `📤 ${lang === "vi" ? "Chia sẻ" : "Share"}`}
            </button>
            {onBackToRoom && (
              <button type="button" className="ch-btn ch-btn-sm" onClick={onBackToRoom}>
                ← {lang === "vi" ? "Về phòng" : "Back to room"}
              </button>
            )}
          </div>
          {actionMsg && <p className="ch-msg">{actionMsg}</p>}
        </div>
      )}

      {sans.length > 0 && (
        <div className="ch-room-moves" ref={movesBoxRef}>
          {Array.from({ length: Math.ceil(sans.length / 2) }, (_, i) => (
            <div key={i} className="ch-room-move-row">
              <span className="ch-room-move-num">{i + 1}.</span>
              <span>{sans[i * 2]}</span>
              <span>{sans[i * 2 + 1] ?? ""}</span>
            </div>
          ))}
        </div>
      )}

      {!hideSocial && (
        <MatchSocial
          roomId={roomId}
          matchId={match.id}
          lang={lang}
          moveNumber={plyCount}
          disabled={isCancelled}
        />
      )}
        </aside>
      </div>
    </div>
  );
}
