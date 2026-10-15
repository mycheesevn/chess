// Replay-to-video export: re-render a game on canvas with move
// animations, capture it with canvas.captureStream + MediaRecorder,
// and return a video file. Fully client-side; Safari records MP4,
// Chrome records WebM. Standard design: boardgame-engagement skill,
// references/replay-video.md (ported from PacClone).

import {
  applyMove,
  gameStatus,
  inCheck,
  initialBoard,
  INITIAL_CASTLING,
} from "./engine";
import { uciToMove } from "./uci";
import { toSAN } from "./notation";
import { drawCanvasPiece } from "./pieceCanvas";
import { synthCapture, synthCheck, synthMove, synthMoveStart } from "./sound";
import { STR } from "./i18n";
import {
  opposite,
  type Board as BoardT,
  type CastlingRights,
  type Color,
  type Lang,
  type Move,
  type Piece,
} from "./types";

export interface ReplayVideoInput {
  ucis: string[];
  /** Start position (omit = standard initial position). */
  startBoard?: BoardT;
  startCastling?: CastlingRights;
  startEp?: { x: number; y: number } | null;
  startTurn?: Color;
  startHalfmove?: number;
  /** The board is drawn from this player's perspective. */
  playerColor: Color;
  title: string;
  subtitle: string;
  lang: Lang;
  /** Playback speed multiplier (0.5 = half speed, slower). Defaults to 1. */
  speed?: number;
  micStream?: MediaStream | null;
  onProgress?: (p: number) => void;
  signal?: AbortSignal;
}

const VW = 720;
const VH = 960;
const CELL = 78;
const GRID = CELL * 8;
const PAD = 10;
const BX = (VW - (GRID + PAD * 2)) / 2;
const BY = 176;
const GX = BX + PAD;
const GY = BY + PAD;

const LIGHT = "#EEEED2";
const DARK = "#769656";

const TITLE_DUR = 2.0;
const FINISH_DUR = 2.2;
const END_DUR = 2.0;

function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

function rr(
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
  ctx.arcTo(x, y, x, y, r);
  ctx.closePath();
}

interface PlyInfo {
  move: Move;
  san: string;
  capture: boolean;
  /** Square of the captured piece (differs from `to` for en passant). */
  captureSq: { x: number; y: number } | null;
  check: boolean;
  mate: boolean;
  /** Rook glide for castling. */
  rookMove: Move | null;
}

function pickMime(): string {
  if (typeof MediaRecorder === "undefined") return "";
  const cands = ["video/mp4", "video/webm;codecs=vp9", "video/webm"];
  for (const c of cands) {
    try {
      if (MediaRecorder.isTypeSupported(c)) return c;
    } catch {
      /* ignore */
    }
  }
  return "";
}

