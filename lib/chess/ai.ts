// Computer opponent: negamax search with alpha-beta pruning, transposition
// table (Zobrist hashing), null-move pruning, quiescence search, killer +
// history move ordering, late move reductions, futility pruning and iterative
// deepening with aspiration windows. Strength scales across 12 levels via
// search depth, randomness and time caps.
//
// Evaluation: material + piece-square tables (middlegame/endgame tapered,
// incl. king tables) + bishop pair + pawn structure (passed/isolated/doubled)
// + rooks on open files.

import {
  applyMove,
  inCheck,
  pseudoMoves,
} from "./engine";
import {
  zobristAfterMove,
  zobristHash,
  zobristNullMove,
  type ZKey,
} from "./zobrist";
import {
  Board,
  CastlingRights,
  Color,
  Level,
  Move,
  PieceType,
  opposite,
} from "./types";

const MATE = 100000;
/** Scores with |s| > MATE_BOUND are mate scores (ply-adjusted in the TT). */
const MATE_BOUND = MATE - 1000;

const VALUES: Record<PieceType, number> = {
  P: 100,
  N: 320,
  B: 330,
  R: 500,
  Q: 900,
  K: 0,
};

// Piece-square tables, white's perspective, row 0 = rank 8 (matches board y).
// Well-established middlegame tables (Tomasz Michniewski's simplified
// evaluation function); king has separate middlegame/endgame tables below.
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

// King middlegame: stay sheltered behind pawns.
const K_MG: number[] = [
  -30, -40, -40, -50, -50, -40, -40, -30,
  -30, -40, -40, -50, -50, -40, -40, -30,
  -30, -40, -40, -50, -50, -40, -40, -30,
  -30, -40, -40, -50, -50, -40, -40, -30,
  -20, -30, -30, -40, -40, -30, -30, -20,
  -10, -20, -20, -20, -20, -20, -20, -10,
  20, 20, 0, 0, 0, 0, 20, 20,
  20, 30, 10, 0, 0, 10, 30, 20,
];

// King endgame: centralize and become an active piece.
const K_EG: number[] = [
  -50, -40, -30, -20, -20, -30, -40, -50,
  -30, -20, -10, 0, 0, -10, -20, -30,
  -30, -10, 20, 30, 30, 20, -10, -30,
  -30, -10, 30, 40, 40, 30, -10, -30,
  -30, -10, 30, 40, 40, 30, -10, -30,
  -30, -10, 20, 30, 30, 20, -10, -30,
  -30, -30, 0, 0, 0, 0, -30, -30,
  -50, -30, -30, -30, -30, -30, -30, -50,
];

const BISHOP_PAIR = 30;
const ROOK_OPEN_FILE = 15;
const ROOK_SEMI_OPEN_FILE = 8;
const ISOLATED_PAWN = -12;
const DOUBLED_PAWN = -10;
/** Indexed by pawn advancement (0 = unmoved, 6 = one step from promotion). */
const PASSED_BONUS = [0, 10, 25, 50, 90, 140, 200];

export interface LevelConfig {
  level: number;
  depth: number;
  jitter: number;
  /** Max search time in ms; 0 = no cap. */
  timeCapMs: number;
}

export const LEVELS: LevelConfig[] = [
  { level: 1, depth: 1, jitter: 300, timeCapMs: 0 },
  { level: 2, depth: 1, jitter: 150, timeCapMs: 0 },
  { level: 3, depth: 2, jitter: 120, timeCapMs: 0 },
  { level: 4, depth: 2, jitter: 50, timeCapMs: 0 },
  { level: 5, depth: 2, jitter: 0, timeCapMs: 0 },
  { level: 6, depth: 3, jitter: 40, timeCapMs: 0 },
  { level: 7, depth: 3, jitter: 0, timeCapMs: 0 },
  { level: 8, depth: 4, jitter: 0, timeCapMs: 3000 },
  { level: 9, depth: 5, jitter: 0, timeCapMs: 6000 },
  { level: 10, depth: 7, jitter: 0, timeCapMs: 10000 },
  // Expert levels: L11–L12 search much deeper with larger time budgets.
  // Levels 1–10 are frozen exactly as shipped (existing players' experience
  // must not shift).
  { level: 11, depth: 8, jitter: 0, timeCapMs: 15000 },
  { level: 12, depth: 10, jitter: 0, timeCapMs: 30000 },
];

