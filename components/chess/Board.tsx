"use client";

import { useMemo, useRef } from "react";
import {
  Board as BoardT,
  Move,
  Piece,
} from "@/lib/chess/types";
import { useBoardTheme } from "@/lib/chess/boardTheme";
import { VectorPieceAt } from "./Pieces";

const CELL = 76;
const MARGIN = 58;
const W = 8 * CELL + MARGIN * 2; // 724
const H = 8 * CELL + MARGIN * 2;

const FILES = "abcdefgh";

export interface FightAnim {
  id: number;
  move: Move;
  piece: Piece;
  captured: Piece | null;
}

interface BoardProps {
  board: BoardT;
  flipped: boolean;
  selected: { x: number; y: number } | null;
  targets: Move[];
  lastMove: Move | null;
  checkAt: { x: number; y: number } | null;
  checkKey: number;
  checkBadge: string;
  fight: FightAnim | null;
  interactive: boolean;
  boardLabel: string;
  onSquareClick: (x: number, y: number) => void;
  /** Engine hint: gold pulsing rings on the from/to squares. */
  hintMove?: Move | null;
}

/** Every board theme renders the same vector piece set (the bold
 *  two-tone Staunton in Pieces.tsx); themes differ only in the board's
 *  squares, frame and coordinates. */
function PieceShape({
  piece,
  x,
  y,
  size,
}: {
  piece: Piece;
  x: number;
  y: number;
  size: number;
}) {
  return (
    <g filter="url(#pieceShadowSoft)">
      <VectorPieceAt
        type={piece.type}
        color={piece.color}
        x={x}
        y={y}
        size={size}
      />
    </g>
  );
}

/** Clash burst + flying captured piece, played when the mover arrives. */
function Clash({ x, y, captured, fromX, fromY }: {
  x: number;
  y: number;
  captured: Piece;
  fromX: number;
  fromY: number;
}) {
  const spikes = [];
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4;
    const c = Math.cos(a);
    const s = Math.sin(a);
    spikes.push(
      <line
        key={i}
        x1={x + c * 16} y1={y + s * 16}
        x2={x + c * 30} y2={y + s * 30}
        stroke="#ffd43b"
        strokeWidth={7}
        strokeLinecap="round"
      >
        <animate attributeName="x1" values={`${x + c * 16};${x + c * 44}`} dur="0.38s" begin="0.34s" fill="freeze" />
        <animate attributeName="y1" values={`${y + s * 16};${y + s * 44}`} dur="0.38s" begin="0.34s" fill="freeze" />
        <animate attributeName="x2" values={`${x + c * 30};${x + c * 62}`} dur="0.38s" begin="0.34s" fill="freeze" />
        <animate attributeName="y2" values={`${y + s * 30};${y + s * 62}`} dur="0.38s" begin="0.34s" fill="freeze" />
        <animate attributeName="opacity" values="1;0" dur="0.38s" begin="0.34s" fill="freeze" />
        <animate attributeName="stroke-width" values="7;1" dur="0.38s" begin="0.34s" fill="freeze" />
      </line>
    );
  }
  // Fling direction: away from the attacker's origin square.
  const dx = Math.sign(x - fromX) * 70 || 50;
  const dy = -55;
  return (
    <g>
      <circle cx={x} cy={y} r={14} fill="#ffd43b">
        <animate attributeName="r" values="14;54" dur="0.38s" begin="0.34s" fill="freeze" />
        <animate attributeName="opacity" values="0.95;0" dur="0.38s" begin="0.34s" fill="freeze" />
      </circle>
      <circle cx={x} cy={y} r={9} fill="#fff9db">
        <animate attributeName="r" values="9;30" dur="0.3s" begin="0.34s" fill="freeze" />
        <animate attributeName="opacity" values="1;0" dur="0.3s" begin="0.34s" fill="freeze" />
      </circle>
      {spikes}
      <g>
        <animate attributeName="opacity" values="1;1;0" keyTimes="0;0.55;1" dur="0.62s" begin="0.34s" fill="freeze" />
        <animateTransform attributeName="transform" type="translate" values={`0 0;${dx} ${dy}`} dur="0.62s" begin="0.34s" fill="freeze" />
        <animateTransform attributeName="transform" type="rotate" from="0 0 0" to="170 0 0" dur="0.62s" begin="0.34s" fill="freeze" additive="sum" />
        <g transform={`translate(${x} ${y})`}>
          <PieceShape piece={captured} x={0} y={0} size={62} />
        </g>
      </g>
    </g>
  );
}

