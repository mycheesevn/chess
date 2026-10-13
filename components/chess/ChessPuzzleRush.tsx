"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Board } from "./Board";
import {
  applyMove,
  gameStatus,
  initialBoard,
  INITIAL_CASTLING,
  legalMovesForSquare,
} from "@/lib/chess/engine";
import { uciToMove } from "@/lib/chess/uci";
import { PUZZLES, type ChessPuzzle } from "@/lib/chess/puzzles";
import { renderShareCard, shareCard } from "@/lib/chess/shareCard";
import {
  Board as BoardT,
  CastlingRights,
  Color,
  Lang,
  Move,
  PieceType,
  opposite,
} from "@/lib/chess/types";

const RUSH_TIME = 180; // 3 minutes
const RUSH_LIVES = 3;
const BEST_KEY = "chess-rush-best";

const PROMO_CHOICES: PieceType[] = ["Q", "R", "B", "N"];

interface Pos {
  board: BoardT;
  castling: CastlingRights;
  ep: { x: number; y: number } | null;
}

function shuffled<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function replaySetup(puzzle: ChessPuzzle): Pos {
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

function loadBest(): number {
  try {
    return Number(localStorage.getItem(BEST_KEY) || 0) || 0;
  } catch {
    return 0;
  }
}

function fmtTime(s: number): string {
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
}

export function ChessPuzzleRush({
  lang,
  onExit,
}: {
  lang: Lang;
  onExit: () => void;
}) {
  const [queue, setQueue] = useState<ChessPuzzle[]>(() => shuffled(PUZZLES));
  const [qi, setQi] = useState(0);
  const puzzle = queue[qi % queue.length];
  const [pos, setPos] = useState<Pos>(() => replaySetup(puzzle));
  const [selected, setSelected] = useState<{ x: number; y: number } | null>(null);
  const [pendingPromo, setPendingPromo] = useState<Move | null>(null);
  const [lastMove, setLastMove] = useState<Move | null>(null);
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(RUSH_LIVES);
  const [timeLeft, setTimeLeft] = useState(RUSH_TIME);
  const [phase, setPhase] = useState<"playing" | "over">("playing");
  const [best, setBest] = useState(loadBest);
  const [newBest, setNewBest] = useState(false);
  const [failFlash, setFailFlash] = useState(false);
  const [sharing, setSharing] = useState(false);
  const turn: Color = puzzle.turn;

  // Countdown.
  useEffect(() => {
    if (phase === "over") return;
    if (timeLeft <= 0) {
      setPhase("over");
      return;
    }
    const t = window.setTimeout(() => setTimeLeft((x) => x - 1), 1000);
    return () => window.clearTimeout(t);
  }, [timeLeft, phase]);

  // Game over: record best (once).
  useEffect(() => {
    if (phase !== "over") return;
    if (score > best) {
      setBest(score);
      setNewBest(true);
      try {
        localStorage.setItem(BEST_KEY, String(score));
      } catch {
        /* ignore */
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  const resetPuzzle = useCallback((p: ChessPuzzle) => {
    setPos(replaySetup(p));
    setSelected(null);
    setPendingPromo(null);
    setLastMove(null);
    setFailFlash(false);
  }, []);

  const nextPuzzle = useCallback(() => {
    const nq = qi + 1;
    setQi(nq);
    resetPuzzle(queue[nq % queue.length]);
  }, [qi, queue, resetPuzzle]);

  const restart = useCallback(() => {
    const q = shuffled(PUZZLES);
    setQueue(q);
    setQi(0);
    setScore(0);
    setLives(RUSH_LIVES);
    setTimeLeft(RUSH_TIME);
    setPhase("playing");
    setNewBest(false);
    resetPuzzle(q[0]);
  }, [resetPuzzle]);

  const tryMove = useCallback(
    (move: Move) => {
      if (phase === "over") return;
      const r = applyMove(pos.board, move, pos.castling, pos.ep);
      const nextTurn = opposite(turn);
      const piece = pos.board[move.fromY][move.fromX];
      const captured = pos.board[move.toY][move.toX];
      const hm = piece && (piece.type === "P" || captured) ? 0 : 1;
      const gs = gameStatus(r.board, nextTurn, r.castling, r.ep, hm);
      setLastMove(move);
      if (gs.over && gs.kind === "checkmate" && gs.winner === turn) {
        // Solved: +1 point, next puzzle.
        setScore((x) => x + 1);
        nextPuzzle();
      } else {
        // Wrong move: lose a life, reset the board.
        setFailFlash(true);
        setLives((l) => {
          const nl = l - 1;
          if (nl <= 0) {
            window.setTimeout(() => setPhase("over"), 600);
          } else {
            window.setTimeout(() => resetPuzzle(puzzle), 700);
          }
          return nl;
        });
      }
    },
    [pos, turn, phase, nextPuzzle, resetPuzzle, puzzle]
  );

  const targets = useMemo(
    () =>
      selected && phase === "playing"
        ? legalMovesForSquare(
            pos.board,
            turn,
            selected.x,
            selected.y,
            pos.castling,
            pos.ep
          )
        : [],
    [selected, phase, pos, turn]
  );

  const onSquareClick = useCallback(
    (x: number, y: number) => {
      if (phase === "over" || pendingPromo) return;
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
    [phase, pendingPromo, targets, pos, turn, tryMove]
  );

  const doShare = useCallback(async () => {
    setSharing(true);
    try {
      const headline =
        lang === "vi"
          ? `⚡ Puzzle Rush: ${score} điểm!${newBest ? " (kỷ lục mới!)" : ""}`
          : `⚡ Puzzle Rush: ${score} pts!${newBest ? " (new best!)" : ""}`;
      const blob = await renderShareCard({
        board: pos.board,
        playerColor: turn,
        headline,
        subline: lang === "vi" ? "Cờ vua · Puzzle Rush" : "Chess · Puzzle Rush",
        appName: "Chess",
        appUrl: window.location.origin,
      });
      await shareCard(blob, headline, headline, window.location.origin);
    } catch {
      /* share cancelled */
    } finally {
      setSharing(false);
    }
  }, [lang, score, newBest, pos, turn]);

  if (phase === "over") {
    return (
      <div className="ch-view">
        <h2>
          ⚡ {lang === "vi" ? "Puzzle Rush — Hết giờ!" : "Puzzle Rush — Time's up!"}
        </h2>
        <p className="ch-rush-score">
          {lang === "vi" ? "Điểm:" : "Score:"} <strong>{score}</strong>
          {newBest && (
            <span className="ch-rush-newbest">
              {" "}
              🎉 {lang === "vi" ? "Kỷ lục mới!" : "New best!"}
            </span>
          )}
        </p>
        <p className="ch-hint">
          {lang === "vi" ? "Kỷ lục:" : "Best:"} {best}
        </p>
        <div className="ch-rush-actions">
          <button
            type="button"
            className="ch-btn ch-btn-primary"
            disabled={sharing}
            onClick={doShare}
          >
            📤 {lang === "vi" ? "Khoe" : "Share"}
          </button>
          <button type="button" className="ch-btn" onClick={restart}>
            {lang === "vi" ? "Chơi lại" : "Play again"}
          </button>
          <button type="button" className="ch-btn" onClick={onExit}>
            ← {lang === "vi" ? "Câu đố hằng ngày" : "Daily puzzle"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="ch-page">
      <div className="ch-layout">
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
            interactive={!pendingPromo}
            boardLabel=""
            onSquareClick={onSquareClick}
          />
          {pendingPromo && (
            <div className="ch-promo-overlay">
              <div className="ch-promo-dialog">
                <div className="ch-promo-choices">
                  {PROMO_CHOICES.map((pt) => (
                    <button
                      key={pt}
                      type="button"
                      onClick={() => tryMove({ ...pendingPromo, promotion: pt })}
                    >
                      {pt}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

        <aside className="ch-panel">
          <div className="ch-rush-bar">
        <span className="ch-rush-time">⏱ {fmtTime(timeLeft)}</span>
        <span>
          {lang === "vi" ? "Điểm:" : "Score:"} <strong>{score}</strong>
        </span>
        <span className="ch-rush-lives" aria-label={lang === "vi" ? "Mạng" : "Lives"}>
          {"❤️".repeat(Math.max(0, lives))}
          {"🖤".repeat(Math.max(0, RUSH_LIVES - lives))}
        </span>
      </div>
      <p className="ch-puzzle-title">
        {lang === "vi" ? puzzle.titleVi : puzzle.titleEn}
      </p>

      {failFlash && (
        <p className="ch-puzzle-fail">
          {lang === "vi" ? "Chưa đúng! Mất 1 mạng." : "Wrong! Lost a life."}
        </p>
      )}

      <button
        type="button"
        className="ch-btn ch-btn-sm"
        onClick={onExit}
        style={{ marginTop: 8 }}
      >
        ← {lang === "vi" ? "Câu đố hằng ngày" : "Daily puzzle"}
      </button>
            </aside>
      </div>
    </div>
  );
}