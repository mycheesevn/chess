// Computer opponent: negamax with alpha-beta pruning and piece-square
// tables. Strength scales across 10 levels via depth, randomness, time caps.

import { applyMove, legalMoves } from "./engine";
import {
  Board,
  Color,
  Level,
  Move,
  PieceType,
  opposite,
} from "./types";

const MATE = 100000;

const VALUES: Record<PieceType, number> = {
  P: 100,
  N: 320,
  B: 330,
  R: 500,
  Q: 900,
  K: 0,
};

// Piece-square tables, white's perspective, row 0 = rank 8 (matches board y).
const PST: Record<Exclude<PieceType, "K">, number[]> = {
  P: [
    0, 0, 0, 0, 0, 0, 0, 0,
    50, 50, 50, 50, 50, 50, 50, 50,
    10, 10, 20, 30, 30, 20, 10, 10,
    5, 5, 10, 25, 25, 10, 5, 5,
    0, 0, 0, 20, 20, 0, 0, 0,
    5, -5, -10, 0, 0, -10, -5, 5,
    5, 10, 10, -20, -20, 10, 10, 5,
    0, 0, 0, 0, 0, 0, 0, 0,
  ],
  N: [
    -50, -40, -30, -30, -30, -30, -40, -50,
    -40, -20, 0, 0, 0, 0, -20, -40,
    -30, 0, 10, 15, 15, 10, 0, -30,
    -30, 5, 15, 20, 20, 15, 5, -30,
    -30, 0, 15, 20, 20, 15, 0, -30,
    -30, 5, 10, 15, 15, 10, 5, -30,
    -40, -20, 0, 5, 5, 0, -20, -40,
    -50, -40, -30, -30, -30, -30, -40, -50,
  ],
  B: [
    -20, -10, -10, -10, -10, -10, -10, -20,
    -10, 0, 0, 0, 0, 0, 0, -10,
    -10, 0, 5, 10, 10, 5, 0, -10,
    -10, 5, 5, 10, 10, 5, 5, -10,
    -10, 0, 10, 10, 10, 10, 0, -10,
    -10, 10, 10, 10, 10, 10, 10, -10,
    -10, 5, 0, 0, 0, 0, 5, -10,
    -20, -10, -10, -10, -10, -10, -10, -20,
  ],
  R: [
    0, 0, 0, 0, 0, 0, 0, 0,
    5, 10, 10, 10, 10, 10, 10, 5,
    -5, 0, 0, 0, 0, 0, 0, -5,
    -5, 0, 0, 0, 0, 0, 0, -5,
    -5, 0, 0, 0, 0, 0, 0, -5,
    -5, 0, 0, 0, 0, 0, 0, -5,
    -5, 0, 0, 0, 0, 0, 0, -5,
    0, 0, 0, 5, 5, 0, 0, 0,
  ],
  Q: [
    -20, -10, -10, -5, -5, -10, -10, -20,
    -10, 0, 0, 0, 0, 0, 0, -10,
    -10, 0, 5, 5, 5, 5, 0, -10,
    -5, 0, 5, 5, 5, 5, 0, -5,
    0, 0, 5, 5, 5, 5, 0, -5,
    -10, 5, 5, 5, 5, 5, 0, -10,
    -10, 0, 5, 0, 0, 0, 0, -10,
    -20, -10, -10, -5, -5, -10, -10, -20,
  ],
};

export interface LevelConfig {
  level: number;
  depth: number;
  jitter: number;
  timeCapMs: number;
}

export const LEVELS: LevelConfig[] = [
  { level: 1, depth: 1, jitter: 220, timeCapMs: 0 },
  { level: 2, depth: 1, jitter: 110, timeCapMs: 0 },
  { level: 3, depth: 1, jitter: 45, timeCapMs: 0 },
  { level: 4, depth: 1, jitter: 0, timeCapMs: 0 },
  { level: 5, depth: 2, jitter: 55, timeCapMs: 0 },
  { level: 6, depth: 2, jitter: 18, timeCapMs: 0 },
  { level: 7, depth: 2, jitter: 0, timeCapMs: 0 },
  { level: 8, depth: 3, jitter: 18, timeCapMs: 0 },
  { level: 9, depth: 3, jitter: 0, timeCapMs: 0 },
  { level: 10, depth: 4, jitter: 0, timeCapMs: 8000 },
];

