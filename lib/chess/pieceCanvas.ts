// Shared canvas piece renderer: draws the vector piece set (PIECE_ART
// via Path2D) on a 2D context. Used by the share card and the replay
// video so every exported image/video matches the in-app pieces.

import type { Color, PieceType } from "./types";
import { PIECE_ART } from "./pieceArt";

export const CANVAS_PALETTES: Record<
  Color,
  { fill: string; stroke: string; detail: string; dot: string }
> = {
  white: { fill: "#FCFCFA", stroke: "#191919", detail: "#191919", dot: "#191919" },
  black: { fill: "#26262A", stroke: "#26262A", detail: "#F2F2EE", dot: "#F2F2EE" },
};

/** Draw a piece centered at (cx, cy), `size` px tall/wide (art is 100×100). */
export function drawCanvasPiece(
  ctx: CanvasRenderingContext2D,
  type: PieceType,
  color: Color,
  cx: number,
  cy: number,
  size: number
) {
  const art = PIECE_ART[type];
  const pal = CANVAS_PALETTES[color];
  ctx.save();
  ctx.translate(cx - size / 2, cy - size / 2);
  ctx.scale(size / 100, size / 100);
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  for (const d of art.body) {
    const path = new Path2D(d);
    ctx.fillStyle = pal.fill;
    ctx.fill(path);
    ctx.strokeStyle = pal.stroke;
    ctx.lineWidth = 2.6;
    ctx.stroke(path);
  }
  ctx.strokeStyle = pal.detail;
  ctx.lineWidth = 2.1;
  for (const d of art.details) ctx.stroke(new Path2D(d));
  ctx.fillStyle = pal.dot;
  for (const d of art.dots) ctx.fill(new Path2D(d));
  if (color === "black" && art.onDark) {
    for (const d of art.onDark) ctx.fill(new Path2D(d));
  }
  ctx.restore();
}
