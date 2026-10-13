// International chess rules engine: move generation, check detection,
// castling, en passant, promotion, and game-end detection.

import {
  Board,
  CastlingRights,
  Color,
  Move,
  Piece,
  PieceType,
  inBoard,
  opposite,
} from "./types";

export function initialBoard(): Board {
  const back: PieceType[] = ["R", "N", "B", "Q", "K", "B", "N", "R"];
  const board: Board = Array.from({ length: 8 }, () =>
    Array<Piece | null>(8).fill(null)
  );
  for (let x = 0; x < 8; x++) {
    board[0][x] = { type: back[x], color: "black" };
    board[1][x] = { type: "P", color: "black" };
    board[6][x] = { type: "P", color: "white" };
    board[7][x] = { type: back[x], color: "white" };
  }
  return board;
}

export const INITIAL_CASTLING: CastlingRights = {
  wk: true,
  wq: true,
  bk: true,
  bq: true,
};

const KNIGHT_D: ReadonlyArray<readonly [number, number]> = [
  [1, 2], [2, 1], [2, -1], [1, -2],
  [-1, -2], [-2, -1], [-2, 1], [-1, 2],
];
const KING_D: ReadonlyArray<readonly [number, number]> = [
  [1, 0], [1, 1], [0, 1], [-1, 1],
  [-1, 0], [-1, -1], [0, -1], [1, -1],
];
const ROOK_D: ReadonlyArray<readonly [number, number]> = [
  [1, 0], [-1, 0], [0, 1], [0, -1],
];
const BISHOP_D: ReadonlyArray<readonly [number, number]> = [
  [1, 1], [1, -1], [-1, 1], [-1, -1],
];

function findKing(board: Board, color: Color): { x: number; y: number } | null {
  for (let y = 0; y < 8; y++)
    for (let x = 0; x < 8; x++) {
      const p = board[y][x];
      if (p && p.type === "K" && p.color === color) return { x, y };
    }
  return null;
}

/** True if square (x,y) is attacked by `by` color. */
export function isSquareAttacked(
  board: Board,
  x: number,
  y: number,
  by: Color
): boolean {
  // Pawns.
  const py = by === "white" ? y + 1 : y - 1;
  for (const dx of [-1, 1]) {
    if (inBoard(x + dx, py)) {
      const p = board[py][x + dx];
      if (p && p.color === by && p.type === "P") return true;
    }
  }
  // Knights.
  for (const [dx, dy] of KNIGHT_D) {
    if (!inBoard(x + dx, y + dy)) continue;
    const p = board[y + dy][x + dx];
    if (p && p.color === by && p.type === "N") return true;
  }
  // King.
  for (const [dx, dy] of KING_D) {
    if (!inBoard(x + dx, y + dy)) continue;
    const p = board[y + dy][x + dx];
    if (p && p.color === by && p.type === "K") return true;
  }
  // Sliders.
  const rays: Array<{ dirs: typeof ROOK_D; types: PieceType[] }> = [
    { dirs: ROOK_D, types: ["R", "Q"] },
    { dirs: BISHOP_D, types: ["B", "Q"] },
  ];
  for (const { dirs, types } of rays) {
    for (const [dx, dy] of dirs) {
      let nx = x + dx;
      let ny = y + dy;
      while (inBoard(nx, ny)) {
        const p = board[ny][nx];
        if (p) {
          if (p.color === by && types.includes(p.type)) return true;
          break;
        }
        nx += dx;
        ny += dy;
      }
    }
  }
  return false;
}

export function inCheck(board: Board, color: Color): boolean {
  const k = findKing(board, color);
  return k ? isSquareAttacked(board, k.x, k.y, opposite(color)) : false;
}

export interface ApplyResult {
  board: Board;
  castling: CastlingRights;
  ep: { x: number; y: number } | null;
  captured: Piece | null;
  isCastle: boolean;
  isEnPassant: boolean;
}

