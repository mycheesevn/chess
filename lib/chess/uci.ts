// UCI move serialization for realtime sync: "e2e4", "e7e8q".

import type { Move, PieceType } from "./types";

const FILES = "abcdefgh";

export function moveToUci(m: Move): string {
  const promo = m.promotion ? m.promotion.toLowerCase() : "";
  return (
    FILES[m.fromX] + (8 - m.fromY) + FILES[m.toX] + (8 - m.toY) + promo
  );
}

export function uciToMove(uci: string): Move {
  const fromX = FILES.indexOf(uci[0]);
  const fromY = 8 - parseInt(uci[1], 10);
  const toX = FILES.indexOf(uci[2]);
  const toY = 8 - parseInt(uci[3], 10);
  const promotion = (uci[4]?.toUpperCase() as PieceType | undefined) || undefined;
  return { fromX, fromY, toX, toY, promotion };
}