/** Render the game replay to a video file. Rejects on cancel or unsupported. */
export async function exportReplayVideo(input: ReplayVideoInput): Promise<File> {
  const { ucis, lang, onProgress, signal } = input;
  const mime = pickMime();
  const canvas = document.createElement("canvas");
  if (!mime || typeof canvas.captureStream !== "function") {
    throw new Error("unsupported");
  }
  canvas.width = VW;
  canvas.height = VH;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("unsupported");

  const flipped = input.playerColor === "black";
  const disp = (x: number, y: number) =>
    flipped ? { dx: 7 - x, dy: 7 - y } : { dx: x, dy: y };
  const center = (x: number, y: number) => {
    const { dx, dy } = disp(x, y);
    return { px: GX + dx * CELL + CELL / 2, py: GY + dy * CELL + CELL / 2 };
  };

  // Precompute one state per ply (+ SAN, capture/check/mate flags).
  interface State {
    board: BoardT;
    castling: CastlingRights;
    ep: { x: number; y: number } | null;
    turn: Color;
    halfmove: number;
  }
  const states: State[] = [
    {
      board: input.startBoard ?? initialBoard(),
      castling: input.startCastling ?? { ...INITIAL_CASTLING },
      ep: input.startEp ?? null,
      turn: input.startTurn ?? "white",
      halfmove: input.startHalfmove ?? 0,
    },
  ];
  const moves: Move[] = ucis.map(uciToMove);
  const plies: PlyInfo[] = [];
  for (let i = 0; i < moves.length; i++) {
    const st = states[i];
    const m = moves[i];
    const piece = st.board[m.fromY][m.fromX];
    const target = st.board[m.toY][m.toX];
    const isEp =
      !!piece &&
      piece.type === "P" &&
      !target &&
      !!st.ep &&
      m.toX === st.ep.x &&
      m.toY === st.ep.y;
    const capture = !!target || isEp;
    const r = applyMove(st.board, m, st.castling, st.ep);
    const nextTurn = opposite(st.turn);
    const halfmove = piece?.type === "P" || capture ? 0 : st.halfmove + 1;
    const status = gameStatus(r.board, nextTurn, r.castling, r.ep, halfmove);
    const check = !status.over && inCheck(r.board, nextTurn);
    const mate = status.over && status.kind === "checkmate";
    const suffix = mate ? "#" : check ? "+" : "";
    const san = piece
      ? toSAN(st.board, m, st.turn, st.castling, st.ep, lang, suffix)
      : `${i + 1}`;
    let rookMove: Move | null = null;
    if (piece?.type === "K" && Math.abs(m.toX - m.fromX) === 2) {
      const kingside = m.toX > m.fromX;
      rookMove = {
        fromX: kingside ? 7 : 0,
        fromY: m.fromY,
        toX: kingside ? m.toX - 1 : m.toX + 1,
        toY: m.fromY,
      };
    }
    plies.push({
      move: m,
      san,
      capture,
      captureSq: target
        ? { x: m.toX, y: m.toY }
        : isEp
          ? { x: m.toX, y: m.fromY }
          : null,
      check,
      mate,
      rookMove,
    });
    states.push({
      board: r.board,
      castling: r.castling,
      ep: r.ep,
      turn: nextTurn,
      halfmove,
    });
  }
  const n = moves.length;
  const finalMate = n > 0 && plies[n - 1].mate;
  const mateText = STR[lang].checkmateBadge;

  const speed =
    input.speed && input.speed > 0
      ? Math.min(2, Math.max(0.25, input.speed))
      : 1;
  const GLIDE = 0.6 / speed;
  const HOLD = 1.0 / speed;
  const PER = GLIDE + HOLD;
  // Chess rules: stalemate is a draw — only checkmate is celebrated.
  const decisive = finalMate;
  const finishDur = decisive ? FINISH_DUR : 0;
  const total = TITLE_DUR + n * PER + finishDur + END_DUR;

  // Confetti over the finish (checkmate or stalemate): deterministic
  // particle bursts timed to the final move landing + the end card.
  // Chess palette from lib/chess/confetti.ts.
  const CONFETTI_COLORS = ["#f5c542", "#769656", "#ffffff", "#e8b64c", "#7fb2e5"];
  interface ConfettiP {
    bx: number; by: number; vx: number; vy: number;
    w: number; h: number; rot: number; vr: number;
    color: string; delay: number;
  }
  const confettiBursts: Array<{ t0: number; parts: ConfettiP[] }> = [];
  if (finalMate && n > 0) {
    let seed = 987654321;
    const rnd = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    const mateT = TITLE_DUR + (n - 1) * PER + GLIDE;
    const endT = TITLE_DUR + n * PER;
    const mkBurst = (t0: number, cxp: number) => {
      const parts: ConfettiP[] = [];
      for (let i = 0; i < 70; i++) {
        parts.push({
          bx: cxp + (rnd() - 0.5) * 60,
          by: 300 + rnd() * 80,
          vx: (rnd() - 0.5) * 260,
          vy: -(240 + rnd() * 320),
          w: 7 + rnd() * 7,
          h: 4 + rnd() * 5,
          rot: rnd() * Math.PI,
          vr: (rnd() - 0.5) * 9,
          color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
          delay: rnd() * 0.25,
        });
      }
      confettiBursts.push({ t0, parts });
    };
    mkBurst(mateT, VW / 2);
    mkBurst(mateT + 0.55, VW * 0.3);
    mkBurst(mateT + 0.55, VW * 0.7);
    mkBurst(endT + 0.1, VW / 2);
  }
  const drawConfetti = (t: number) => {
    for (const b of confettiBursts) {
      const age = t - b.t0;
      if (age < 0) continue;
      for (const p of b.parts) {
        const a = age - p.delay;
        if (a < 0 || a > 2.6) continue;
        const x = p.bx + p.vx * a;
        const y = p.by + p.vy * a + 340 * a * a;
        if (y > VH + 30) continue;
        ctx.save();
        ctx.globalAlpha = a > 2.0 ? Math.max(0, (2.6 - a) / 0.6) : 1;
        ctx.translate(x, y);
        ctx.rotate(p.rot + p.vr * a);
        ctx.fillStyle = p.color;
        ctx.fillRect(
          -p.w / 2,
          -p.h / 2,
          p.w,
          p.h * (0.4 + 0.6 * Math.abs(Math.sin(a * 6 + p.rot)))
        );
        ctx.restore();
      }
    }
  };

  const drawPieces = (
    board: BoardT,
    skip: Array<{ x: number; y: number }>,
    fadeSq: { x: number; y: number; alpha: number } | null,
    movers: Array<{ piece: Piece; px: number; py: number; scale: number }>
  ) => {
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) {
        if (skip.some((s) => s.x === x && s.y === y)) continue;
        const p = board[y][x];
        if (!p) continue;
        let alpha = 1;
        if (fadeSq && fadeSq.x === x && fadeSq.y === y) {
          alpha = fadeSq.alpha;
          if (alpha <= 0) continue;
        }
        const { px, py } = center(x, y);
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.fillStyle = "rgba(0,0,0,0.18)";
        ctx.beginPath();
        ctx.ellipse(px, py + CELL * 0.34, CELL * 0.3, CELL * 0.1, 0, 0, Math.PI * 2);
        ctx.fill();
        drawCanvasPiece(ctx, p.type, p.color, px, py, CELL * 0.92);
        ctx.restore();
      }
    }
    for (const mv of movers) {
      ctx.save();
      ctx.fillStyle = "rgba(0,0,0,0.22)";
      ctx.beginPath();
      ctx.ellipse(mv.px, mv.py + CELL * 0.34, CELL * 0.32, CELL * 0.11, 0, 0, Math.PI * 2);
      ctx.fill();
      drawCanvasPiece(ctx, mv.piece.type, mv.piece.color, mv.px, mv.py, CELL * 0.92 * mv.scale);
      ctx.restore();
    }
  };

  const drawFrame = (t: number) => {
    // Background.
    const bg = ctx.createLinearGradient(0, 0, 0, VH);
    bg.addColorStop(0, "#232b36");
    bg.addColorStop(1, "#10141a");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, VW, VH);
    ctx.strokeStyle = "#e0a32e";
    ctx.lineWidth = 5;
    ctx.strokeRect(14, 14, VW - 28, VH - 28);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    let board = states[0].board;
    let caption: string | null = null;
    let anim: { ply: PlyInfo; idx: number; p: number; piece: Piece } | null = null;
    let lastMove: Move | null = null;
    let trailRemnant: { move: Move; q: number } | null = null;
    let card = false;
    let showMate = false;
    let checkSq: { x: number; y: number } | null = null;

    const kingOf = (b: BoardT, color: Color) => {
      for (let y = 0; y < 8; y++)
        for (let x = 0; x < 8; x++)
          if (b[y][x]?.type === "K" && b[y][x]?.color === color) return { x, y };
      return null;
    };

    if (t < TITLE_DUR) {
      card = true;
    } else {
      const mt = t - TITLE_DUR;
      const idx = Math.floor(mt / PER);
      if (idx >= n) {
        board = states[n].board;
        lastMove = n > 0 ? moves[n - 1] : null;
        if (decisive && mt < n * PER + FINISH_DUR) {
          // Finish celebration (family video standard): final board +
          // result banner + confetti — NO card overlay yet.
          showMate = finalMate;
        } else {
          // Outro card: title/subtitle + the site CTA, a clean END_DUR
          // (2s) after the celebration.
          card = true;
        }
        if (n > 0 && (plies[n - 1].check || plies[n - 1].mate)) {
          checkSq = kingOf(board, states[n].turn);
        }
      } else {
        const lt = mt - idx * PER;
        const ply = plies[idx];
        const m = ply.move;
        board = states[idx].board;
        const piece = board[m.fromY][m.fromX];
        if (lt < GLIDE && piece) {
          anim = { ply, idx, p: easeInOut(lt / GLIDE), piece };
        } else {
          board = states[idx + 1].board;
          lastMove = m;
          const holdT = lt - GLIDE;
          if (holdT < 0.45) trailRemnant = { move: m, q: 1 - holdT / 0.45 };
          if (ply.check || ply.mate) checkSq = kingOf(board, states[idx + 1].turn);
        }
        caption = `${idx + 1}/${n} · ${ply.san}`;
        if (ply.mate) showMate = true;
      }
    }

    // Header.
    ctx.fillStyle = "#e8c96a";
    ctx.font = "700 44px Georgia, serif";
    ctx.fillText(lang === "vi" ? "♞ CỜ VUA" : "♞ CHESS", VW / 2, 64);
    if (!card) {
      ctx.fillStyle = "#e8e2d2";
      ctx.font = "400 27px system-ui, sans-serif";
      ctx.fillText(input.title, VW / 2, 116, VW - 80);
    }

    // Board frame + squares.
    ctx.fillStyle = "#26313d";
    rr(ctx, BX, BY, GRID + PAD * 2, GRID + PAD * 2, 14);
    ctx.fill();
    ctx.strokeStyle = "#e0a32e";
    ctx.lineWidth = 3;
    rr(ctx, BX, BY, GRID + PAD * 2, GRID + PAD * 2, 14);
    ctx.stroke();
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) {
        const { dx, dy } = disp(x, y);
        ctx.fillStyle = (x + y) % 2 === 0 ? LIGHT : DARK;
        ctx.fillRect(GX + dx * CELL, GY + dy * CELL, CELL, CELL);
      }
    }
    // Last-move highlight.
    if (lastMove && !anim) {
      ctx.fillStyle = "rgba(255, 213, 59, 0.42)";
      for (const sq of [
        { x: lastMove.fromX, y: lastMove.fromY },
        { x: lastMove.toX, y: lastMove.toY },
      ]) {
        const { dx, dy } = disp(sq.x, sq.y);
        ctx.fillRect(GX + dx * CELL, GY + dy * CELL, CELL, CELL);
      }
    }
    // King-in-check ring.
    if (checkSq) {
      const { px, py } = center(checkSq.x, checkSq.y);
      ctx.save();
      ctx.strokeStyle = "#ff5252";
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(px, py, CELL * 0.44, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    if (anim) {
      const { ply, idx, p, piece } = anim;
      const m = ply.move;
      const fade = p < 0.75 ? 1 : (1 - p) / 0.25;
      const from = center(m.fromX, m.fromY);
      const to = center(m.toX, m.toY);
      ctx.save();
      ctx.strokeStyle = "#40e0d0";
      ctx.lineCap = "round";
      ctx.globalAlpha = 0.85 * fade;
      ctx.lineWidth = 5 + 11 * fade;
      ctx.beginPath();
      ctx.moveTo(from.px, from.py);
      ctx.lineTo(to.px, to.py);
      ctx.stroke();
      ctx.globalAlpha = 0.9 * (1 - p);
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.arc(from.px, from.py, 24 + 18 * p, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
      const px = from.px + (to.px - from.px) * p;
      const py = from.py + (to.py - from.py) * p;
      ctx.save();
      ctx.globalAlpha = 0.5 * fade;
      ctx.fillStyle = "#40e0d0";
      ctx.beginPath();
      ctx.arc(px, py, 46, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      const skip = [{ x: m.fromX, y: m.fromY }];
      const movers: Array<{ piece: Piece; px: number; py: number; scale: number }> = [
        { piece, px, py, scale: 1.07 },
      ];
      if (ply.rookMove) {
        const rm = ply.rookMove;
        skip.push({ x: rm.fromX, y: rm.fromY });
        const rook = states[idx].board[rm.fromY][rm.fromX];
        if (rook) {
          const rf = center(rm.fromX, rm.fromY);
          const rt = center(rm.toX, rm.toY);
          movers.push({
            piece: rook,
            px: rf.px + (rt.px - rf.px) * p,
            py: rf.py + (rt.py - rf.py) * p,
            scale: 1.0,
          });
        }
      }
      drawPieces(
        board,
        skip,
        ply.captureSq
          ? { ...ply.captureSq, alpha: Math.max(0, 1 - p * 2) }
          : null,
        movers
      );
    } else {
      if (trailRemnant) {
        const m = trailRemnant.move;
        const from = center(m.fromX, m.fromY);
        const to = center(m.toX, m.toY);
        ctx.save();
        ctx.strokeStyle = "#40e0d0";
        ctx.lineCap = "round";
        ctx.globalAlpha = 0.7 * trailRemnant.q;
        ctx.lineWidth = 5 + 9 * trailRemnant.q;
        ctx.beginPath();
        ctx.moveTo(from.px, from.py);
        ctx.lineTo(to.px, to.py);
        ctx.stroke();
        ctx.restore();
      }
      drawPieces(board, [], null, []);
    }

    // Bottom caption.
    if (caption && !card) {
      ctx.fillStyle = "#ffffff";
      ctx.font = "600 30px system-ui, sans-serif";
      ctx.fillText(caption, VW / 2, 884, VW - 80);
    }

    // Checkmate banner — gold on black, like the in-game banner.
    if (showMate) {
      ctx.save();
      ctx.fillStyle = "rgba(0, 0, 0, 0.72)";
      const bw = VW - 160;
      const bh = 110;
      const bx = (VW - bw) / 2;
      const by = VH / 2 - bh / 2;
      ctx.fillRect(bx, by, bw, bh);
      ctx.strokeStyle = "#ffd43b";
      ctx.lineWidth = 4;
      ctx.strokeRect(bx, by, bw, bh);
      ctx.fillStyle = "#ffd43b";
      ctx.font = "700 54px Georgia, serif";
      ctx.fillText(mateText, VW / 2, VH / 2, bw - 40);
      ctx.restore();
    }

    // Title / end card overlay.
    if (card) {
      ctx.fillStyle = "rgba(8, 10, 14, 0.66)";
      ctx.fillRect(0, 0, VW, VH);
      ctx.fillStyle = "#e8c96a";
      ctx.font = "700 62px Georgia, serif";
      ctx.fillText(lang === "vi" ? "♞ CỜ VUA" : "♞ CHESS", VW / 2, VH / 2 - 118);
      ctx.fillStyle = "#ffffff";
      ctx.font = "600 42px system-ui, sans-serif";
      ctx.fillText(input.title, VW / 2, VH / 2 - 28, VW - 80);
      ctx.fillStyle = "#cfd8e3";
      ctx.font = "400 33px system-ui, sans-serif";
      ctx.fillText(input.subtitle, VW / 2, VH / 2 + 38, VW - 80);
      // Site CTA on the intro + outro cards.
      ctx.fillStyle = "#e8c96a";
      ctx.font = "600 26px system-ui, sans-serif";
      ctx.fillText(STR[lang].replaySiteCta, VW / 2, VH / 2 + 104, VW - 60);
    }

    drawConfetti(t);
  };

  const stream = canvas.captureStream(30);

  // Recorded soundtrack: synthesized move / capture / check sounds
  // scheduled on the video timeline through a MediaStreamDestination.
  let actx: AudioContext | null = null;
  try {
    const AC =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    actx = new AC();
    if (actx.state === "suspended") await actx.resume();
    const dest = actx.createMediaStreamDestination();
    const track = dest.stream.getAudioTracks()[0];
    if (track) stream.addTrack(track);
    if (input.micStream) {
      try {
        actx.createMediaStreamSource(input.micStream).connect(dest);
      } catch {
        /* ignore */
      }
    }
    const base = actx.currentTime + 0.15;
    plies.forEach((ply, i) => {
      const t0 = base + TITLE_DUR + i * PER;
      if (ply.capture) synthCapture(dest, t0 + 0.04);
      synthMoveStart(dest, t0);
      synthMove(dest, t0 + GLIDE);
      if (ply.check || ply.mate) synthCheck(dest, t0 + GLIDE + 0.1);
    });
  } catch {
    actx = null; // audio unavailable — keep recording silent
  }

  const rec = new MediaRecorder(stream, {
    mimeType: mime,
    videoBitsPerSecond: 2_500_000,
  });
  const chunks: BlobPart[] = [];
  rec.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) chunks.push(e.data);
  };
  const finished = new Promise<Blob>((resolve, reject) => {
    rec.onstop = () => resolve(new Blob(chunks, { type: mime }));
    rec.onerror = () => reject(new Error("record_failed"));
  });

  let raf = 0;
  let lastPct = -1;
  let cancelled = false;
  const onAbort = () => {
    cancelled = true;
  };
  signal?.addEventListener("abort", onAbort);

  try {
    rec.start(250);
    const t0 = performance.now();
    await new Promise<void>((resolve, reject) => {
      const tick = () => {
        if (cancelled || signal?.aborted) {
          reject(new Error("cancelled"));
          return;
        }
        const t = (performance.now() - t0) / 1000;
        if (t >= total) {
          drawFrame(total);
          resolve();
          return;
        }
        drawFrame(t);
        const pct = Math.floor((t / total) * 100);
        if (pct !== lastPct) {
          lastPct = pct;
          onProgress?.(pct / 100);
        }
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    });
  } finally {
    cancelAnimationFrame(raf);
    signal?.removeEventListener("abort", onAbort);
    if (rec.state !== "inactive") rec.stop();
    if (actx) {
      try {
        await actx.close();
      } catch {
        /* ignore */
      }
    }
  }

  const blob = await finished;
  const ext = mime.includes("mp4") ? "mp4" : "webm";
  return new File([blob], `co-vua-replay.${ext}`, { type: mime });
}