export function getLevelConfig(level: Level): LevelConfig {
  const clamped = Math.min(12, Math.max(1, Math.round(level)));
  return LEVELS[clamped - 1];
}

/**
 * Static evaluation, positive favors White.
 * Tapered: middlegame and endgame scores are blended by remaining
 * non-pawn material (phase 24 = full middlegame, 0 = bare kings).
 * Adds bishop pair, pawn structure (passed/isolated/doubled) and
 * rooks on open/semi-open files on top of material + piece-square tables.
 */
export function evaluate(board: Board): number {
  let mg = 0;
  let eg = 0;
  let phase = 0;
  let wBishops = 0;
  let bBishops = 0;
  const wFiles = new Array<number>(8).fill(0);
  const bFiles = new Array<number>(8).fill(0);
  const wFileRanks: number[][] = [[], [], [], [], [], [], [], []];
  const bFileRanks: number[][] = [[], [], [], [], [], [], [], []];
  const wRooks: number[] = [];
  const bRooks: number[] = [];

  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      const p = board[y][x];
      if (!p) continue;
      const idx = p.color === "white" ? y * 8 + x : (7 - y) * 8 + x;
      const v = VALUES[p.type];
      let pst: number;
      let pstEg: number;
      if (p.type === "K") {
        pst = K_MG[idx];
        pstEg = K_EG[idx];
      } else {
        pst = PST[p.type][idx];
        pstEg = pst;
      }
      const s = p.color === "white" ? 1 : -1;
      mg += s * (v + pst);
      eg += s * (v + pstEg);
      if (p.type === "N" || p.type === "B") phase += 1;
      else if (p.type === "R") phase += 2;
      else if (p.type === "Q") phase += 4;
      if (p.type === "B") {
        if (p.color === "white") wBishops++;
        else bBishops++;
      } else if (p.type === "R") {
        (p.color === "white" ? wRooks : bRooks).push(x);
      } else if (p.type === "P") {
        if (p.color === "white") {
          wFiles[x]++;
          wFileRanks[x].push(y);
        } else {
          bFiles[x]++;
          bFileRanks[x].push(y);
        }
      }
    }
  }
  if (phase > 24) phase = 24;

  // Bishop pair.
  if (wBishops >= 2) {
    mg += BISHOP_PAIR;
    eg += BISHOP_PAIR;
  }
  if (bBishops >= 2) {
    mg -= BISHOP_PAIR;
    eg -= BISHOP_PAIR;
  }

  // Pawn structure: doubled pawns (per file, once).
  for (let f = 0; f < 8; f++) {
    if (wFiles[f] > 1) {
      const d = DOUBLED_PAWN * (wFiles[f] - 1);
      mg += d;
      eg += d;
    }
    if (bFiles[f] > 1) {
      const d = DOUBLED_PAWN * (bFiles[f] - 1);
      mg -= d;
      eg -= d;
    }
  }

  // White pawns: isolated + passed.
  for (let f = 0; f < 8; f++) {
    const adj =
      (f > 0 ? wFiles[f - 1] : 0) + (f < 7 ? wFiles[f + 1] : 0);
    for (const y of wFileRanks[f]) {
      if (adj === 0) {
        mg += ISOLATED_PAWN;
        eg += ISOLATED_PAWN;
      }
      let passed = true;
      for (let af = Math.max(0, f - 1); af <= Math.min(7, f + 1); af++) {
        for (const by of bFileRanks[af]) {
          if (by < y) {
            passed = false;
            break;
          }
        }
        if (!passed) break;
      }
      if (passed) {
        const adv = Math.min(6, Math.max(0, 6 - y));
        mg += PASSED_BONUS[adv];
        eg += PASSED_BONUS[adv];
      }
    }
  }
  // Black pawns: isolated + passed.
  for (let f = 0; f < 8; f++) {
    const adj =
      (f > 0 ? bFiles[f - 1] : 0) + (f < 7 ? bFiles[f + 1] : 0);
    for (const y of bFileRanks[f]) {
      if (adj === 0) {
        mg -= ISOLATED_PAWN;
        eg -= ISOLATED_PAWN;
      }
      let passed = true;
      for (let af = Math.max(0, f - 1); af <= Math.min(7, f + 1); af++) {
        for (const wy of wFileRanks[af]) {
          if (wy > y) {
            passed = false;
            break;
          }
        }
        if (!passed) break;
      }
      if (passed) {
        const adv = Math.min(6, Math.max(0, y - 1));
        mg -= PASSED_BONUS[adv];
        eg -= PASSED_BONUS[adv];
      }
    }
  }

  // Rooks on open / semi-open files.
  for (const x of wRooks) {
    if (wFiles[x] === 0) {
      const b = bFiles[x] === 0 ? ROOK_OPEN_FILE : ROOK_SEMI_OPEN_FILE;
      mg += b;
      eg += b;
    }
  }
  for (const x of bRooks) {
    if (bFiles[x] === 0) {
      const b = wFiles[x] === 0 ? ROOK_OPEN_FILE : ROOK_SEMI_OPEN_FILE;
      mg -= b;
      eg -= b;
    }
  }

  return Math.round((mg * phase + eg * (24 - phase)) / 24);
}

