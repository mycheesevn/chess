import { deriveCastling } from "./fen";
import { gameStatus, inCheck } from "./engine";
import { opposite, type Board, type Color, type PieceType } from "./types";

export type SetupError =
  | "kings"
  | "pawns"
  | "kingsAdjacent"
  | "opponentInCheck"
  | "material"
  | "finished";

export function emptyBoard(): Board {
  return Array.from({ length: 8 }, () => Array<null>(8).fill(null));
}

export function cloneBoard(board: Board): Board {
  return board.map((row) => row.slice());
}

interface KingPosition {
  x: number;
  y: number;
}

/**
 * Validate a manually arranged position before it is handed to the engine.
 * Castling is derived from the king/rook home squares (see fen.ts), and
 * there is no en-passant target in a newly arranged position.
 */
export function validateSetup(board: Board, turn: Color): SetupError | null {
  const kings: Partial<Record<Color, KingPosition[]>> = {};
  const totals: Record<Color, number> = { white: 0, black: 0 };
  const pawns: Record<Color, number> = { white: 0, black: 0 };

  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      const piece = board[y]?.[x];
      if (!piece) continue;
      totals[piece.color]++;
      if (piece.type === "P") {
        pawns[piece.color]++;
        // A pawn on its own promotion rank (or the opponent's home rank)
        // could never occur in a legal game and cannot move normally.
        if (y === 0 || y === 7) return "pawns";
      }
      if (piece.type === "K") {
        (kings[piece.color] ??= []).push({ x, y });
      }
    }
  }

  if (kings.white?.length !== 1 || kings.black?.length !== 1) return "kings";
  if (
    totals.white > 16 ||
    totals.black > 16 ||
    pawns.white > 8 ||
    pawns.black > 8
  ) {
    return "material";
  }

  const whiteKing = kings.white[0];
  const blackKing = kings.black[0];
  if (
    Math.max(Math.abs(whiteKing.x - blackKing.x), Math.abs(whiteKing.y - blackKing.y)) <= 1
  ) {
    return "kingsAdjacent";
  }

  // The player who supposedly just moved cannot have ended their turn
  // with their own king attacked. Equivalently, at the start of a turn
  // only the side to move may be in check.
  if (inCheck(board, opposite(turn))) return "opponentInCheck";

  // Do not launch the game screen only to show an already-decided game
  // (checkmate, stalemate, the fifty-move rule, or insufficient material).
  const status = gameStatus(board, turn, deriveCastling(board), null, 0);
  if (status.over) return "finished";

  return null;
}

export const SETUP_PIECE_ORDER: PieceType[] = ["K", "Q", "R", "B", "N", "P"];