/** Apply a (legal) move. Does not check legality. */
export function applyMove(
  board: Board,
  move: Move,
  castling: CastlingRights,
  ep: { x: number; y: number } | null
): ApplyResult {
  const nb: Board = board.map((r) => r.slice());
  const nc: CastlingRights = { ...castling };
  const piece = nb[move.fromY][move.fromX];
  if (!piece) throw new Error("applyMove: no piece on from-square");

  let captured: Piece | null = nb[move.toY][move.toX];
  let isEnPassant = false;
  let isCastle = false;

  // En passant capture removes the pawn beside the target square.
  if (
    piece.type === "P" &&
    ep &&
    move.toX === ep.x &&
    move.toY === ep.y &&
    !captured
  ) {
    const capY = piece.color === "white" ? move.toY + 1 : move.toY - 1;
    captured = nb[capY][move.toX];
    nb[capY][move.toX] = null;
    isEnPassant = true;
  }

  nb[move.fromY][move.fromX] = null;

  // Castling: also move the rook.
  if (piece.type === "K" && Math.abs(move.toX - move.fromX) === 2) {
    isCastle = true;
    const y = move.fromY;
    if (move.toX === 6) {
      nb[y][5] = nb[y][7];
      nb[y][7] = null;
    } else {
      nb[y][3] = nb[y][0];
      nb[y][0] = null;
    }
  }

  nb[move.toY][move.toX] =
    move.promotion != null
      ? { type: move.promotion, color: piece.color }
      : piece;

  // Update castling rights.
  if (piece.type === "K") {
    if (piece.color === "white") { nc.wk = false; nc.wq = false; }
    else { nc.bk = false; nc.bq = false; }
  }
  const homeRook = (x: number, y: number, key: keyof CastlingRights) => {
    if (move.fromX === x && move.fromY === y) nc[key] = false;
    if (move.toX === x && move.toY === y) nc[key] = false;
  };
  homeRook(0, 7, "wq");
  homeRook(7, 7, "wk");
  homeRook(0, 0, "bq");
  homeRook(7, 0, "bk");

  // New en passant target after a double pawn push.
  let nep: { x: number; y: number } | null = null;
  if (piece.type === "P" && Math.abs(move.toY - move.fromY) === 2) {
    nep = { x: move.fromX, y: (move.fromY + move.toY) / 2 };
  }

  return { board: nb, castling: nc, ep: nep, captured, isCastle, isEnPassant };
}

/** Pseudo-legal moves for the piece on (x,y) (may leave king in check). */
export function pseudoMoves(
  board: Board,
  x: number,
  y: number,
  castling: CastlingRights,
  ep: { x: number; y: number } | null
): Move[] {
  const p = board[y][x];
  if (!p) return [];
  const moves: Move[] = [];
  const add = (toX: number, toY: number, promotion?: PieceType) => {
    if (!inBoard(toX, toY)) return;
    const t = board[toY][toX];
    if (!t || t.color !== p.color)
      moves.push({ fromX: x, fromY: y, toX, toY, promotion });
  };

  if (p.type === "P") {
    const dir = p.color === "white" ? -1 : 1;
    const startY = p.color === "white" ? 6 : 1;
    const promoY = p.color === "white" ? 0 : 7;
    const push = (toX: number, toY: number, promotion?: PieceType) => {
      if (!inBoard(toX, toY) || board[toY][toX]) return;
      moves.push({ fromX: x, fromY: y, toX, toY, promotion });
    };
    if (y + dir === promoY) {
      for (const pr of ["Q", "R", "B", "N"] as PieceType[]) {
        push(x, y + dir, pr);
        for (const dx of [-1, 1]) {
          const t = inBoard(x + dx, y + dir) ? board[y + dir][x + dx] : null;
          if (t && t.color !== p.color)
            moves.push({ fromX: x, fromY: y, toX: x + dx, toY: y + dir, promotion: pr });
        }
      }
    } else {
      push(x, y + dir);
      if (y === startY && !board[y + dir][x]) push(x, y + 2 * dir);
      for (const dx of [-1, 1]) {
        if (!inBoard(x + dx, y + dir)) continue;
        const t = board[y + dir][x + dx];
        if (t && t.color !== p.color) add(x + dx, y + dir);
        else if (ep && ep.x === x + dx && ep.y === y + dir) add(x + dx, y + dir);
      }
    }
    return moves;
  }

  if (p.type === "N" || p.type === "K") {
    for (const [dx, dy] of p.type === "N" ? KNIGHT_D : KING_D)
      add(x + dx, y + dy);
    if (p.type === "K") {
      // Castling: king not in check, squares empty and unattacked.
      const homeY = p.color === "white" ? 7 : 0;
      const kq = p.color === "white" ? "wk" : "bk";
      const qq = p.color === "white" ? "wq" : "bq";
      const enemy = opposite(p.color);
      if (y === homeY && x === 4 && !inCheck(board, p.color)) {
        if (
          castling[kq] &&
          !board[homeY][5] && !board[homeY][6] &&
          !isSquareAttacked(board, 5, homeY, enemy) &&
          !isSquareAttacked(board, 6, homeY, enemy)
        )
          moves.push({ fromX: x, fromY: y, toX: 6, toY: homeY });
        if (
          castling[qq] &&
          !board[homeY][3] && !board[homeY][2] && !board[homeY][1] &&
          !isSquareAttacked(board, 3, homeY, enemy) &&
          !isSquareAttacked(board, 2, homeY, enemy)
        )
          moves.push({ fromX: x, fromY: y, toX: 2, toY: homeY });
      }
    }
    return moves;
  }

  const dirs =
    p.type === "R" ? ROOK_D : p.type === "B" ? BISHOP_D : [...ROOK_D, ...BISHOP_D];
  for (const [dx, dy] of dirs) {
    let nx = x + dx;
    let ny = y + dy;
    while (inBoard(nx, ny)) {
      const t = board[ny][nx];
      if (!t) moves.push({ fromX: x, fromY: y, toX: nx, toY: ny });
      else {
        if (t.color !== p.color)
          moves.push({ fromX: x, fromY: y, toX: nx, toY: ny });
        break;
      }
      nx += dx;
      ny += dy;
    }
  }
  return moves;
}