/** Evaluation from the side-to-move's perspective. */
function sideEval(board: Board, turn: Color): number {
  const e = evaluate(board);
  return turn === "white" ? e : -e;
}

// ---------------------------------------------------------------------------
// Transposition table
// ---------------------------------------------------------------------------

const TT_EXACT = 0;
const TT_LOWER = 1; // fail-high: score >= beta
const TT_UPPER = 2; // fail-low: score <= alpha

interface TTEntry {
  depth: number;
  /** Mate scores are stored ply-adjusted (see ttStore/ttProbe). */
  score: number;
  flag: number;
  best: Move | null;
}

/** Cap entries to bound memory (browser-safe). */
const TT_MAX_ENTRIES = 120000;

function ttStore(
  tt: Map<ZKey, TTEntry>,
  key: ZKey,
  depth: number,
  score: number,
  flag: number,
  ply: number,
  best: Move | null
): void {
  if (tt.size >= TT_MAX_ENTRIES) return;
  let s = score;
  if (s > MATE_BOUND) s += ply;
  else if (s < -MATE_BOUND) s -= ply;
  const prev = tt.get(key);
  // Prefer deeper entries (standard replacement scheme).
  if (prev && prev.depth > depth) return;
  tt.set(key, { depth, score: s, flag, best });
}

/** Returns { score, best, usable } or null. Adjusts mate scores back by ply.
 *  `usable` means the stored bound allows a cutoff at this depth/alpha/beta;
 *  `best` is always usable for move ordering. */
function ttProbe(
  tt: Map<ZKey, TTEntry>,
  key: ZKey,
  depth: number,
  alpha: number,
  beta: number,
  ply: number
): { score: number; best: Move | null; usable: boolean } | null {
  const e = tt.get(key);
  if (!e) return null;
  let s = e.score;
  if (s > MATE_BOUND) s -= ply;
  else if (s < -MATE_BOUND) s += ply;
  let usable = false;
  if (e.depth >= depth) {
    if (e.flag === TT_EXACT) usable = true;
    else if (e.flag === TT_LOWER && s >= beta) usable = true;
    else if (e.flag === TT_UPPER && s <= alpha) usable = true;
  }
  return { score: s, best: e.best, usable };
}

// ---------------------------------------------------------------------------
// Search context: killers, history, node counting, time control
// ---------------------------------------------------------------------------

interface SearchCtx {
  nodes: number;
  deadline: number;
  aborted: boolean;
  tt: Map<ZKey, TTEntry>;
  /** Two killer (quiet) moves per ply. */
  killers: (Move | null)[][];
  /** History heuristic: [color][fromSq][toSq]. */
  history: number[][][];
}

function newSearchCtx(timeCapMs: number): SearchCtx {
  const killers: (Move | null)[][] = [];
  for (let i = 0; i < 64; i++) killers.push([null, null]);
  const history: number[][][] = [];
  for (let c = 0; c < 2; c++) {
    const hc: number[][] = [];
    for (let f = 0; f < 64; f++) hc.push(new Array<number>(64).fill(0));
    history.push(hc);
  }
  return {
    nodes: 0,
    deadline: timeCapMs > 0 ? Date.now() + timeCapMs : Infinity,
    aborted: false,
    tt: new Map(),
    killers,
    history,
  };
}

