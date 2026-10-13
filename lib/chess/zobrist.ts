// Zobrist hashing for the chess transposition table.
// Covers pieces, side to move, castling rights and en passant file.
// Uses pairs of 32-bit ints (as a string key) to avoid BigInt.

import type { ApplyResult } from "./engine";
import type {
  Board,
  CastlingRights,
  Color,
  Move,
  PieceType,
} from "./types";

const PIECE_ORDER: PieceType[] = ["K", "Q", "R", "B", "N", "P"];

/** Deterministic PRNG (mulberry32) so hashes are stable across sessions. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) as number;
  };
}

const rand = mulberry32(0x51ed270b);

// [colorIdx][pieceIdx][square] -> [lo32, hi32]
const PIECE_KEYS: number[][][] = [];
for (let c = 0; c < 2; c++) {
  const byColor: number[][] = [];
  for (let p = 0; p < 6; p++) {
    const byPiece: number[] = [];
    for (let s = 0; s < 64; s++) byPiece.push(rand(), rand());
    byColor.push(byPiece);
  }
  PIECE_KEYS.push(byColor);
}

const SIDE_KEY = [rand(), rand()];

// 16 castling-rights combinations -> [lo32, hi32]
const CASTLE_KEYS: number[][] = [];
for (let i = 0; i < 16; i++) CASTLE_KEYS.push([rand(), rand()]);

// En passant file 0..7 -> [lo32, hi32] (no key when there is no ep square)
const EP_KEYS: number[][] = [];
for (let i = 0; i < 8; i++) EP_KEYS.push([rand(), rand()]);

/** 64-bit-ish key encoded as "lo,hi" string (Map-friendly, no BigInt). */
export type ZKey = string;

function pieceIndex(t: PieceType): number {
  return PIECE_ORDER.indexOf(t);
}

/** Bitmask index for castling rights: wk=8, wq=4, bk=2, bq=1. */
export function castleIndex(c: CastlingRights): number {
  return (c.wk ? 8 : 0) | (c.wq ? 4 : 0) | (c.bk ? 2 : 0) | (c.bq ? 1 : 0);
}

export function zobristHash(
  board: Board,
  turn: Color,
  castling: CastlingRights,
  ep: { x: number; y: number } | null
): ZKey {
  let lo = 0;
  let hi = 0;
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      const p = board[y][x];
      if (!p) continue;
      const keys = PIECE_KEYS[p.color === "white" ? 0 : 1][pieceIndex(p.type)];
      const s = y * 8 + x;
      lo ^= keys[s * 2];
      hi ^= keys[s * 2 + 1];
    }
  }
  if (turn === "black") {
    lo ^= SIDE_KEY[0];
    hi ^= SIDE_KEY[1];
  }
  const ck = CASTLE_KEYS[castleIndex(castling)];
  lo ^= ck[0];
  hi ^= ck[1];
  if (ep) {
    lo ^= EP_KEYS[ep.x][0];
    hi ^= EP_KEYS[ep.x][1];
  }
  return `${lo >>> 0},${hi >>> 0}`;
}

/**
 * Incremental update: hash of the position after `m` is played.
 * `board` is the position *before* the move; `r` is engine.applyMove's
 * result (carries the new castling rights, ep square, captured piece and
 * the castle/en-passant flags needed to place every key delta).
 */
export function zobristAfterMove(
  hash: ZKey,
  board: Board,
  m: Move,
  oldCastling: CastlingRights,
  oldEp: { x: number; y: number } | null,
  r: ApplyResult
): ZKey {
  const comma = hash.indexOf(",");
  let lo = parseInt(hash.slice(0, comma), 10);
  let hi = parseInt(hash.slice(comma + 1), 10);

  const piece = board[m.fromY][m.fromX];
  if (!piece) throw new Error("zobristAfterMove: no piece on from-square");
  const pc = piece.color === "white" ? 0 : 1;
  const from = m.fromY * 8 + m.fromX;
  const to = m.toY * 8 + m.toX;

  // Moving piece leaves `from`, (possibly promoted) piece lands on `to`.
  const outKeys = PIECE_KEYS[pc][pieceIndex(piece.type)];
  lo ^= outKeys[from * 2];
  hi ^= outKeys[from * 2 + 1];
  const placed = m.promotion ?? piece.type;
  const inKeys = PIECE_KEYS[pc][pieceIndex(placed)];
  lo ^= inKeys[to * 2];
  hi ^= inKeys[to * 2 + 1];

  // Captured piece leaves the board. En passant captures a pawn that is
  // *not* on the destination square.
  if (r.captured) {
    let cx = m.toX;
    let cy = m.toY;
    if (r.isEnPassant) cy = m.toY + (piece.color === "white" ? 1 : -1);
    const capKeys = PIECE_KEYS[1 - pc][pieceIndex(r.captured.type)];
    const s = cy * 8 + cx;
    lo ^= capKeys[s * 2];
    hi ^= capKeys[s * 2 + 1];
  }

  // Castling also moves the rook.
  if (r.isCastle) {
    const y = m.fromY;
    const rookFromX = m.toX === 6 ? 7 : 0;
    const rookToX = m.toX === 6 ? 5 : 3;
    const rookKeys = PIECE_KEYS[pc][pieceIndex("R")];
    const s0 = y * 8 + rookFromX;
    const s1 = y * 8 + rookToX;
    lo ^= rookKeys[s0 * 2];
    hi ^= rookKeys[s0 * 2 + 1];
    lo ^= rookKeys[s1 * 2];
    hi ^= rookKeys[s1 * 2 + 1];
  }

  // Castling-rights delta.
  const oci = castleIndex(oldCastling);
  const nci = castleIndex(r.castling);
  if (oci !== nci) {
    lo ^= CASTLE_KEYS[oci][0];
    hi ^= CASTLE_KEYS[oci][1];
    lo ^= CASTLE_KEYS[nci][0];
    hi ^= CASTLE_KEYS[nci][1];
  }

  // En passant square delta (file only; rank is implied).
  const oep = oldEp ? oldEp.x : -1;
  const nep = r.ep ? r.ep.x : -1;
  if (oep !== nep) {
    if (oep >= 0) {
      lo ^= EP_KEYS[oep][0];
      hi ^= EP_KEYS[oep][1];
    }
    if (nep >= 0) {
      lo ^= EP_KEYS[nep][0];
      hi ^= EP_KEYS[nep][1];
    }
  }

  // Side to move flips.
  lo ^= SIDE_KEY[0];
  hi ^= SIDE_KEY[1];
  return `${lo >>> 0},${hi >>> 0}`;
}

/**
 * Null-move hash: side flips and any en passant square expires
 * (a pass is not a pawn double-push, so the ep capture is no longer legal).
 */
export function zobristNullMove(
  hash: ZKey,
  ep: { x: number; y: number } | null
): ZKey {
  const comma = hash.indexOf(",");
  let lo = parseInt(hash.slice(0, comma), 10);
  let hi = parseInt(hash.slice(comma + 1), 10);
  if (ep) {
    lo ^= EP_KEYS[ep.x][0];
    hi ^= EP_KEYS[ep.x][1];
  }
  lo ^= SIDE_KEY[0];
  hi ^= SIDE_KEY[1];
  return `${lo >>> 0},${hi >>> 0}`;
}
