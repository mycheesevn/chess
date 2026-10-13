"use client";

import { useState } from "react";
import { Board } from "./Board";
import { VectorPiece } from "./Pieces";
import { initialBoard } from "@/lib/chess/engine";
import { STR } from "@/lib/chess/i18n";
import {
  SETUP_PIECE_ORDER,
  cloneBoard,
  emptyBoard,
  validateSetup,
  type SetupError,
} from "@/lib/chess/setup";
import type {
  Board as BoardT,
  Color,
  Lang,
  Piece,
  PieceType,
} from "@/lib/chess/types";

interface Props {
  lang: Lang;
  onPlay: (board: BoardT, playerColor: Color, turn: Color) => void;
}

type Tool =
  | { kind: "move" }
  | { kind: "erase" }
  | { kind: "place"; color: Color; type: PieceType };

const ERROR_KEYS: Record<SetupError, string> = {
  kings: "setupErrKings",
  pawns: "setupErrPawns",
  kingsAdjacent: "setupErrKingsAdjacent",
  opponentInCheck: "setupErrOpponentInCheck",
  material: "setupErrMaterial",
  finished: "setupErrFinished",
};

export function SetupView({ lang, onPlay }: Props) {
  const s = STR[lang];
  const [board, setBoard] = useState<BoardT>(() => initialBoard());
  const [tool, setTool] = useState<Tool>({ kind: "move" });
  const [lifted, setLifted] = useState<{ x: number; y: number } | null>(null);
  const [playerColor, setPlayerColor] = useState<Color>("white");
  const [turn, setTurn] = useState<Color>("white");
  const [error, setError] = useState<string | null>(null);

  const setCell = (x: number, y: number, piece: Piece | null) => {
    setBoard((prev) => {
      const next = cloneBoard(prev);
      next[y][x] = piece;
      return next;
    });
  };

  const onSquareClick = (x: number, y: number) => {
    setError(null);
    if (tool.kind === "place") {
      setCell(x, y, { color: tool.color, type: tool.type });
      setLifted(null);
      return;
    }
    if (tool.kind === "erase") {
      setCell(x, y, null);
      setLifted(null);
      return;
    }

    // Move tool: tap once to lift a piece, again on the destination to
    // drop it. Dropping replaces any piece already on that square.
    if (lifted) {
      if (lifted.x === x && lifted.y === y) {
        setLifted(null);
        return;
      }
      setBoard((prev) => {
        const next = cloneBoard(prev);
        next[y][x] = next[lifted.y][lifted.x];
        next[lifted.y][lifted.x] = null;
        return next;
      });
      setLifted(null);
    } else if (board[y][x]) {
      setLifted({ x, y });
    }
  };

  const toolActive = (candidate: Tool) =>
    tool.kind === candidate.kind &&
    (candidate.kind !== "place" ||
      (tool.kind === "place" &&
        tool.color === candidate.color &&
        tool.type === candidate.type));

  const chooseTool = (next: Tool) => {
    setTool(next);
    setLifted(null);
    setError(null);
  };

  const renderPieceButton = (color: Color, type: PieceType) => {
    const candidate: Tool = { kind: "place", color, type };
    const colorName = color === "white" ? s.whiteName : s.blackName;
    return (
      <button
        key={`${color}-${type}`}
        type="button"
        className={`ch-palbtn${toolActive(candidate) ? " active" : ""}`}
        onClick={() => chooseTool(candidate)}
        aria-pressed={toolActive(candidate)}
        title={`${colorName} · ${s.pieceName(type)}`}
      >
        <svg viewBox="0 0 100 100" aria-hidden="true">
          <VectorPiece type={type} color={color} />
        </svg>
      </button>
    );
  };

  const start = () => {
    const setupError = validateSetup(board, turn);
    if (setupError) {
      setError(s[ERROR_KEYS[setupError] as keyof typeof s] as string);
      return;
    }
    setError(null);
    onPlay(cloneBoard(board), playerColor, turn);
  };

  const reset = () => {
    setBoard(initialBoard());
    setLifted(null);
    setError(null);
  };

  const clear = () => {
    setBoard(emptyBoard());
    setLifted(null);
    setError(null);
  };

  return (
    <div className="ch-page">
      <main className="ch-layout">
        <div className="ch-board-area">
          <div className="ch-board-fit">
            <Board
              board={board}
              flipped={false}
              selected={lifted}
              targets={[]}
              lastMove={null}
              checkAt={null}
              checkKey={0}
              checkBadge=""
              fight={null}
              interactive
              boardLabel={s.setupTitle}
              onSquareClick={onSquareClick}
            />
          </div>
        </div>

        <aside className="ch-panel ch-setup-panel">
          <div>
            <h2 className="ch-setup-title">🧩 {s.setupTitle}</h2>
            <p className="ch-hint">{s.setupHint}</p>
          </div>

          <section>
            <h2>{s.setupPieces}</h2>
            <div className="ch-palette">
              <button
                type="button"
                className={`ch-palbtn ch-palbtn-tool${tool.kind === "move" ? " active" : ""}`}
                onClick={() => chooseTool({ kind: "move" })}
                aria-pressed={tool.kind === "move"}
                title={s.setupMove}
              >
                ✥ <span>{s.setupMove}</span>
              </button>
              <button
                type="button"
                className={`ch-palbtn ch-palbtn-tool${tool.kind === "erase" ? " active" : ""}`}
                onClick={() => chooseTool({ kind: "erase" })}
                aria-pressed={tool.kind === "erase"}
                title={s.setupErase}
              >
                🧽 <span>{s.setupErase}</span>
              </button>
            </div>
            <div className="ch-palette" aria-label={s.whiteName}>
              {SETUP_PIECE_ORDER.map((type) => renderPieceButton("white", type))}
            </div>
            <div className="ch-palette" aria-label={s.blackName}>
              {SETUP_PIECE_ORDER.map((type) => renderPieceButton("black", type))}
            </div>
          </section>

          <section>
            <h2>{s.setupTitle}</h2>
            <div className="ch-setup-form">
              <label className="ch-field">
                <span>{s.youPlay}</span>
                <select
                  className="ch-select"
                  value={playerColor}
                  onChange={(e) => setPlayerColor(e.target.value as Color)}
                >
                  <option value="white">{s.whiteName}</option>
                  <option value="black">{s.blackName}</option>
                </select>
              </label>
              <label className="ch-field">
                <span>{s.setupTurn}</span>
                <select
                  className="ch-select"
                  value={turn}
                  onChange={(e) => setTurn(e.target.value as Color)}
                >
                  <option value="white">{s.whiteName}</option>
                  <option value="black">{s.blackName}</option>
                </select>
              </label>
            </div>

            {error && (
              <p className="ch-error ch-setup-error" role="alert">
                {error}
              </p>
            )}

            <div className="ch-setup-actions">
              <button type="button" className="ch-btn ch-btn-primary" onClick={start}>
                {s.setupStart}
              </button>
              <button type="button" className="ch-btn" onClick={reset}>
                {s.setupReset}
              </button>
              <button type="button" className="ch-btn" onClick={clear}>
                {s.setupClear}
              </button>
            </div>
          </section>
        </aside>
      </main>
    </div>
  );
}
