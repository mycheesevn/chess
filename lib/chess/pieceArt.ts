import type { PieceType } from "./types";

/**
 * Flat vector piece art traced from the user's reference set: rounded dome
 * plinth on every major piece, a bell-bodied pawn, a flame mitre with a
 * true cut-out slit for the bishop, five balled points for the queen, twin
 * petal lines for the king, and a long elegant left-facing knight. Every
 * shape is a path string in a 100×100 local space, ground line at y = 93.
 * Layers per piece:
 * - body: filled silhouette paths (main fill + outline stroke)
 * - shade: soft facet on the right side of the piece (fill only, no stroke)
 * - details: stroke-only inner lines (petals, crown grooves, mouth…)
 * - dots: small filled accents (the knight's eye)
 * - cut: a shape knocked OUT of the body via an SVG mask (bishop slit —
 *   the square shows through, exactly like the reference)
 * Colors are applied by the renderer per side, so one art set serves
 * both white and black pieces.
 */
export interface PieceArt {
  body: string[];
  shade: string[];
  details: string[];
  dots: string[];
  cut?: string;
}

/** A circle drawn as a path so it can join the stroked body layer. */
function circ(cx: number, cy: number, r: number): string {
  return `M${cx - r} ${cy} a${r} ${r} 0 1 0 ${2 * r} 0 a${r} ${r} 0 1 0 ${-2 * r} 0`;
}

// Shared dome plinth: flat bottom on the ground line, gently domed top
// whose seam stays visible in front of the piece body — the base reads as
// a separate cap, exactly like the reference set.
const PLINTH =
  "M13 93 L87 93 C89.5 93 90.5 90.5 90 86.5 C89.5 79.5 85 74.8 77 73.8 " +
  "C60 70.8 40 70.8 23 73.8 C15 74.8 10.5 79.5 10 86.5 C9.5 90.5 10.5 93 13 93 Z";
const PLINTH_SHADE =
  "M77 73.8 C85 74.8 89.5 79.5 90 86.5 C90.5 90.5 89.5 93 87 93 L71 93 " +
  "C75.5 87 77.5 80.5 77 73.8 Z";
const PLINTH_GROOVE = "M13.5 85.8 C35 83 65 83 86.5 85.8";