function sameMove(a: Move | null, b: Move | null): boolean {
  return (
    !!a &&
    !!b &&
    a.fromX === b.fromX &&
    a.fromY === b.fromY &&
    a.toX === b.toX &&
    a.toY === b.toY &&
    (a.promotion ?? null) === (b.promotion ?? null)
  );
}

function checkTime(ctx: SearchCtx): boolean {
  if ((ctx.nodes & 1023) === 0 && Date.now() > ctx.deadline) ctx.aborted = true;
  return ctx.aborted;
}

/** True for captures (including en passant, whose target square is empty). */
function isCaptureMove(
  board: Board,
  m: Move,
  ep: { x: number; y: number } | null
): boolean {
  if (board[m.toY][m.toX]) return true;
  const piece = board[m.fromY][m.fromX];
  return (
    !!piece &&
    piece.type === "P" &&
    !!ep &&
    m.toX === ep.x &&
    m.toY === ep.y
  );
}

/** Material value of the captured piece (0 for quiet moves). */
function captureValue(
  board: Board,
  m: Move,
  ep: { x: number; y: number } | null
): number {
  const t = board[m.toY][m.toX];
  if (t) return VALUES[t.type];
  const piece = board[m.fromY][m.fromX];
  if (
    piece &&
    piece.type === "P" &&
    ep &&
    m.toX === ep.x &&
    m.toY === ep.y
  )
    return VALUES.P;
  return 0;
}

/**
 * Order moves in place: TT move > MVV-LVA captures/promotions > killers >
 * history. Good ordering is the single biggest alpha-beta speedup.
 */
function orderMoves(
  board: Board,
  moves: Move[],
  ep: { x: number; y: number } | null,
  ttMove: Move | null,
  ply: number,
  ctx: SearchCtx,
  turn: Color
): void {
  const ci = turn === "white" ? 0 : 1;
  const scored = moves.map((m) => {
    let s: number;
    if (sameMove(m, ttMove)) {
      s = 30000000;
    } else {
      const vic = captureValue(board, m, ep);
      if (vic > 0 || m.promotion) {
        const attacker = board[m.fromY][m.fromX];
        s =
          20000000 +
          10 * vic -
          VALUES[attacker?.type ?? "P"] +
          (m.promotion ? 10 * VALUES[m.promotion] : 0);
      } else {
        const k = ctx.killers[Math.min(ply, 63)];
        if (sameMove(m, k[0])) s = 10000000;
        else if (sameMove(m, k[1])) s = 9000000;
        else
          s =
            ctx.history[ci][m.fromY * 8 + m.fromX][
              m.toY * 8 + m.toX
            ];
      }
    }
    return { m, s };
  });
  scored.sort((a, b) => b.s - a.s);
  for (let i = 0; i < moves.length; i++) moves[i] = scored[i].m;
}

function storeKiller(ctx: SearchCtx, ply: number, m: Move): void {
  const k = ctx.killers[Math.min(ply, 63)];
  if (!sameMove(m, k[0])) {
    k[1] = k[0];
    k[0] = m;
  }
}

function storeHistory(ctx: SearchCtx, turn: Color, m: Move, depth: number): void {
  const ci = turn === "white" ? 0 : 1;
  const from = m.fromY * 8 + m.fromX;
  const to = m.toY * 8 + m.toX;
  // Cap to keep values bounded; depth^2 rewards cutoffs nearer the root.
  ctx.history[ci][from][to] = Math.min(
    ctx.history[ci][from][to] + depth * depth,
    1000000
  );
}

/** Fast legal-move generation for the search (direct attack test instead of
 *  full opponent move generation per candidate). */
function legalMovesFast(
  board: Board,
  turn: Color,
  castling: CastlingRights,
  ep: { x: number; y: number } | null
): Move[] {
  const out: Move[] = [];
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      const p = board[y][x];
      if (!p || p.color !== turn) continue;
      for (const m of pseudoMoves(board, x, y, castling, ep)) {
        const { board: nb } = applyMove(board, m, castling, ep);
        if (!inCheck(nb, turn)) out.push(m);
      }
    }
  }
  return out;
}

