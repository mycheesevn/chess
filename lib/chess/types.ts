// Core chess types. Coordinates: x = file 0..7 (a..h), y = rank 0..7
// where y = 0 is rank 8 (Black's back rank) and y = 7 is rank 1.

export type Color = "white" | "black";
export type PieceType = "K" | "Q" | "R" | "B" | "N" | "P";

export interface Piece {
  type: PieceType;
  color: Color;
}

export type Board = (Piece | null)[][];

export interface CastlingRights {
  wk: boolean;
  wq: boolean;
  bk: boolean;
  bq: boolean;
}

export interface Move {
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  promotion?: PieceType;
}

export type Level = number;
export type Lang = "en" | "vi";

export const GLYPHS: Record<PieceType, string> = {
  K: "♚",
  Q: "♛",
  R: "♜",
  B: "♝",
  N: "♞",
  P: "♟",
};

export function opposite(c: Color): Color {
  return c === "white" ? "black" : "white";
}

export function inBoard(x: number, y: number): boolean {
  return x >= 0 && x < 8 && y >= 0 && y < 8;
}
