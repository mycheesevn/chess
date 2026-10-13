import { PIECE_ART } from "@/lib/chess/pieceArt";
import type { Color, PieceType } from "@/lib/chess/types";

/**
 * Flat vector piece (the "green" board theme's piece set): bold-outline
 * two-tone Staunton shapes traced from the user's reference set, rendered
 * from PIECE_ART path data in a 100×100 space. Layers: body (fill +
 * outline), details (thin inner lines), dots (filled marks shared by
 * both colors), onDark (filled marks only black pieces carry — the
 * knight's mane band). White pieces are near-white with a near-black
 * outline; black pieces are deep charcoal (the self-colored stroke grows
 * the traced interior silhouette to full size) with light marks.
 */
const PALETTES: Record<
  Color,
  { fill: string; stroke: string; detail: string; dot: string }
> = {
  white: {
    fill: "#FCFCFA",
    stroke: "#191919",
    detail: "#191919",
    dot: "#191919",
  },
  black: {
    fill: "#26262A",
    stroke: "#26262A",
    detail: "#F2F2EE",
    dot: "#F2F2EE",
  },
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
    <g>
      <g
        fill={c.fill}
        stroke={c.stroke}
        strokeWidth={2.6}
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
        {color === "black" &&
          art.onDark?.map((d, i) => <path key={`d${i}`} d={d} />)}
      </g>
    </g>
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
