"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Board, type FightAnim } from "./Board";
import { findBestMove } from "@/lib/chess/ai";
import { burstConfetti } from "@/lib/chess/confetti";
import {
  applyMove,
  gameStatus,
  inCheck,
  type GameResult,
} from "@/lib/chess/engine";
import { parseFen } from "@/lib/chess/fen";
import { STR } from "@/lib/chess/i18n";
import { toSAN } from "@/lib/chess/notation";
import {
  playCapture,
  playCheck,
  playMove,
  playWin,
} from "@/lib/chess/sound";
import { opposite } from "@/lib/chess/types";
import type {
  Board as BoardT,
  CastlingRights,
  Color,
  Lang,
  Level,
  Move,
} from "@/lib/chess/types";

interface Props {
  lang: Lang;
  /** FEN of the custom position from the setup editor. */
  fen: string;
  /** Both engines play at this level (the setup form's level). */
  level: Level;
  onExit: () => void;
}

interface Pos {
  board: BoardT;
  castling: CastlingRights;
  ep: { x: number; y: number } | null;
  turn: Color;
  halfmove: number;
}

const MAX_PLIES = 300; // 150 full moves — beyond that, call it a draw

function kingSquare(board: BoardT, color: Color): { x: number; y: number } | null {
  for (let y = 0; y < 8; y++)
    for (let x = 0; x < 8; x++)
      if (board[y][x]?.type === "K" && board[y][x]?.color === color)
        return { x, y };
  return null;
}

/** Computer-vs-computer: both engines play out a custom setup position
 *  so the user can watch the solution to a position they found. Purely
 *  a spectator/analysis mode — nothing is recorded to stats/history. */
