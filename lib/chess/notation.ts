// SAN (Standard Algebraic Notation) for the move list, localized.

import { legalMoves } from "./engine";
import { SAN_LETTERS } from "./i18n";
import {
  Board,
  CastlingRights,
  Color,
  Lang,
  Move,
  opposite,
} from "./types";

const FILES = "abcdefgh";

function square(x: number, y: number): string {
  return `${FILES[x]}${8 - y}`;
}

/**
 * SAN for `move` given the position *before* it was played.
 * `suffix` is "+" for check, "#" for checkmate, "" otherwise.
 */
export function toSAN(
  board: Board,
  move: Move,
  turn: Color,
  castling: CastlingRights,
  ep: { x: number; y: number } | null,
  lang: Lang,
  suffix: string
): string {
  const letters = SAN_LETTERS[lang];
  const piece = board[move.fromY][move.fromX];
  if (!piece) return square(move.toX, move.toY);

  // Castling.
  if (piece.type === "K" && Math.abs(move.toX - move.fromX) === 2) {
    return (move.toX === 6 ? "O-O" : "O-O-O") + suffix;
  }

  const target = board[move.toY][move.toX];
  const isEp =
    piece.type === "P" &&
    ep &&
    move.toX === ep.x &&
    move.toY === ep.y &&
    !target;
  const capture = target || isEp;

  if (piece.type === "P") {
    const s =
      (capture ? `${FILES[move.fromX]}x` : "") +
      square(move.toX, move.toY) +
      (move.promotion ? `=${letters[move.promotion] || move.promotion}` : "");
    return s + suffix;
  }

  const letter = letters[piece.type];
  // Disambiguation: other same-type pieces that can also reach the target.
  const others = legalMoves(board, turn, castling, ep).filter(
    (m) =>
      m.toX === move.toX &&
      m.toY === move.toY &&
      !(m.fromX === move.fromX && m.fromY === move.fromY) &&
      board[m.fromY][m.fromX]?.type === piece.type
  );
  let dis = "";
  if (others.length > 0) {
    const sameFile = others.some((m) => m.fromX === move.fromX);
    const sameRank = others.some((m) => m.fromY === move.fromY);
    if (!sameFile) dis = FILES[move.fromX];
    else if (!sameRank) dis = `${8 - move.fromY}`;
    else dis = square(move.fromX, move.fromY);
  }
  return `${letter}${dis}${capture ? "x" : ""}${square(move.toX, move.toY)}${suffix}`;
}

export function colorName(c: Color, lang: Lang): string {
  if (lang === "vi") return c === "white" ? "Trắng" : "Đen";
  return c === "white" ? "White" : "Black";
}

export { opposite };
