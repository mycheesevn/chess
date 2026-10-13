"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Board } from "./Board";
import { useAuth } from "./AuthProvider";
import {
  applyMove,
  gameStatus,
  initialBoard,
  INITIAL_CASTLING,
  legalMovesForSquare,
} from "@/lib/chess/engine";
import { uciToMove } from "@/lib/chess/uci";
import {
  dailyPuzzle,
  puzzleDateStr,
  type ChessPuzzle,
} from "@/lib/chess/puzzles";
import { renderShareCard, shareCard } from "@/lib/chess/shareCard";
import { alreadySolved, recordPuzzleSolve } from "@/lib/supabase/puzzles";
import {
  Board as BoardT,
  CastlingRights,
  Color,
  Lang,
  Move,
  PieceType,
  opposite,
} from "@/lib/chess/types";

const STREAK_KEY = "chess-puzzle-streak";
const SOLVED_KEY = "chess-puzzle-solved";

interface Streak {
  date: string;
  count: number;
}

function loadStreak(): Streak {
  try {
    const raw = localStorage.getItem(STREAK_KEY);
    if (raw) {
      const s = JSON.parse(raw) as Streak;
      if (typeof s.count === "number" && typeof s.date === "string") return s;
    }
  } catch {
    /* ignore */
  }
  return { date: "", count: 0 };
}

function replaySetup(puzzle: ChessPuzzle): {
  board: BoardT;
  castling: CastlingRights;
  ep: { x: number; y: number } | null;
} {
  let board = initialBoard();
  let castling = { ...INITIAL_CASTLING };
  let ep: { x: number; y: number } | null = null;
  for (const uci of puzzle.setup) {
    const r = applyMove(board, uciToMove(uci), castling, ep);
    board = r.board;
    castling = r.castling;
    ep = r.ep;
  }
  return { board, castling, ep };
}

const PROMO_CHOICES: PieceType[] = ["Q", "R", "B", "N"];

