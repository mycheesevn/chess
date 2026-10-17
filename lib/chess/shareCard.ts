// Canvas share card: renders the chess board + result headline to a PNG.
// Pieces are drawn from the same vector path data as the in-app board
// (PIECE_ART via Path2D), so the card matches the game's piece set.

import type { Board as BoardT, Color } from "./types";
import { drawCanvasPiece } from "./pieceCanvas";

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
        drawCanvasPiece(
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

export async function shareCard(
  blob: Blob,
  title: string,
  text: string,
  url: string,
  fileName = "chess-result.png"
) {
  const file = new File([blob], fileName, { type: "image/png" });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    await navigator.share({ files: [file], title, text, url });
    return "shared";
  }
  // Fallback: download + copy link
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = fileName;
  a.click();
  try {
    await navigator.clipboard.writeText(`${text} ${url}`);
  } catch {
    /* clipboard unavailable */
  }
  return "downloaded";
}

// ---------------------------------------------------------------------------
// Room promo card (ported from PacClone's renderRoomPromoCard, Chess branding)
// ---------------------------------------------------------------------------

export interface RoomPromoInput {
  /** Room display name. */
  roomName: string;
  /** Join code, e.g. "X7K2P". */
  code: string;
  /** "Phòng có 3 thành viên" style member line. */
  memberLine: string;
  /** Footer CTA, e.g. "👉 Thách đấu ngay tại chess.synerworlds.com". */
  footer: string;
  lang: "vi" | "en";
}

/** Convert a canvas to a PNG Blob. */
export function canvasToPngBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("toBlob failed"))),
      "image/png"
    );
  });
}

function roundRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/**
 * Render a shareable room-promo card (no board, big join code) to a canvas.
 * Same anatomy as PacClone's card: branded header, room name + member line,
 * giant code panel, decorative piece medallions, footer CTA — plus the
 * SynerWork "S" mark (two red/blue shards) under the code panel.
 */
export function renderRoomPromoCard(input: RoomPromoInput): HTMLCanvasElement {
  const W = 1080;
  const H = 1350;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;

  // Background: deep green gradient (chess board green theme).
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, "#1d3a24");
  bg.addColorStop(0.5, "#142a18");
  bg.addColorStop(1, "#0d1c10");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // Gold frame.
  ctx.strokeStyle = "#d4a017";
  ctx.lineWidth = 6;
  ctx.strokeRect(18, 18, W - 36, H - 36);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  // Header.
  ctx.fillStyle = "#f3d27a";
  ctx.font = "700 72px Georgia, 'Times New Roman', serif";
  ctx.fillText("♟ CỜ VUA", W / 2, 110);
  ctx.fillStyle = "#ffffff";
  ctx.font = "600 52px system-ui, sans-serif";
  const name =
    input.roomName.length > 28 ? input.roomName.slice(0, 27) + "…" : input.roomName;
  ctx.fillText(name, W / 2, 205, W - 120);
  ctx.fillStyle = "#e8d9b0";
  ctx.font = "400 36px system-ui, sans-serif";
  ctx.fillText(input.memberLine, W / 2, 270, W - 120);

  // Big code panel.
  const pw = 720;
  const ph = 420;
  const px = (W - pw) / 2;
  const py = 370;
  ctx.fillStyle = "#f0d9a8";
  roundRectPath(ctx, px, py, pw, ph, 24);
  ctx.fill();
  ctx.strokeStyle = "#d4a017";
  ctx.lineWidth = 4;
  roundRectPath(ctx, px, py, pw, ph, 24);
  ctx.stroke();
  ctx.fillStyle = "#5d3a1a";
  ctx.font = "600 40px system-ui, sans-serif";
  ctx.fillText(input.lang === "vi" ? "MÃ PHÒNG" : "ROOM CODE", W / 2, py + 88);
  ctx.fillStyle = "#1a1a1a";
  ctx.font = "800 130px system-ui, sans-serif";
  ctx.fillText(input.code, W / 2, py + 228);
  ctx.fillStyle = "#5d3a1a";
  ctx.font = "400 32px system-ui, sans-serif";
  ctx.fillText(
    input.lang === "vi" ? "Nhập mã để vào phòng" : "Enter the code to join",
    W / 2,
    py + 348
  );

  // Decorative chess-piece medallions.
  const pieces: Array<[string, string]> = [
    ["♞", "#2c2c2c"],
    ["♜", "#8b1a1a"],
    ["♝", "#2c2c2c"],
  ];
  ctx.font = "700 64px serif";
  pieces.forEach(([ch, col], i) => {
    const cx = W / 2 + (i - 1) * 170;
    const cy = 935;
    ctx.beginPath();
    ctx.arc(cx, cy, 52, 0, Math.PI * 2);
    ctx.fillStyle = "#f7e9c4";
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = "#1d3a24";
    ctx.stroke();
    ctx.fillStyle = col;
    ctx.fillText(ch, cx, cy + 2);
  });

  // SynerWork "S" mark (two shards: red + blue) under the medallions.
  const sCx = W / 2;
  const sCy = 1062;
  const sS = 34;
  const shard = (
    pts: Array<[number, number]>,
    color: string
  ) => {
    ctx.beginPath();
    pts.forEach(([qx, qy], k) => {
      const x = sCx + (qx - 247) * (sS / 500);
      const y = sCy + (qy - 252) * (sS / 500);
      if (k === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
  };
  shard(
    [[240, 50], [95, 360], [240, 450]],
    "#FF0000"
  );
  shard(
    [[255, 105], [398, 368], [255, 453]],
    "#0000FF"
  );
  ctx.fillStyle = "#8a9a86";
  ctx.font = "400 26px system-ui, sans-serif";
  ctx.fillText("SynerWork Inc.", W / 2, sCy + 52);

  // Footer CTA.
  ctx.fillStyle = "#ffd43b";
  ctx.font = "600 40px system-ui, sans-serif";
  ctx.fillText(input.footer, W / 2, 1200, W - 120);

  return canvas;
}