/** Legal captures only — for quiescence (skips legality work on quiet moves). */
function legalCapturesFast(
  board: Board,
  turn: Color,
  castling: CastlingRights,
  ep: { x: number; y: number } | null
): Move[] {
  const out: Move[] = [];
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      const p = board[y][x];
      if (!p || p.color !== turn) continue;
      for (const m of pseudoMoves(board, x, y, castling, ep)) {
        if (!isCaptureMove(board, m, ep)) continue;
        const { board: nb } = applyMove(board, m, castling, ep);
        if (!inCheck(nb, turn)) out.push(m);
      }
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Quiescence search: captures (and check evasions) past the horizon.
// ---------------------------------------------------------------------------

function quiescence(
  board: Board,
  turn: Color,
  castling: CastlingRights,
  ep: { x: number; y: number } | null,
  hash: ZKey,
  alpha: number,
  beta: number,
  ply: number,
  ctx: SearchCtx
): number {
  if (checkTime(ctx)) return 0;
  ctx.nodes++;

  const inChk = inCheck(board, turn);
  if (inChk) {
    // In check: search all evasions (standing pat is illegal).
    const evasions = legalMovesFast(board, turn, castling, ep);
    if (evasions.length === 0) return -MATE + ply;
    if (ply >= 32) return sideEval(board, turn);
    const probe = ttProbe(ctx.tt, hash, 0, alpha, beta, ply);
    const ttMove = probe?.best ?? null;
    if (probe?.usable) return probe.score;
    orderMoves(board, evasions, ep, ttMove, ply, ctx, turn);
    let best = -Infinity;
    for (const m of evasions) {
      const r = applyMove(board, m, castling, ep);
      const nh = zobristAfterMove(hash, board, m, castling, ep, r);
      const s = -quiescence(
        r.board,
        opposite(turn),
        r.castling,
        r.ep,
        nh,
        -beta,
        -alpha,
        ply + 1,
        ctx
      );
      if (ctx.aborted) return 0;
      if (s > best) best = s;
      if (s > alpha) alpha = s;
      if (alpha >= beta) break;
    }
    return best;
  }

  // Not in check: captures only.
  if (ply >= 32) return sideEval(board, turn);

  const probe = ttProbe(ctx.tt, hash, 0, alpha, beta, ply);
  const ttMove = probe?.best ?? null;
  if (probe?.usable) return probe.score;

  const standPat = sideEval(board, turn);
  if (standPat >= beta) return beta;
  if (standPat > alpha) alpha = standPat;

  const captures = legalCapturesFast(board, turn, castling, ep);
  orderMoves(board, captures, ep, ttMove, ply, ctx, turn);
  let best = standPat;
  for (const m of captures) {
    const vic = captureValue(board, m, ep);
    const promoV = m.promotion ? VALUES[m.promotion] : 0;
    // Delta pruning: even winning the victim (+promotion) can't raise alpha.
    if (standPat + vic + promoV + 150 < alpha) continue;
    const r = applyMove(board, m, castling, ep);
    const nh = zobristAfterMove(hash, board, m, castling, ep, r);
    const s = -quiescence(
      r.board,
      opposite(turn),
      r.castling,
      r.ep,
      nh,
      -beta,
      -alpha,
      ply + 1,
      ctx
    );
    if (ctx.aborted) return 0;
    if (s > best) best = s;
    if (s > alpha) alpha = s;
    if (alpha >= beta) break;
  }
  return best;
}

// ---------------------------------------------------------------------------
// Main negamax with TT, null-move pruning and quiescence at the leaves.
// ---------------------------------------------------------------------------

function negamax(
  board: Board,
  turn: Color,
  castling: CastlingRights,
  ep: { x: number; y: number } | null,
  hash: ZKey,
  depth: number,
  alpha: number,
  beta: number,
  ply: number,
  ctx: SearchCtx,
  canNull: boolean
): number {
  if (checkTime(ctx)) return 0;
  ctx.nodes++;

  const inChk = inCheck(board, turn);

  const probe = ttProbe(ctx.tt, hash, depth, alpha, beta, ply);
  const ttMove = probe?.best ?? null;
  if (probe?.usable) return probe.score;

  if (depth <= 0)
    return quiescence(board, turn, castling, ep, hash, alpha, beta, ply, ctx);

  // Null-move pruning: let the opponent move twice; if still >= beta, prune.
  // Skipped in check (illegal), near the root (ply 0), and when beta is a
  // mate bound (the null window would degenerate).
  if (canNull && !inChk && depth >= 3 && ply > 0 && beta < MATE_BOUND) {
    const R = depth > 6 ? 3 : 2;
    const nh = zobristNullMove(hash, ep);
    const s = -negamax(
      board,
      opposite(turn),
      castling,
      null,
      nh,
      depth - 1 - R,
      -beta,
      -beta + 1,
      ply + 1,
      ctx,
      false
    );
    if (ctx.aborted) return 0;
    if (s >= beta) return s;
  }

  const moves = legalMovesFast(board, turn, castling, ep);
  if (moves.length === 0) {
    // Checkmate loses (prefer slower losses); stalemate is a draw.
    return inChk ? -MATE + ply : 0;
  }

  // Futility pruning: at shallow depths, if the static eval plus a margin
  // can't reach alpha, quiet moves are futile — search tacticals only.
  // (Never applied in check, where every evasion matters.)
  let futile = false;
  if (depth <= 2 && !inChk && alpha > -MATE_BOUND && beta < MATE_BOUND) {
    const standPat = sideEval(board, turn);
    const margin = depth === 1 ? 150 : 300;
    if (standPat + margin <= alpha) futile = true;
  }

  orderMoves(board, moves, ep, ttMove, ply, ctx, turn);

  let best = -Infinity;
  let bestMove: Move | null = null;
  let flag = TT_UPPER;
  let moveIdx = 0;
  for (const m of moves) {
    moveIdx++;
    const isTactical =
      captureValue(board, m, ep) > 0 || !!m.promotion;
    if (futile && !isTactical) continue; // futility pruning

    const r = applyMove(board, m, castling, ep);
    const nh = zobristAfterMove(hash, board, m, castling, ep, r);

    // Late Move Reductions: late quiet moves are searched shallower first;
    // only researched at full depth if they look promising (> alpha).
    const doLmr =
      depth >= 3 && moveIdx > 4 && !isTactical && !inChk && beta < MATE_BOUND;
    let s: number;
    if (doLmr) {
      s = -negamax(
        r.board,
        opposite(turn),
        r.castling,
        r.ep,
        nh,
        depth - 2,
        -beta,
        -alpha,
        ply + 1,
        ctx,
        true
      );
      if (ctx.aborted) return 0;
      if (s > alpha) {
        s = -negamax(
          r.board,
          opposite(turn),
          r.castling,
          r.ep,
          nh,
          depth - 1,
          -beta,
          -alpha,
          ply + 1,
          ctx,
          true
        );
        if (ctx.aborted) return 0;
      }
    } else {
      s = -negamax(
        r.board,
        opposite(turn),
        r.castling,
        r.ep,
        nh,
        depth - 1,
        -beta,
        -alpha,
        ply + 1,
        ctx,
        true
      );
      if (ctx.aborted) return 0;
    }
    if (s > best) {
      best = s;
      bestMove = m;
      if (s > alpha) {
        alpha = s;
        flag = TT_EXACT;
      }
      if (alpha >= beta) {
        flag = TT_LOWER;
        if (!isTactical) {
          storeKiller(ctx, ply, m);
          storeHistory(ctx, turn, m, depth);
        }
        break;
      }
    }
  }

  // All moves were futility-pruned: fall back to quiescence (captures only).
  if (best === -Infinity) {
    return quiescence(board, turn, castling, ep, hash, alpha, beta, ply, ctx);
  }

  ttStore(ctx.tt, hash, depth, best, flag, ply, bestMove);
  return best;
}

// ---------------------------------------------------------------------------
// Root: iterative deepening with aspiration windows.
// ---------------------------------------------------------------------------

export interface SearchStats {
  nodes: number;
  depth: number;
  timeMs: number;
}

export interface SearchParams {
  board: Board;
  turn: Color;
  castling: CastlingRights;
  ep: { x: number; y: number } | null;
}

interface RootResult {
  move: Move | null;
  /** Centipawns from the side-to-move's perspective. */
  score: number;
  stats: SearchStats;
  /** Deepest fully completed iteration. */
  completedDepth: number;
}

function searchRoot(
  board: Board,
  turn: Color,
  castling: CastlingRights,
  ep: { x: number; y: number } | null,
  maxDepth: number,
  timeCapMs: number,
  jitter: number
): RootResult {
  const t0 = Date.now();
  const c = newSearchCtx(timeCapMs);
  const hash = zobristHash(board, turn, castling, ep);
  const moves = legalMovesFast(board, turn, castling, ep);
  const done = (
    move: Move | null,
    score: number,
    completedDepth: number
  ): RootResult => ({
    move,
    score,
    stats: { nodes: c.nodes, depth: completedDepth, timeMs: Date.now() - t0 },
    completedDepth,
  });
  if (moves.length === 0)
    return done(null, inCheck(board, turn) ? -MATE : 0, 0);

  // Static ordering for the first iteration; PV move bubbles to front after.
  orderMoves(board, moves, ep, null, 0, c, turn);

  let best: Move | null = moves[0];
  let bestScore = 0;
  let completedDepth = 0;

  for (let depth = 1; depth <= maxDepth; depth++) {
    let alpha = -Infinity;
    let beta = Infinity;
    const useAspiration = depth >= 4 && completedDepth >= 3;
    if (useAspiration) {
      alpha = bestScore - 60;
      beta = bestScore + 60;
    }

    let iterBest: Move | null = null;
    let iterScore = -Infinity; // raw (unjittered) best for aspiration/mate
    let iterJittered = -Infinity;
    let aborted = false;

    // Previous best first for tight bounds.
    const ordered: Move[] = best
      ? [best, ...moves.filter((m) => !sameMove(m, best))]
      : moves;

    for (const m of ordered) {
      const r = applyMove(board, m, castling, ep);
      const nh = zobristAfterMove(hash, board, m, castling, ep, r);
      let s = -negamax(
        r.board,
        opposite(turn),
        r.castling,
        r.ep,
        nh,
        depth - 1,
        -beta,
        -alpha,
        1,
        c,
        true
      );
      if (c.aborted) {
        aborted = true;
        break;
      }
      if (useAspiration && (s <= alpha || s >= beta)) {
        // Aspiration failed: research with a full window.
        s = -negamax(
          r.board,
          opposite(turn),
          r.castling,
          r.ep,
          nh,
          depth - 1,
          -Infinity,
          Infinity,
          1,
          c,
          true
        );
        if (c.aborted) {
          aborted = true;
          break;
        }
        alpha = -Infinity;
        beta = Infinity;
      }
      const js = jitter > 0 ? s + Math.random() * jitter : s;
      if (js > iterJittered) {
        iterJittered = js;
        iterScore = s;
        iterBest = m;
      }
      if (s > alpha) alpha = s;
    }
    if (aborted) break;
    if (iterBest) {
      best = iterBest;
      bestScore = iterScore;
      completedDepth = depth;
    }
    // Found a forced mate: deeper search can't improve the move choice.
    if (Math.abs(iterScore) > MATE_BOUND) break;
    // Time heuristic: don't start a depth likely to blow the budget.
    if (timeCapMs > 0) {
      const elapsed = Date.now() - t0;
      if (elapsed > timeCapMs * 0.55 && depth >= 2) break;
    }
  }

  return done(best, bestScore, completedDepth);
}

/** Best move for `turn` at the given level (1-12). Null when no legal moves. */
export function findBestMove(
  params: SearchParams,
  level: Level
): { move: Move | null; stats: SearchStats } {
  const cfg = getLevelConfig(level);
  const { move, stats } = searchRoot(
    params.board,
    params.turn,
    params.castling,
    params.ep,
    cfg.depth,
    cfg.timeCapMs,
    cfg.jitter
  );
  return { move, stats };
}

export interface PositionAnalysis {
  bestMove: Move | null;
  /** Centipawns from the side-to-move's perspective. */
  score: number;
  depth: number;
  nodes: number;
  timeMs: number;
}

/** Deep, deterministic analysis of a position (uses the full-strength search).
 *  Shared with future analysis/hint features; the game AI is untouched. */
export function analyzePosition(
  board: Board,
  turn: Color,
  castling: CastlingRights,
  ep: { x: number; y: number } | null,
  timeCapMs = 4000
): PositionAnalysis {
  const { move, score, stats } = searchRoot(
    board,
    turn,
    castling,
    ep,
    6,
    timeCapMs,
    0
  );
  return {
    bestMove: move,
    score,
    depth: stats.depth,
    nodes: stats.nodes,
    timeMs: stats.timeMs,
  };
}