export function PuzzleView({ lang }: { lang: Lang }) {
  const { user, refreshProfile } = useAuth();
  const [puzzle] = useState<ChessPuzzle>(() => dailyPuzzle());
  const [dateStr] = useState(() => puzzleDateStr());
  const [pos, setPos] = useState(() => replaySetup(puzzle));
  const [selected, setSelected] = useState<{ x: number; y: number } | null>(null);
  const [pendingPromo, setPendingPromo] = useState<Move | null>(null);
  const [lastMove, setLastMove] = useState<Move | null>(null);
  const [solved, setSolved] = useState(false);
  const [alreadyDone, setAlreadyDone] = useState(false);
  const [failMsg, setFailMsg] = useState(false);
  const [streak, setStreak] = useState<Streak>({ date: "", count: 0 });
  const [msg, setMsg] = useState("");
  const [sharing, setSharing] = useState(false);

  const turn: Color = puzzle.turn;

  // Load streak + solved state
  useEffect(() => {
    setStreak(loadStreak());
    let cancelled = false;
    (async () => {
      try {
        if (user) {
          if (await alreadySolved(dateStr)) {
            if (!cancelled) {
              setSolved(true);
              setAlreadyDone(true);
            }
            return;
          }
        } else {
          try {
            if (localStorage.getItem(SOLVED_KEY) === dateStr) {
              if (!cancelled) {
                setSolved(true);
                setAlreadyDone(true);
              }
              return;
            }
          } catch {
            /* ignore */
          }
        }
      } catch {
        /* offline — allow attempt anyway */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user, dateStr]);

  const resetBoard = useCallback(() => {
    setPos(replaySetup(puzzle));
    setSelected(null);
    setPendingPromo(null);
    setLastMove(null);
  }, [puzzle]);

  const bumpStreak = useCallback(() => {
    setStreak((prev) => {
      const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
      const next: Streak =
        prev.date === dateStr
          ? prev
          : prev.date === yesterday
            ? { date: dateStr, count: prev.count + 1 }
            : { date: dateStr, count: 1 };
      try {
        localStorage.setItem(STREAK_KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  }, [dateStr]);

  const onSolved = useCallback(async () => {
    setSolved(true);
    bumpStreak();
    try {
      localStorage.setItem(SOLVED_KEY, dateStr);
    } catch {
      /* ignore */
    }
    if (user) {
      try {
        const newly = await recordPuzzleSolve(dateStr);
        setMsg(
          newly
            ? lang === "vi"
              ? "+15 XP! 🎉"
              : "+15 XP! 🎉"
            : lang === "vi"
              ? "Đã giải hôm nay rồi ✓"
              : "Already solved today ✓"
        );
        await refreshProfile();
      } catch {
        /* offline */
      }
    } else {
      setMsg(
        lang === "vi"
          ? "Đăng nhập để nhận XP cho mỗi câu đố!"
          : "Sign in to earn XP for puzzles!"
      );
    }
  }, [user, dateStr, lang, bumpStreak, refreshProfile]);

  const tryMove = useCallback(
    (move: Move) => {
      const r = applyMove(pos.board, move, pos.castling, pos.ep);
      const nextTurn = opposite(turn);
      const piece = pos.board[move.fromY][move.fromX];
      const captured = pos.board[move.toY][move.toX];
      const hm = piece && (piece.type === "P" || captured) ? 0 : 1;
      const gs = gameStatus(r.board, nextTurn, r.castling, r.ep, hm);
      setLastMove(move);
      if (gs.over && gs.kind === "checkmate" && gs.winner === turn) {
        setPos({ board: r.board, castling: r.castling, ep: r.ep });
        setSelected(null);
        setPendingPromo(null);
        onSolved();
      } else {
        // Wrong move: gentle fail, reset the board
        setFailMsg(true);
        window.setTimeout(() => {
          setFailMsg(false);
          resetBoard();
        }, 900);
      }
    },
    [pos, turn, onSolved, resetBoard]
  );

  const targets = useMemo(
    () =>
      selected && !solved
        ? legalMovesForSquare(
            pos.board,
            turn,
            selected.x,
            selected.y,
            pos.castling,
            pos.ep
          )
        : [],
    [selected, solved, pos, turn]
  );

  const onSquareClick = useCallback(
    (x: number, y: number) => {
      if (solved || pendingPromo) return;
      const hit = targets.find((t) => t.toX === x && t.toY === y);
      if (hit) {
        const piece = pos.board[hit.fromY][hit.fromX];
        const promoRank = piece?.color === "white" ? 0 : 7;
        if (piece?.type === "P" && y === promoRank) {
          setPendingPromo(hit);
          return;
        }
        tryMove(hit);
        return;
      }
      const piece = pos.board[y][x];
      setSelected(piece && piece.color === turn ? { x, y } : null);
    },
    [solved, pendingPromo, targets, pos, turn, tryMove]
  );

  const doShare = useCallback(async () => {
    setSharing(true);
    try {
      const headline =
        lang === "vi"
          ? `🧩 Giải được câu đố hôm nay! (chuỗi ${streak.count})`
          : `🧩 Solved today's puzzle! (${streak.count} streak)`;
      const blob = await renderShareCard({
        board: pos.board,
        playerColor: turn,
        headline,
        subline: lang === "vi" ? "Cờ vua · Câu đố hằng ngày" : "Chess · Daily puzzle",
        appName: "Chess",
        appUrl: window.location.origin,
      });
      await shareCard(blob, headline, headline, window.location.origin);
    } catch {
      /* share cancelled */
    } finally {
      setSharing(false);
    }
  }, [lang, streak, pos, turn]);

  return (
    <div className="ch-view">
      <h2>
        🧩 {lang === "vi" ? "Câu đố hằng ngày" : "Daily puzzle"}
      </h2>
      <p className="ch-puzzle-title">
        {lang === "vi" ? puzzle.titleVi : puzzle.titleEn}
      </p>
      {streak.count > 0 && (
        <p className="ch-streak">
          🔥 {streak.count} {lang === "vi" ? "ngày liên tiếp" : "day streak"}
        </p>
      )}

      <div className="ch-board-area">
        <div className="ch-board-fit">
          <Board
            board={pos.board}
            flipped={turn === "black"}
            selected={selected}
            targets={targets}
            lastMove={lastMove}
            checkAt={null}
            checkKey={0}
            checkBadge=""
            fight={null}
            interactive={!solved && !pendingPromo}
            boardLabel={lang === "vi" ? puzzle.titleVi : puzzle.titleEn}
            onSquareClick={onSquareClick}
          />
          {pendingPromo && (
            <div className="ch-promo-overlay">
              <div className="ch-promo-dialog">
                <div className="ch-promo-choices">
                  {PROMO_CHOICES.map((pt) => (
                    <button key={pt} type="button" onClick={() => tryMove({ ...pendingPromo, promotion: pt })}>
                      {pt}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {failMsg && (
        <p className="ch-puzzle-fail">
          {lang === "vi" ? "Chưa đúng — thử lại nhé!" : "Not quite — try again!"}
        </p>
      )}

      {solved && (
        <div className="ch-puzzle-solved">
          <p className="ch-puzzle-win">
            {alreadyDone
              ? lang === "vi"
                ? "✓ Đã giải câu đố hôm nay"
                : "✓ Solved today's puzzle"
              : lang === "vi"
                ? "🎉 Chính xác! Chiếu hết!"
                : "🎉 Correct! Checkmate!"}
          </p>
          {msg && <p className="ch-msg">{msg}</p>}
          <button
            type="button"
            className="ch-btn ch-btn-primary"
            disabled={sharing}
            onClick={doShare}
          >
            📤 {lang === "vi" ? "Khoe" : "Share"}
          </button>
        </div>
      )}

      {!user && !solved && (
        <p className="ch-hint">
          {lang === "vi"
            ? "Khách vẫn giải được — đăng nhập để nhận +15 XP."
            : "Guests can play too — sign in to earn +15 XP."}
        </p>
      )}
    </div>
  );
}