export function Board({
  board,
  flipped,
  selected,
  targets,
  lastMove,
  checkAt,
  checkKey,
  checkBadge,
  fight,
  interactive,
  boardLabel,
  onSquareClick,
  hintMove,
}: BoardProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const theme = useBoardTheme();
  const green = theme === "green";

  const px = (x: number) => MARGIN + (flipped ? 7 - x : x) * CELL + CELL / 2;
  const py = (y: number) => MARGIN + (flipped ? 7 - y : y) * CELL + CELL / 2;

  const targetSet = useMemo(() => {
    const quiet = new Set<string>();
    const captures = new Set<string>();
    for (const m of targets) {
      const key = `${m.toX},${m.toY}`;
      if (board[m.toY][m.toX] || m.promotion) captures.add(key);
      else quiet.add(key);
    }
    return { quiet, captures };
  }, [targets, board]);

  const handleClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!interactive || !svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    // The SVG keeps the viewBox aspect via preserveAspectRatio="xMidYMid meet":
    // when the container's aspect differs from the board's, the drawing is
    // letterboxed (centered with empty bands). A naive linear map across the
    // full element is then off — increasingly toward the edges — and taps land
    // on a neighbouring square. Convert through the meet transform instead.
    const scale = Math.min(rect.width / W, rect.height / H);
    if (scale <= 0) return;
    const offX = (rect.width - W * scale) / 2;
    const offY = (rect.height - H * scale) / 2;
    const sx = (e.clientX - rect.left - offX) / scale;
    const sy = (e.clientY - rect.top - offY) / scale;
    const dx = Math.floor((sx - MARGIN) / CELL);
    const dy = Math.floor((sy - MARGIN) / CELL);
    if (dx < 0 || dx > 7 || dy < 0 || dy > 7) return;
    onSquareClick(flipped ? 7 - dx : dx, flipped ? 7 - dy : dy);
  };

  const squares = [];
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      const light = (x + y) % 2 === 0;
      const isLast =
        lastMove &&
        ((lastMove.fromX === x && lastMove.fromY === y) ||
          (lastMove.toX === x && lastMove.toY === y));
      const isSel = selected?.x === x && selected?.y === y;
      squares.push(
        <g key={`${x}-${y}`}>
          <rect
            x={MARGIN + x * CELL}
            y={MARGIN + y * CELL}
            width={CELL}
            height={CELL}
            fill={
              light
                ? green
                  ? "#EEEED2"
                  : "url(#sqLight)"
                : green
                  ? "#769656"
                  : "url(#sqDark)"
            }
          />
          {isLast && (
            <rect
              x={MARGIN + x * CELL}
              y={MARGIN + y * CELL}
              width={CELL}
              height={CELL}
              fill="#ffd43b"
              opacity={0.38}
            />
          )}
          {isSel && (
            <rect
              x={MARGIN + x * CELL + 3}
              y={MARGIN + y * CELL + 3}
              width={CELL - 6}
              height={CELL - 6}
              fill="none"
              stroke="#ffd43b"
              strokeWidth={4}
              rx={6}
            />
          )}
        </g>
      );
    }
  }

  // Coordinates on the frame.
  const coords = [];
  for (let i = 0; i < 8; i++) {
    const f = flipped ? 7 - i : i;
    coords.push(
      <text
        key={`f${i}`}
        x={MARGIN + i * CELL + CELL / 2}
        y={H - 18}
        textAnchor="middle"
        fontSize={19}
        fontWeight={700}
        fill={green ? "#67755a" : "#e8d5ae"}
        opacity={0.85}
      >
        {FILES[f]}
      </text>
    );
    const r = flipped ? i + 1 : 8 - i;
    coords.push(
      <text
        key={`r${i}`}
        x={22}
        y={MARGIN + i * CELL + CELL / 2}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={19}
        fontWeight={700}
        fill={green ? "#67755a" : "#e8d5ae"}
        opacity={0.85}
      >
        {r}
      </text>
    );
  }

  const pieces = [];
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      const p = board[y][x];
      if (!p) continue;
      // The animated mover is drawn in the overlay layer instead.
      if (fight && fight.move.toX === x && fight.move.toY === y) continue;
      pieces.push(
        <g key={`${x}-${y}`}>
          <PieceShape piece={p} x={px(x)} y={py(y)} size={70} />
        </g>
      );
    }
  }

  const markers = [];
  for (const key of targetSet.quiet) {
    const [x, y] = key.split(",").map(Number);
    markers.push(
      <circle
        key={`t${key}`}
        cx={px(x)}
        cy={py(y)}
        r={11}
        fill="#2f9e44"
        opacity={0.85}
        stroke="#ffffff"
        strokeWidth={2}
        strokeOpacity={0.55}
      />
    );
  }
  for (const key of targetSet.captures) {
    const [x, y] = key.split(",").map(Number);
    markers.push(
      <circle
        key={`c${key}`}
        cx={px(x)}
        cy={py(y)}
        r={36}
        fill="none"
        stroke="#e03131"
        strokeWidth={4}
      />
    );
  }

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${W} ${H}`}
      className="ch-board-svg"
      style={{ cursor: interactive ? "pointer" : "default", touchAction: "manipulation" }}
      onClick={handleClick}
      role="img"
      aria-label={boardLabel}
    >
      <defs>
        <linearGradient id="sqLight" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f0dcae" />
          <stop offset="1" stopColor="#e2c48d" />
        </linearGradient>
        <linearGradient id="sqDark" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#b07a45" />
          <stop offset="1" stopColor="#96602f" />
        </linearGradient>
        <linearGradient id="frameEdge" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#8a5227" />
          <stop offset="0.5" stopColor="#5e3618" />
          <stop offset="1" stopColor="#7c4a22" />
        </linearGradient>
        <filter id="pieceShadowSoft" x="-40%" y="-40%" width="180%" height="180%">
          <feDropShadow dx="0" dy="2" stdDeviation="2" floodOpacity="0.3" />
        </filter>
        <filter id="boardShadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="16" stdDeviation="20" floodOpacity="0.55" />
        </filter>
      </defs>

      <g filter="url(#boardShadow)">
        <rect x={4} y={4} width={W - 8} height={H - 8} rx={16} fill={green ? "#EEF0E2" : "url(#frameEdge)"} />
        <rect x={4} y={4} width={W - 8} height={H - 8} rx={16} fill="none" stroke={green ? "#B7BDA6" : "#3d2410"} strokeWidth={2} />
        <rect x={MARGIN - 8} y={MARGIN - 8} width={8 * CELL + 16} height={8 * CELL + 16} rx={6} fill="none" stroke={green ? "#769656" : "#d9b06a"} strokeWidth={2} opacity={0.5} />
      </g>

      {squares}
      {coords}
      {markers}
      {/* hint: gold rings on the suggested from/to squares */}
      {hintMove && (
        <g className="ch-hint-ring" pointerEvents="none">
          <circle cx={px(hintMove.fromX)} cy={py(hintMove.fromY)} r={34} fill="none" stroke="#ffd43b" strokeWidth={5} />
          <circle cx={px(hintMove.toX)} cy={py(hintMove.toY)} r={34} fill="none" stroke="#ffd43b" strokeWidth={5} />
        </g>
      )}
      {pieces}

      {/* check badge pops above the king */}
      {checkAt && (
        <g transform={`translate(${px(checkAt.x)} ${py(checkAt.y) - CELL * 0.78})`}>
          <g key={checkKey} className="fight-badge">
            <rect x={-72} y={-21} width={144} height={42} rx={21} fill="#e03131" stroke="#fff" strokeWidth={2.5} />
            <text x={0} y={1} textAnchor="middle" dominantBaseline="central" fontSize={22} fontWeight={800} fill="#fff">
              ⚔ {checkBadge}
            </text>
          </g>
        </g>
      )}

      {/* fight animation overlay */}
      {fight && (
        <g key={fight.id}>
          {/* mover slides from -> to */}
          <g>
            <animateTransform
              attributeName="transform"
              type="translate"
              from={`${px(fight.move.fromX) - px(fight.move.toX)} ${py(fight.move.fromY) - py(fight.move.toY)}`}
              to="0 0"
              dur="0.45s"
              fill="freeze"
            />
            <g transform={`translate(${px(fight.move.toX)} ${py(fight.move.toY)})`}>
              <PieceShape piece={fight.piece} x={0} y={0} size={70} />
            </g>
          </g>
          {fight.captured && (
            <Clash
              x={px(fight.move.toX)}
              y={py(fight.move.toY)}
              captured={fight.captured}
              fromX={px(fight.move.fromX)}
              fromY={py(fight.move.fromY)}
            />
          )}
        </g>
      )}
    </svg>
  );
}