export function getLevelConfig(level: Level): LevelConfig {
  const clamped = Math.min(10, Math.max(1, Math.round(level)));
  return LEVELS[clamped - 1];
}

/** Static evaluation, positive favors White. */
export function evaluate(board: Board): number {
  let score = 0;
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      const p = board[y][x];
      if (!p) continue;
      const idx = p.color === "white" ? y * 8 + x : (7 - y) * 8 + x;
      const pst = p.type === "K" ? 0 : PST[p.type][idx];
      const v = VALUES[p.type] + pst;
      score += p.color === "white" ? v : -v;
    }
  }
  return score;
}

function orderMoves(board: Board, moves: Move[]): Move[] {
  const scored = moves.map((m) => {
    const target = board[m.toY][m.toX];
    const attacker = board[m.fromY][m.fromX];
    let s = target
      ? 10 * VALUES[target.type] - VALUES[attacker?.type ?? "P"]
      : 0;
    if (m.promotion) s += VALUES[m.promotion];
    return { m, s };
  });
  scored.sort((a, b) => b.s - a.s);
  return scored.map((s) => s.m);
}

interface SearchCtx {
  nodes: number;
  deadline: number;
  aborted: boolean;
}

export interface SearchParams {
  board: Board;
  turn: Color;
  castling: import("./types").CastlingRights;
  ep: { x: number; y: number } | null;
}

function negamax(
  board: Board,
  turn: Color,
  castling: import("./types").CastlingRights,
  ep: { x: number; y: number } | null,
  depth: number,
  alpha: number,
  beta: number,
  ply: number,
  ctx: SearchCtx
): number {
  ctx.nodes++;
  if ((ctx.nodes & 2047) === 0 && Date.now() > ctx.deadline) ctx.aborted = true;
  if (ctx.aborted) return 0;
  const moves = legalMoves(board, turn, castling, ep);
  if (moves.length === 0) return -MATE + ply;
  if (depth === 0) {
    const e = evaluate(board);
    return turn === "white" ? e : -e;
  }
  let best = -Infinity;
  for (const m of orderMoves(board, moves)) {
    const r = applyMove(board, m, castling, ep);
    const score = -negamax(
      r.board, opposite(turn), r.castling, r.ep,
      depth - 1, -beta, -alpha, ply + 1, ctx
    );
    if (ctx.aborted) return 0;
    if (score > best) best = score;
    if (best > alpha) alpha = best;
    if (alpha >= beta) break;
  }
  return best;
}

export interface SearchStats {
  nodes: number;
  depth: number;
  timeMs: number;
}

export function findBestMove(
  params: SearchParams,
  level: Level
): { move: Move | null; stats: SearchStats } {
  const cfg = getLevelConfig(level);
  const t0 = Date.now();
  const ctx: SearchCtx = {
    nodes: 0,
    deadline: cfg.timeCapMs > 0 ? t0 + cfg.timeCapMs : Infinity,
    aborted: false,
  };
  const { board, turn, castling, ep } = params;
  const moves = orderMoves(board, legalMoves(board, turn, castling, ep));
  const done = (move: Move | null) => ({
    move,
    stats: { nodes: ctx.nodes, depth: cfg.depth, timeMs: Date.now() - t0 },
  });
  if (moves.length === 0) return done(null);

  let best: Move | null = null;
  let bestScore = -Infinity;
  for (const m of moves) {
    const r = applyMove(board, m, castling, ep);
    const score =
      -negamax(r.board, opposite(turn), r.castling, r.ep, cfg.depth - 1,
        -Infinity, Infinity, 1, ctx) +
      (cfg.jitter > 0 ? Math.random() * cfg.jitter : 0);
    if (ctx.aborted) break;
    if (score > bestScore) {
      bestScore = score;
      best = m;
    }
  }
  if (!best) best = moves[0];
  return done(best);
}
