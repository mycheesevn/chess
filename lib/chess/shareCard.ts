// Canvas share card: renders the chess board + result headline to a PNG.
// Pieces are drawn from the same vector path data as the in-app board
// (PIECE_ART via Path2D), so the card matches the game's piece set.

import type { Board as BoardT, Color, PieceType } from "./types";
import { PIECE_ART } from "./pieceArt";

const CARD_PALETTES: Record<
  Color,
  { fill: string; stroke: string; detail: string; dot: string }
> = {
  white: { fill: "#FCFCFA", stroke: "#191919", detail: "#191919", dot: "#191919" },
  black: { fill: "#26262A", stroke: "#26262A", detail: "#F2F2EE", dot: "#F2F2EE" },
};

function drawCardPiece(
  ctx: CanvasRenderingContext2D,
  type: PieceType,
  color: Color,
  cx: number,
  cy: number,
  size: number
) {
  const art = PIECE_ART[type];
  const pal = CARD_PALETTES[color];
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

const SIZE = 1080;
const BOARD_PAD = 90;
const BOARD_SIZE = SIZE - BOARD_PAD * 2;
const CELL = BOARD_SIZE / 8;

const LIGHT = "#f0d9b5";
const DARK = "#b58863";

export interface ShareCardOpts {
  board: BoardT;
  playerColor: Color;
  headline: string; // e.g. "Checkmate! You won"
  subline: string; // e.g. "Beat Level 5 · 34 moves"
  appName: string;
  appUrl: string;
}

export async function renderShareCard(opts: ShareCardOpts): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext("2d")!;

  // Background
  const bg = ctx.createLinearGradient(0, 0, 0, SIZE);
  bg.addColorStop(0, "#1c2530");
  bg.addColorStop(1, "#101418");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, SIZE, SIZE);

  // Headline
  ctx.fillStyle = "#f0e9d8";
  ctx.font = "bold 64px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(opts.headline, SIZE / 2, 110);

  ctx.fillStyle = "#a8b0bc";
  ctx.font = "40px system-ui, sans-serif";
  ctx.fillText(opts.subline, SIZE / 2, 165);

  // Board (flip if player is black so their pieces are at bottom)
  const flipped = opts.playerColor === "black";
  const bx = BOARD_PAD;
  const by = 210;

  for (let ry = 0; ry < 8; ry++) {
    for (let rx = 0; rx < 8; rx++) {
      const x = flipped ? 7 - rx : rx;
      const y = flipped ? 7 - ry : ry;
      ctx.fillStyle = (rx + ry) % 2 === 0 ? LIGHT : DARK;
      ctx.fillRect(bx + rx * CELL, by + ry * CELL, CELL, CELL);
      const p = opts.board[y][x];
      if (p) {
        drawCardPiece(
          ctx,
          p.type,
          p.color,
          bx + rx * CELL + CELL / 2,
          by + ry * CELL + CELL / 2,
          CELL * 0.92
        );
      }
    }
  }

  // Board frame
  ctx.strokeStyle = "#e0a32e";
  ctx.lineWidth = 6;
  ctx.strokeRect(bx, by, BOARD_SIZE, BOARD_SIZE);

  // Footer
  ctx.fillStyle = "#a8b0bc";
  ctx.font = "32px system-ui, sans-serif";
  ctx.fillText(`${opts.appName} · ${opts.appUrl}`, SIZE / 2, SIZE - 40);

  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob failed"))), "image/png");
  });
}

export async function shareCard(blob: Blob, title: string, text: string, url: string) {
  const file = new File([blob], "chess-result.png", { type: "image/png" });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    await navigator.share({ files: [file], title, text, url });
    return "shared";
  }
  // Fallback: download + copy link
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "chess-result.png";
  a.click();
  try {
    await navigator.clipboard.writeText(`${text} ${url}`);
  } catch {
    /* clipboard unavailable */
  }
  return "downloaded";
}
