import { useId } from "react";
import { PIECE_ART } from "@/lib/chess/pieceArt";
import type { Color, PieceType } from "@/lib/chess/types";

/**
 * Flat vector piece (the "green" board theme's piece set): Staunton shapes
 * traced from the user's reference set, rendered from PIECE_ART path data
 * in a 100×100 space. Layers: body (fill + outline), shade (soft right
 * facet), details (thin inner lines), dots, and an optional mask cut-out
 * (the bishop's slit shows the square beneath). White pieces are
 * near-white with a soft dark-gray outline; black pieces are neutral
 * charcoal with a lighter shade facet and details.
 */
const PALETTES: Record<
  Color,
  { fill: string; stroke: string; shade: string; detail: string; dot: string }
> = {
  white: {
    fill: "#FBFBF8",
    stroke: "#3D3D40",
    shade: "#DCDCD4",
    detail: "#7C7C76",
    dot: "#3D3D40",
  },
  black: {
    fill: "#4B4B4E",
    stroke: "#16161A",
    shade: "#67676D",
    detail: "#A3A3A9",
    dot: "#D8D8DC",
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
  const maskId = useId();
  return (
    <>
      {art.cut && (
        <mask id={maskId} maskUnits="userSpaceOnUse">
          <rect x="0" y="0" width="100" height="100" fill="white" />
          <path d={art.cut} fill="black" />
        </mask>
      )}
      <g mask={art.cut ? `url(#${maskId})` : undefined}>
        <g
          fill={c.fill}
          stroke={c.stroke}
          strokeWidth={3}
          strokeLinejoin="round"
          strokeLinecap="round"
        >
          {art.body.map((d, i) => (
            <path key={i} d={d} />
          ))}
        </g>
        <g fill={c.shade}>
          {art.shade.map((d, i) => (
            <path key={i} d={d} />
          ))}
        </g>
        <g
          fill="none"
          stroke={c.detail}
          strokeWidth={1.9}
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
