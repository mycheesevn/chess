// App icon: the SynerWork "S" (two shards, red/blue) flowing inside the
// knight silhouette from the game's own piece set, on a dark slate
// rounded square. The knight path comes straight from PIECE_ART so the
// icon can never drift from the in-game pieces.
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
    <g transform="translate(30 8) scale(4.52)"><path d="${knight}" fill="#EEEED2"/></g>
    <g clip-path="url(#knightClip)">
      <rect x="0" y="0" width="512" height="512" fill="#262f3a"/>
      <g transform="translate(272 272) scale(0.95) translate(-247 -252)">${RED}${BLUE}</g>
    </g>
    <g transform="translate(30 8) scale(4.52)">
      <path d="${knight}" fill="none" stroke="#10141a" stroke-width="1.6"/>
      <path d="${eye}" fill="#10141a"/>
    </g>`;
  const scaled =
    contentScale === 1
      ? content
      : `<g transform="translate(256 256) scale(${contentScale}) translate(-256 -256)">${content}</g>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <defs>
    <clipPath id="iconClip"><rect x="${frame.x}" y="${frame.y}" width="${frame.w}" height="${frame.w}" rx="${frame.rx}"/></clipPath>
    <clipPath id="knightClip"><path transform="translate(30 8) scale(4.52)" d="${knight}"/></clipPath>
    <radialGradient id="bgDark" cx="0.35" cy="0.3" r="1.1">
      <stop offset="0" stop-color="#232b36"/><stop offset="1" stop-color="#10141a"/>
    </radialGradient>
  </defs>
  <rect x="${frame.x}" y="${frame.y}" width="${frame.w}" height="${frame.w}" rx="${frame.rx}" fill="url(#bgDark)"/>
  <g clip-path="url(#iconClip)">${scaled}</g>
  ${bleed ? "" : '<rect x="6" y="6" width="500" height="500" rx="112" fill="none" stroke="#000000" stroke-opacity="0.35" stroke-width="4"/>'}
</svg>`;
}
