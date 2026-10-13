// Standard Forsyth-Edwards Notation (FEN) support for chess positions.
//
// The app board uses x = file 0..7 (a..h) and y = rank 0..7, where y = 0
// is rank 8. FEN lists rank 8 first, so its rows map directly to board
// rows in order.

import { INITIAL_CASTLING, initialBoard } from "./engine";
import type { Board, CastlingRights, Color, PieceType } from "./types";

export const STANDARD_START_FEN =
  "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

const FILES = "abcdefgh";
const PIECE_TYPES = "KQRBNP";

export interface ParsedFen {
  board: Board;
  turn: Color;
  castling: CastlingRights;
  ep: { x: number; y: number } | null;
  halfmove: number;
  fullmove: number;
  fen: string;
}

function emptyBoard(): Board {
  return Array.from({ length: 8 }, () => Array<null>(8).fill(null));
}

function squareName(x: number, y: number): string {
  return `${FILES[x]}${8 - y}`;
}

function parseSquare(square: string): { x: number; y: number } {
  if (!/^[a-h][1-8]$/.test(square)) throw new Error(`Invalid FEN square: ${square}`);
  return { x: FILES.indexOf(square[0]), y: 8 - Number(square[1]) };
}

/**
 * Castling rights that are actually available from the pieces on their
 * home squares. A FEN or an edited position should not retain a right if
 * the corresponding king or rook is absent.
 */
export function deriveCastling(board: Board): CastlingRights {
  const is = (x: number, y: number, type: string, color: Color) =>
    board[y]?.[x]?.type === type && board[y]?.[x]?.color === color;
  return {
    wk: is(4, 7, "K", "white") && is(7, 7, "R", "white"),
    wq: is(4, 7, "K", "white") && is(0, 7, "R", "white"),
    bk: is(4, 0, "K", "black") && is(7, 0, "R", "black"),
    bq: is(4, 0, "K", "black") && is(0, 0, "R", "black"),
  };
}

export function boardToFen(
  board: Board,
  turn: Color,
  castling: CastlingRights,
  ep: { x: number; y: number } | null,
  halfmove = 0,
  fullmove = 1
): string {
  const rows: string[] = [];
  for (let y = 0; y < 8; y++) {
    let row = "";
    let empty = 0;
    for (let x = 0; x < 8; x++) {
      const piece = board[y][x];
      if (!piece) {
        empty++;
        continue;
      }
      if (empty) {
        row += String(empty);
        empty = 0;
      }
      row += piece.color === "white" ? piece.type : piece.type.toLowerCase();
    }
    if (empty) row += String(empty);
    rows.push(row);
  }

  const castlingText =
    `${castling.wk ? "K" : ""}${castling.wq ? "Q" : ""}` +
    `${castling.bk ? "k" : ""}${castling.bq ? "q" : ""}`;
  const safeHalfmove = Number.isFinite(halfmove) ? Math.max(0, Math.floor(halfmove)) : 0;
  const safeFullmove = Number.isFinite(fullmove) ? Math.max(1, Math.floor(fullmove)) : 1;

  return [
    rows.join("/"),
    turn === "white" ? "w" : "b",
    castlingText || "-",
    ep ? squareName(ep.x, ep.y) : "-",
    String(safeHalfmove),
    String(safeFullmove),
  ].join(" ");
}

/** Serialize a board and side to move, deriving castling from home pieces. */
export function positionToFen(board: Board, turn: Color): string {
  return boardToFen(board, turn, deriveCastling(board), null, 0, 1);
}

export function parseFen(fen: string): ParsedFen {
  const fields = fen.trim().split(/\s+/);
  if (fields.length < 2 || fields.length > 6) {
    throw new Error("Invalid FEN: expected 2 to 6 fields");
  }

  const rows = fields[0].split("/");
  if (rows.length !== 8) throw new Error("Invalid FEN: board must have 8 ranks");

  const board = emptyBoard();
  for (let y = 0; y < 8; y++) {
    let x = 0;
    for (const ch of rows[y]) {
      if (/^[1-8]$/.test(ch)) {
        x += Number(ch);
        continue;
      }
      const type = ch.toUpperCase();
      if (!PIECE_TYPES.includes(type) || x >= 8) {
        throw new Error(`Invalid FEN piece: ${ch}`);
      }
      board[y][x] = {
        type: type as PieceType,
        color: ch === type ? "white" : "black",
      };
      x++;
    }
    if (x !== 8) throw new Error("Invalid FEN: each rank must contain 8 squares");
  }

  if (fields[1] !== "w" && fields[1] !== "b") {
    throw new Error("Invalid FEN: active color must be w or b");
  }
  const turn: Color = fields[1] === "w" ? "white" : "black";

  const available = deriveCastling(board);
  const castlingField = fields[2] ?? "-";
  if (castlingField !== "-" && !/^(?!.*(.).*\1)[KQkq]+$/.test(castlingField)) {
    throw new Error("Invalid FEN: castling field");
  }
  const castling: CastlingRights = {
    wk: available.wk && castlingField.includes("K"),
    wq: available.wq && castlingField.includes("Q"),
    bk: available.bk && castlingField.includes("k"),
    bq: available.bq && castlingField.includes("q"),
  };

  let ep: ParsedFen["ep"] = null;
  const epField = fields[3] ?? "-";
  if (epField !== "-") {
    ep = parseSquare(epField);
    // An en-passant target is on rank 6 (y=2) or rank 3 (y=5).
    if (ep.y !== 2 && ep.y !== 5) throw new Error("Invalid FEN: en-passant square");
  }

  const halfmove = fields[4] === undefined ? 0 : Number(fields[4]);
  const fullmove = fields[5] === undefined ? 1 : Number(fields[5]);
  if (!Number.isInteger(halfmove) || halfmove < 0) {
    throw new Error("Invalid FEN: halfmove clock");
  }
  if (!Number.isInteger(fullmove) || fullmove < 1) {
    throw new Error("Invalid FEN: fullmove number");
  }

  const canonical = boardToFen(board, turn, castling, ep, halfmove, fullmove);
  return { board, turn, castling, ep, halfmove, fullmove, fen: canonical };
}

/** Parse a stored start position, falling back safely to the standard start. */
export function startPositionFromFen(fen?: string | null): ParsedFen {
  if (!fen) return parseFen(STANDARD_START_FEN);
  try {
    return parseFen(fen);
  } catch {
    return parseFen(STANDARD_START_FEN);
  }
}

export function standardStartPosition(): ParsedFen {
  return {
    board: initialBoard(),
    turn: "white",
    castling: { ...INITIAL_CASTLING },
    ep: null,
    halfmove: 0,
    fullmove: 1,
    fen: STANDARD_START_FEN,
  };
}