/** Fully legal moves for `turn`. */
export function legalMoves(
  board: Board,
  turn: Color,
  castling: CastlingRights,
  ep: { x: number; y: number } | null
): Move[] {
  const out: Move[] = [];
  for (let y = 0; y < 8; y++)
    for (let x = 0; x < 8; x++) {
      const p = board[y][x];
      if (!p || p.color !== turn) continue;
      for (const m of pseudoMoves(board, x, y, castling, ep)) {
        const { board: nb } = applyMove(board, m, castling, ep);
        if (!inCheck(nb, turn)) out.push(m);
      }
    }
  return out;
}

export function legalMovesForSquare(
  board: Board,
  turn: Color,
  x: number,
  y: number,
  castling: CastlingRights,
  ep: { x: number; y: number } | null
): Move[] {
  const p = board[y][x];
  if (!p || p.color !== turn) return [];
  return pseudoMoves(board, x, y, castling, ep).filter((m) => {
    const { board: nb } = applyMove(board, m, castling, ep);
    return !inCheck(nb, turn);
  });
}

export type GameResult =
  | { over: false }
  | { over: true; kind: "checkmate"; winner: Color }
  | { over: true; kind: "stalemate" | "fifty-move" | "insufficient-material"; winner: null };

function hasSufficientMaterial(board: Board): boolean {
  let minor = 0;
  for (const row of board)
    for (const p of row) {
      if (!p || p.type === "K") continue;
      if (p.type === "P" || p.type === "R" || p.type === "Q") return true;
      minor++;
    }
  return minor >= 2;
}

export function gameStatus(
  board: Board,
  turn: Color,
  castling: CastlingRights,
  ep: { x: number; y: number } | null,
  halfmove: number
): GameResult {
  const moves = legalMoves(board, turn, castling, ep);
  if (moves.length === 0) {
    if (inCheck(board, turn))
      return { over: true, kind: "checkmate", winner: opposite(turn) };
    return { over: true, kind: "stalemate", winner: null };
  }
  if (halfmove >= 100) return { over: true, kind: "fifty-move", winner: null };
  if (!hasSufficientMaterial(board))
    return { over: true, kind: "insufficient-material", winner: null };
  return { over: false };
}

/** Perft: count leaf nodes (for move-gen verification). */
export function perft(
  board: Board,
  turn: Color,
  castling: CastlingRights,
  ep: { x: number; y: number } | null,
  depth: number
): number {
  if (depth === 0) return 1;
  let nodes = 0;
  for (const m of legalMoves(board, turn, castling, ep)) {
    const r = applyMove(board, m, castling, ep);
    nodes += perft(r.board, opposite(turn), r.castling, r.ep, depth - 1);
  }
  return nodes;
}