export function CvCView({ lang, fen, level, onExit }: Props) {
  const s = STR[lang];
  const initial = useMemo<Pos>(() => {
    const p = parseFen(fen);
    return {
      board: p.board,
      castling: p.castling,
      ep: p.ep,
      turn: p.turn,
      halfmove: p.halfmove,
    };
  }, [fen]);

  const [pos, setPos] = useState<Pos>(initial);
  const [sans, setSans] = useState<string[]>([]);
  const [lastMove, setLastMove] = useState<Move | null>(null);
  const [fight, setFight] = useState<FightAnim | null>(null);
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [capped, setCapped] = useState(false);
  const timers = useRef<number[]>([]);
  const celebratedRef = useRef(false);
  const listRef = useRef<HTMLDivElement | null>(null);

  const status: GameResult = useMemo(
    () => gameStatus(pos.board, pos.turn, pos.castling, pos.ep, pos.halfmove),
    [pos]
  );
  const over = status.over || capped;

  const later = (fn: () => void, ms: number) => {
    const id = window.setTimeout(fn, ms);
    timers.current.push(id);
  };
  useEffect(() => () => timers.current.forEach((id) => window.clearTimeout(id)), []);

  // Engine loop: while playing, the side to move thinks, then moves.
  useEffect(() => {
    if (!playing || over) return;
    let cancelled = false;
    const think = window.setTimeout(() => {
      if (cancelled) return;
      const { move } = findBestMove(
        { board: pos.board, turn: pos.turn, castling: pos.castling, ep: pos.ep },
        level
      );
      if (!move || cancelled) return;
      const piece = pos.board[move.fromY][move.fromX];
      const target = pos.board[move.toY][move.toX];
      const isEp =
        !!piece && piece.type === "P" && !target && !!pos.ep &&
        move.toX === pos.ep.x && move.toY === pos.ep.y;
      const captured = target ?? (isEp ? pos.board[move.fromY][move.toX] : null);
      const r = applyMove(pos.board, move, pos.castling, pos.ep);
      const nextTurn = opposite(pos.turn);
      const half = piece?.type === "P" || captured ? 0 : pos.halfmove + 1;
      const nextStatus = gameStatus(r.board, nextTurn, r.castling, r.ep, half);
      const suffix = nextStatus.over && nextStatus.kind === "checkmate"
        ? "#"
        : !nextStatus.over && inCheck(r.board, nextTurn)
          ? "+"
          : "";
      const san = piece
        ? toSAN(pos.board, move, pos.turn, pos.castling, pos.ep, lang, suffix)
        : "?";
      setPos({ board: r.board, castling: r.castling, ep: r.ep, turn: nextTurn, halfmove: half });
      setSans((prev) => {
        const next = [...prev, san];
        if (next.length >= MAX_PLIES) setCapped(true);
        return next;
      });
      setLastMove(move);
      if (piece) {
        setFight({ id: Date.now(), move, piece, captured: captured ?? null });
        later(() => setFight(null), 430);
      }
      if (captured) playCapture();
      else playMove();
      if (suffix) later(() => playCheck(), 120);
    }, 550 / speed);
    timers.current.push(think);
    return () => {
      cancelled = true;
      window.clearTimeout(think);
    };
  }, [playing, over, pos, level, lang, speed]);

  // Celebrate a checkmate finish once.
  useEffect(() => {
    if (status.over && status.kind === "checkmate" && !celebratedRef.current) {
      celebratedRef.current = true;
      playWin();
      burstConfetti();
    }
  }, [status]);

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [sans]);

  const restart = () => {
    timers.current.forEach((id) => window.clearTimeout(id));
    timers.current = [];
    celebratedRef.current = false;
    setPos(initial);
    setSans([]);
    setLastMove(null);
    setFight(null);
    setCapped(false);
    setPlaying(true);
  };

  const checkAt =
    !status.over && inCheck(pos.board, pos.turn)
      ? kingSquare(pos.board, pos.turn)
      : status.over && status.kind === "checkmate"
        ? kingSquare(pos.board, pos.turn)
        : null;

  const resultText = capped
    ? `${s.cvcDrawn} — ${s.cvcReasonCap}`
    : status.over
      ? status.kind === "checkmate"
        ? `${status.winner === "white" ? s.cvcWhiteWon : s.cvcBlackWon} ${s.cvcReasonMate}`
        : status.kind === "stalemate"
          ? `${s.cvcDrawn} — ${s.cvcReasonStalemate}`
          : s.cvcDrawn
      : null;

  const pairs: Array<[string, string | null]> = [];
  for (let i = 0; i < sans.length; i += 2)
    pairs.push([sans[i], sans[i + 1] ?? null]);

  return (
    <div className="ch-page">
      <main className="ch-layout">
        <div className="ch-board-area">
          <div className="ch-board-fit">
            <Board
              board={pos.board}
              flipped={false}
              selected={null}
              targets={[]}
              lastMove={lastMove}
              checkAt={checkAt}
              checkKey={sans.length}
              checkBadge={
                status.over && status.kind === "checkmate"
                  ? s.checkmateBadge
                  : checkAt
                    ? s.checkBadge
                    : ""
              }
              fight={fight}
              interactive={false}
              boardLabel={s.cvcTitle}
              onSquareClick={() => {}}
            />
          </div>
        </div>

        <aside className="ch-panel">
          <div>
            <h2 className="ch-setup-title">🤖 {s.cvcTitle}</h2>
            <p className="ch-hint">{s.cvcHint}</p>
            <p className="ch-hint">
              {s.level}: {s.levelLabel(level)} · {s.cvcTurn}:{" "}
              {pos.turn === "white" ? s.whiteName : s.blackName}
              {!over && playing ? ` · ${s.cvcThinking}` : ""}
            </p>
          </div>

          {resultText && (
            <p className="ch-cvc-result" role="status">
              {resultText}
            </p>
          )}

          <div className="ch-setup-actions">
            {!over && (
              <button
                type="button"
                className="ch-btn ch-btn-primary"
                onClick={() => setPlaying((p) => !p)}
              >
                {playing ? s.cvcPause : s.cvcPlay}
              </button>
            )}
            <button type="button" className="ch-btn" onClick={restart}>
              {s.cvcRestart}
            </button>
            <button type="button" className="ch-btn" onClick={onExit}>
              {s.cvcBackToSetup}
            </button>
          </div>

          <label className="ch-field">
            <span>{s.cvcSpeed}</span>
            <select
              className="ch-select"
              value={speed}
              onChange={(e) => setSpeed(Number(e.target.value))}
            >
              <option value={0.5}>0.5×</option>
              <option value={1}>1×</option>
              <option value={2}>2×</option>
            </select>
          </label>

          <div className="ch-cvc-moves" ref={listRef}>
            {pairs.map(([w, b], i) => (
              <div key={i} className="ch-cvc-move-row">
                <span className="ch-cvc-move-no">{i + 1}.</span>
                <span>{w}</span>
                <span>{b ?? ""}</span>
              </div>
            ))}
          </div>
        </aside>
      </main>
    </div>
  );
}