export const PIECE_ART: Record<PieceType, PieceArt> = {
  P: {
    // Ball head over a pinched neck, small collar, then a smooth bell that
    // IS the base (the reference pawn has no separate plinth).
    body: [
      circ(50, 28, 13.5),
      "M42 42.5 C45 45.5 47.5 46.8 50 46.8 C52.5 46.8 55 45.5 58 42.5 " +
        "C60.5 45.5 62 48.8 62 52 L61.2 55.5 C55 62 64 70 69 78 " +
        "C73 84.5 75.5 89 76 93 L24 93 C24.5 89 27 84.5 31 78 " +
        "C36 70 45 62 38.8 55.5 L38 52 C38 48.8 39.5 45.5 42 42.5 Z",
    ],
    shade: ["M57 50 C64 58 70.5 70 74.5 87 L65 88.5 C61.5 74 55.5 61 49.5 54.5 Z"],
    details: ["M39 55.5 C45 58.2 55 58.2 61 55.5"],
    dots: [],
  },

  R: {
    // Three-merlon battlement, a tower that tapers as it falls, dome plinth.
    body: [
      "M23 14 L37 14 L37 22.5 L45 22.5 L45 14 L55 14 L55 22.5 L63 22.5 L63 14 " +
        "L77 14 L76.2 29 C76 32.3 74.6 33.8 72 34.3 C71.2 47.5 69.8 60.5 68.2 73.5 " +
        "L31.8 73.5 C30.2 60.5 28.8 47.5 28 34.3 C25.4 33.8 24 32.3 23.8 29 Z",
      PLINTH,
    ],
    shade: [
      "M72 34.3 C71.2 47.5 69.8 60.5 68.2 73.5 L59.5 73.5 " +
        "C61 60 62 47 62.8 34.8 Z",
      PLINTH_SHADE,
    ],
    details: ["M26.5 30.5 C42 32.8 58 32.8 73.5 30.5", PLINTH_GROOVE],
    dots: [],
  },

  N: {
    // Long-necked knight facing left: sloped forehead to a rounded muzzle,
    // one smooth convex mane sweeping down to the plinth.
    body: [
      "M57.2 7.4 C60.4 13.6 64.8 19.8 69.3 27 C77.8 40.2 84.2 56 84.6 73.5 " +
        "L50 73.5 C43 66 37.5 61 35 57 C28 52.5 20.5 50.8 15.5 47.8 " +
        "C12.3 45.9 11 44.3 11.3 42 C11.6 39.6 13.8 37.2 17.8 34.4 " +
        "C26 28.6 33 22.8 41 16.8 C46.5 12.8 52 9.6 57.2 7.4 Z",
      PLINTH,
    ],
    shade: [
      "M69.3 27 C77.8 40.2 84.2 56 84.6 73.5 L74.5 73.5 " +
        "C73.8 57 71 41.5 64.8 29 Z",
      PLINTH_SHADE,
    ],
    details: [
      // Nostril + mouth line.
      "M17.8 40.8 C19.3 39.9 20.8 39.7 22.3 40.2",
      "M20.5 47.8 C23.5 49.8 26.5 50.6 29.5 50.2",
      PLINTH_GROOVE,
    ],
    dots: [circ(39.5, 24.5, 2.7)],
  },

  B: {
    // Flame/onion mitre with a knob tip; the slit is a true cut-out (mask).
    body: [
      circ(52, 9.5, 4.6),
      "M52 13.5 C47 20 40.5 26 35 34 C28.5 43 26.2 52 29.7 59.2 " +
        "C32.2 64.6 36 67.2 40 68.7 L35.8 68.7 C33.2 71.2 33.2 74 35.8 76.3 " +
        "L64.2 76.3 C66.8 74 66.8 71.2 64.2 68.7 L60 68.7 C65 66.8 69.6 62.6 71.6 56.6 " +
        "C74.6 47.2 72.2 36.2 65.7 26.7 C61.7 20.8 56.7 15.8 52 13.5 Z",
      PLINTH,
    ],
    shade: [
      "M64 25 C71 34.5 74.3 46.8 71.6 56.6 C69.6 62.6 65 66.8 60 68.7 L55.5 68.7 " +
        "C61.5 55 63.8 38.5 64 25 Z",
      PLINTH_SHADE,
    ],
    details: [PLINTH_GROOVE],
    dots: [],
    cut:
      "M61.5 20.5 C57.8 30 55.3 39.8 56.2 49.5 C56.6 53.4 58.3 56 60.2 56.8 " +
      "C62.2 49.8 62.8 38.5 62.4 28.6 C62.2 25.4 62 22.7 61.5 20.5 Z",
  },

  Q: {
    // Five spikes tipped with balls fanning from a wide crown, dome plinth.
    body: [
      circ(15, 30, 6.3),
      circ(31, 18.5, 6.3),
      circ(50, 12, 6.8),
      circ(69, 18.5, 6.3),
      circ(85, 30, 6.3),
      "M12.5 38 C19 32.5 24 33.5 29 27 C35.5 31 41.5 24.5 45.5 19.8 " +
        "C47.5 19.2 52.5 19.2 54.5 19.8 C58.5 24.5 64.5 31 71 27 " +
        "C76 33.5 81 32.5 87.5 38 C83 50 78.3 60.8 74.8 71 L25.2 71 " +
        "C21.7 60.8 17 50 12.5 38 Z",
      PLINTH,
    ],
    shade: [
      "M69.2 27.5 C74.5 34.5 81 32.5 87.5 38 C83 50 78.3 60.8 74.8 71 L64 71 " +
        "C68 58.5 69.8 42.5 69.2 27.5 Z",
      PLINTH_SHADE,
    ],
    details: [
      "M40.5 34.5 C41.3 46 42 58 42.4 70",
      "M59.5 34.5 C58.7 46 58 58 57.6 70",
      PLINTH_GROOVE,
    ],
    dots: [],
  },

  K: {
    // Cross-topped crown: two broad lobes with twin petal lines inside.
    body: [
      "M46.5 20.5 L46.5 15.8 L40 15.8 L40 8.8 L46.5 8.8 L46.5 3.2 L53.5 3.2 " +
        "L53.5 8.8 L60 8.8 L60 15.8 L53.5 15.8 L53.5 20.5 Z",
      "M50 21 C43 24.5 33 26.5 25.5 31 C15.5 36.3 10.8 45 12.6 54 " +
        "C14.2 63 20.8 69.2 28.5 71.2 L71.5 71.2 C79.2 69.2 85.8 63 87.4 54 " +
        "C89.2 45 84.5 36.3 74.5 31 C67 26.5 57 24.5 50 21 Z",
      PLINTH,
    ],
    shade: [
      "M74.5 31 C84.5 36.3 89.2 45 87.4 54 C85.8 63 79.2 69.2 71.5 71.2 " +
        "L62 71.2 C68.5 59.5 72.8 45.8 74.5 31 Z",
      PLINTH_SHADE,
    ],
    details: [
      "M39.5 33.5 C34 34 30.8 38.6 31.6 44.4 C32.4 50.6 37.4 56.4 42.8 58 " +
        "C46.8 59.1 49.3 55.9 48.9 50 C48.5 43.4 45.6 36.2 39.5 33.5 Z",
      "M60.5 33.5 C66 34 69.2 38.6 68.4 44.4 C67.6 50.6 62.6 56.4 57.2 58 " +
        "C53.2 59.1 50.7 55.9 51.1 50 C51.5 43.4 54.4 36.2 60.5 33.5 Z",
      PLINTH_GROOVE,
    ],
    dots: [],
  },
};
