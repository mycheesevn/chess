import { PIECE_ART } from "@/lib/chess/pieceArt";
import type { Color, PieceType } from "@/lib/chess/types";

/**
 * Flat vector piece (the "green" board theme's piece set): bold-outline
 * Staunton shapes rendered from PIECE_ART path data in a 100×100 space.
 * White pieces are near-white with dark outlines; black pieces are
 * charcoal with light inner details — matching the reference set.
 */
const PALETTES: Record<
  Color,
  { fill: string; stroke: string; detail: string; dot: string }
> = {
  white: { fill: "#FAFAF7", stroke: "#24262B", detail: "#45484F", dot: "#24262B" },
  black: { fill: "#3F444A", stroke: "#14161A", detail: "#A8ADB4", dot: "#D5D8DC" },
};

export function VectorPiece({
  type,
  color,
}: {
  type: PieceType;
  color: Color;
}) {
  const c = PALETTES[color];
  const art = PIECE_ART[type];
  return (
    <>
      <g
        fill={c.fill}
        stroke={c.stroke}
        strokeWidth={3.3}
        strokeLinejoin="round"
        strokeLinecap="round"
      >
        {art.body.map((d, i) => (
          <path key={i} d={d} />
        ))}
      </g>
      <g
        fill="none"
        stroke={c.detail}
        strokeWidth={2.1}
        strokeLinecap="round"
      >
        {art.details.map((d, i) => (
          <path key={i} d={d} />
        ))}
      </g>
      <g fill={c.dot}>
        {art.dots.map((d, i) => (
          <path key={i} d={d} />
        ))}
      </g>
    </>
  );
}

/** A vector piece centered at (x, y) with the given on-board size. */
export function VectorPieceAt({
  type,
  color,
  x,
  y,
  size,
}: {
  type: PieceType;
  color: Color;
  x: number;
  y: number;
  size: number;
}) {
  return (
    <g
      transform={`translate(${x - size / 2} ${y - size / 2}) scale(${size / 100})`}
      style={{ pointerEvents: "none" }}
    >
      <VectorPiece type={type} color={color} />
    </g>
  );
}
