// App icon: the SynerWork "S" (two shards, red/blue) flowing inside the
// knight silhouette from the game's own piece set. Final design (user
// picked 2026-10-13 after a contrast review): a DARK knight (#26262A,
// the black pieces' tone) on a LIGHT SAGE-GREEN ground (the green
// board theme, lightened), the S clipped inside the knight, light eye.
//
// Contrast rule: the piece and the ground must sit on opposite ends of
// the lightness scale. An earlier version painted a dark-slate panel
// over the whole knight interior on a near-black ground, which made
// the knight melt into the background — never paint the piece over
// with anything close to the ground colour.
//
// Variants:
// - rounded:  favicon / general use (transparent corners, framed)
// - bleed:    full-bleed square (apple touch icon — iOS applies its mask)
// - maskable: full-bleed with the artwork inside the maskable safe zone

import { PIECE_ART } from "./pieceArt";

export type IconVariant = "rounded" | "bleed" | "maskable";

const RED = '<polygon points="240,50 95,360 240,450" fill="#FF0000"/>';
const BLUE = '<polygon points="255,105 398,368 255,453" fill="#0000FF"/>';

export function chessIconSvg(variant: IconVariant = "rounded"): string {
  const knight = PIECE_ART.N.body.join(" ");
  const eye = PIECE_ART.N.dots[0];
  const bleed = variant !== "rounded";
  const frame = bleed
    ? { x: 0, y: 0, w: 512, rx: 0 }
    : { x: 6, y: 6, w: 500, rx: 112 };
  const contentScale = variant === "maskable" ? 0.82 : 1;
  const content = `
    <g transform="translate(30 8) scale(4.52)"><path d="${knight}" fill="#26262A"/></g>
    <g clip-path="url(#knightClip)">
      <g transform="translate(272 272) scale(0.95) translate(-247 -252)">${RED}${BLUE}</g>
    </g>
    <g transform="translate(30 8) scale(4.52)">
      <path d="${knight}" fill="none" stroke="#10141a" stroke-width="1.6"/>
      <path d="${eye}" fill="#EEEED2"/>
    </g>`;
  const scaled =
    contentScale === 1
      ? content
      : `<g transform="translate(256 256) scale(${contentScale}) translate(-256 -256)">${content}</g>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <defs>
    <clipPath id="iconClip"><rect x="${frame.x}" y="${frame.y}" width="${frame.w}" height="${frame.w}" rx="${frame.rx}"/></clipPath>
    <clipPath id="knightClip"><path transform="translate(30 8) scale(4.52)" d="${knight}"/></clipPath>
    <radialGradient id="bgGreen" cx="0.35" cy="0.3" r="1.1">
      <stop offset="0" stop-color="#C9D9B0"/><stop offset="1" stop-color="#A3BC85"/>
    </radialGradient>
  </defs>
  <rect x="${frame.x}" y="${frame.y}" width="${frame.w}" height="${frame.w}" rx="${frame.rx}" fill="url(#bgGreen)"/>
  <g clip-path="url(#iconClip)">${scaled}</g>
  ${bleed ? "" : '<rect x="6" y="6" width="500" height="500" rx="112" fill="none" stroke="#000000" stroke-opacity="0.35" stroke-width="4"/>'}
</svg>`;
}
