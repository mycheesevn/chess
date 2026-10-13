import type { PieceType } from "./types";

/**
 * Flat vector piece art (Staunton-style, bold outline — the style of the
 * reference set the user picked). Every shape is a path string in a
 * 100×100 local space, ground line at y≈92. Three layers per piece:
 * - body: filled silhouette paths (main fill + outline stroke)
 * - details: stroke-only inner lines (mane, bishop slit, crown arcs…)
 * - dots: small filled accents (eyes, nostrils, crown jewel)
 * Colors are applied by the renderer per side, so one art set serves
 * both white and black pieces.
 */
export interface PieceArt {
  body: string[];
  details: string[];
  dots: string[];
}

/** Shared plinth for the major pieces (K/Q/R/B): collar + foot. */
const MAJOR_BASE: string[] = [
  // collar
  "M25 78 h50 v3 a3 3 0 0 1 -3 3 H28 a3 3 0 0 1 -3 -3 Z",
  // foot
  "M20 84 h60 v3 a5 5 0 0 1 -5 5 H25 a5 5 0 0 1 -5 -5 Z",
];

export const PIECE_ART: Record<PieceType, PieceArt> = {
  P: {
    body: [
      // head
      "M37 38 a13 13 0 1 0 26 0 a13 13 0 1 0 -26 0 Z",
      // collar under the head
      "M35 57 C35 52.5 42 50.5 50 50.5 C58 50.5 65 52.5 65 57 C65 60.5 58 62 50 62 C42 62 35 60.5 35 57 Z",
      // skirt
      "M40 62 C38 69 35 74 31.5 79 L68.5 79 C65 74 62 69 60 62 C56.5 64.5 43.5 64.5 40 62 Z",
      // foot
      "M27 79 h46 v4 a5 5 0 0 1 -5 5 H32 a5 5 0 0 1 -5 -5 Z",
    ],
    details: ["M38.5 57 C43.5 60 56.5 60 61.5 57"],
    dots: [],
  },
  R: {
    body: [
      // battlements
      "M31 33 V15 h8.5 v6.5 h7 V15 h7 v6.5 h7 V15 H69 V33 Z",
      // ring under the battlements
      "M28 33 h44 v6.5 H28 Z",
      // tapered body
      "M33.5 39.5 C34.5 52 35.5 66 36.5 78 L63.5 78 C64.5 66 65.5 52 66.5 39.5 Z",
      ...MAJOR_BASE,
    ],
    details: ["M37 26.5 h26"],
    dots: [],
  },
  B: {
    body: [
      // ball on top
      "M45.5 10.5 a4.5 4.5 0 1 0 9 0 a4.5 4.5 0 1 0 -9 0 Z",
      // mitre
      "M50 17 C58.5 27 64.5 35.5 64.5 46 C64.5 55 58 60.5 50 60.5 C42 60.5 35.5 55 35.5 46 C35.5 35.5 41.5 27 50 17 Z",
      // collar
      "M33 60.5 h34 v6 H33 Z",
      // body
      "M37 66.5 C38 71 39 74.5 40 78 L60 78 C61 74.5 62 71 63 66.5 Z",
      ...MAJOR_BASE,
    ],
    details: [
      // the mitre slit
      "M44.5 30 C47.5 36 51 40 55.5 43.5",
      // lower arc
      "M41 52 C45 55.5 55 55.5 59 52",
    ],
    dots: [],
  },
  N: {
    body: [
      // horse profile, facing left: long muzzle, ear spike, swept mane
      "M34 84 C33 74 34 66 40 60 C32 58 27 54 24 50 C22 47 22 44 24 42 L30 30 L37 18 L41 26 C44 16 50 12 56 13 C68 16 76 26 77 38 C77 46 74 52 70 56 C78 64 80 74 79 84 Z",
      // foot
      "M22 84 h56 v3 a5 5 0 0 1 -5 5 H27 a5 5 0 0 1 -5 -5 Z",
    ],
    details: [
      // mane lines
      "M58 22 C64 28 66 36 65 44",
      "M66 30 C70 36 71 42 69 48",
      // mouth line
      "M24.5 50.5 C27.5 52.5 30.5 53 33.5 52.5",
    ],
    dots: [
      // eye
      "M35.7 36 a2.3 2.3 0 1 0 4.6 0 a2.3 2.3 0 1 0 -4.6 0 Z",
      // nostril
      "M25.4 46.5 a1.6 1.6 0 1 0 3.2 0 a1.6 1.6 0 1 0 -3.2 0 Z",
    ],
  },
  Q: {
    body: [
      // crown spikes
      "M24.5 40 L21.5 19 L32.5 28.5 L37.5 14.5 L45.5 25.5 L50 13 L54.5 25.5 L62.5 14.5 L67.5 28.5 L78.5 19 L75.5 40 Z",
      // spike tip balls
      "M18.4 16.5 a3.1 3.1 0 1 0 6.2 0 a3.1 3.1 0 1 0 -6.2 0 Z",
      "M34.4 12 a3.1 3.1 0 1 0 6.2 0 a3.1 3.1 0 1 0 -6.2 0 Z",
      "M46.9 10.5 a3.1 3.1 0 1 0 6.2 0 a3.1 3.1 0 1 0 -6.2 0 Z",
      "M59.4 12 a3.1 3.1 0 1 0 6.2 0 a3.1 3.1 0 1 0 -6.2 0 Z",
      "M75.4 16.5 a3.1 3.1 0 1 0 6.2 0 a3.1 3.1 0 1 0 -6.2 0 Z",
      // crown band
      "M24.5 40 h51 v6 h-51 Z",
      // body
      "M28.5 46 C30.5 58 33.5 69 36.5 78 L63.5 78 C66.5 69 69.5 58 71.5 46 Z",
      ...MAJOR_BASE,
    ],
    details: [],
    dots: [
      // center jewel
      "M47.4 33 a2.6 2.6 0 1 0 5.2 0 a2.6 2.6 0 1 0 -5.2 0 Z",
    ],
  },
  K: {
    body: [
      // cross
      "M46.8 5 h6.4 v5.5 h5.8 v6.4 h-5.8 V23 h-6.4 v-6.1 H41 v-6.4 h5.8 Z",
      // scalloped crown
      "M27 36 C27 27.5 33 24.5 38.5 29.5 C42 25.5 46 24 50 26.5 C54 24 58 25.5 61.5 29.5 C67 24.5 73 27.5 73 36 C73 45.5 65.5 51.5 50 51.5 C34.5 51.5 27 45.5 27 36 Z",
      // band
      "M27 51.5 h46 v6 H27 Z",
      // body
      "M31 57.5 C33 64.5 35 71.5 37 78 L63 78 C65 71.5 67 64.5 69 57.5 Z",
      ...MAJOR_BASE,
    ],
    details: ["M35.5 40 C41 35.5 59 35.5 64.5 40"],
    dots: [],
  },
};
