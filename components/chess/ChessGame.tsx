"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Board, type FightAnim } from "./Board";
import { GameOverPanel } from "./GameOverPanel";
import {
  findBestMove,
  getLevelConfig,
  LEVELS,
  type SearchStats,
} from "@/lib/chess/ai";
import {
  applyMove,
  gameStatus,
  initialBoard,
  INITIAL_CASTLING,
  inCheck,
  legalMovesForSquare,
} from "@/lib/chess/engine";
import { STR } from "@/lib/chess/i18n";
import { toSAN } from "@/lib/chess/notation";
import { moveToUci } from "@/lib/chess/uci";
import {
  Board as BoardT,
  CastlingRights,
  Color,
  GLYPHS,
  Lang,
  Level,
  Move,
  Piece,
  PieceType,
  opposite,
} from "@/lib/chess/types";

interface Snapshot {
  board: BoardT;
  turn: Color;
  castling: CastlingRights;
  ep: { x: number; y: number } | null;
  halfmove: number;
  lastMove: Move | null;
  logLength: number;
}

interface GameState {
  board: BoardT;
  turn: Color;
  castling: CastlingRights;
  ep: { x: number; y: number } | null;
  halfmove: number;
  lastMove: Move | null;
  log: string[];
  uciLog: string[];
  history: Snapshot[];
  selected: { x: number; y: number } | null;
  pendingPromotion: { from: { x: number; y: number }; to: { x: number; y: number } } | null;
  inCheck: boolean;
  gameOver: {
    kind: "checkmate" | "stalemate" | "fifty-move" | "insufficient-material";
    winner: Color | null;
  } | null;
}

const INITIAL_COUNTS: Record<PieceType, number> = {
  K: 1, Q: 1, R: 2, B: 2, N: 2, P: 8,
};

const PROMO_CHOICES: PieceType[] = ["Q", "R", "B", "N"];

function freshState(): GameState {
  return {
    board: initialBoard(),
    turn: "white",
    castling: { ...INITIAL_CASTLING },
    ep: null,
    halfmove: 0,
    lastMove: null,
    log: [],
    uciLog: [],
    history: [],
    selected: null,
    pendingPromotion: null,
    inCheck: false,
    gameOver: null,
  };
}

function formatNodes(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : `${n}`;
}

function findKing(board: BoardT, color: Color): { x: number; y: number } | null {
  for (let y = 0; y < 8; y++)
    for (let x = 0; x < 8; x++) {
      const p = board[y][x];
      if (p && p.type === "K" && p.color === color) return { x, y };
    }
  return null;
}

export function ChessGame({
  onGameEnd,
  lang,
  setLang,
}: {
  onGameEnd?: (
    result: "win" | "loss" | "draw",
    color: "white" | "black",
    level: number,
    plies: number,
    uciMoves: string
  ) => void;
  lang: Lang;
  setLang: (l: Lang) => void;
}) {
  const [state, setState] = useState<GameState>(freshState);
  const [playerColor, setPlayerColor] = useState<Color>("white");
  const [level, setLevel] = useState<Level>(5);
  const [thinking, setThinking] = useState(false);
  const [aiStats, setAiStats] = useState<SearchStats | null>(null);
  const [fight, setFight] = useState<FightAnim | null>(null);
  const [shakeId, setShakeId] = useState(0);
  const reportedEnd = useRef(0);

  const s = STR[lang];
  const num = (v: string) => (lang === "vi" ? v.replace(".", ",") : v);
  const aiColor = opposite(playerColor);
  const fightId = useRef(0);
  const fightTimer = useRef<number | null>(null);
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    try {
      localStorage.setItem("chess-lang", lang);
    } catch {
      /* storage unavailable */
    }
    document.documentElement.lang = lang;
  }, [lang]);

  useEffect(() => {
    return () => {
      if (fightTimer.current) window.clearTimeout(fightTimer.current);
    };
  }, []);

  // Report game end once for XP recording.
  useEffect(() => {
    if (!state.gameOver || !onGameEnd) return;
    const id = state.log.length;
    if (reportedEnd.current === id) return;
    reportedEnd.current = id;
    const go = state.gameOver;
    const result: "win" | "loss" | "draw" =
      go.kind === "checkmate"
        ? go.winner === playerColor
          ? "win"
          : "loss"
        : "draw";
    onGameEnd(result, playerColor, level, state.log.length, state.uciLog.join(" "));
  }, [state.gameOver, state.log.length, state.uciLog, onGameEnd, playerColor, level]);

  const commitMove = useCallback(
    (move: Move) => {
      const prev = stateRef.current;
      if (prev.gameOver) return;
      const piece = prev.board[move.fromY][move.fromX];
      if (!piece) return;

      // Captured piece (needed for the fight animation).
      let captured: Piece | null = prev.board[move.toY][move.toX];
      if (
        !captured &&
        piece.type === "P" &&
        prev.ep &&
        move.toX === prev.ep.x &&
        move.toY === prev.ep.y
      ) {
        captured = prev.board[move.fromY][move.toX];
      }

      const r = applyMove(prev.board, move, prev.castling, prev.ep);
      const nextTurn = opposite(prev.turn);
      const halfmove = piece.type === "P" || captured ? 0 : prev.halfmove + 1;
      const status = gameStatus(r.board, nextTurn, r.castling, r.ep, halfmove);
      const nextCheck = !status.over && inCheck(r.board, nextTurn);
      const suffix =
        status.over && status.kind === "checkmate"
          ? "#"
          : nextCheck
            ? "+"
            : "";
      const san = toSAN(
        prev.board, move, prev.turn, prev.castling, prev.ep, lang, suffix
      );

      setState({
        board: r.board,
        turn: nextTurn,
        castling: r.castling,
        ep: r.ep,
        halfmove,
        lastMove: move,
        log: [...prev.log, san],
        uciLog: [...prev.uciLog, moveToUci(move)],
        history: [
          ...prev.history,
          {
            board: prev.board,
            turn: prev.turn,
            castling: prev.castling,
            ep: prev.ep,
            halfmove: prev.halfmove,
            lastMove: prev.lastMove,
            logLength: prev.log.length,
          },
        ],
        selected: null,
        pendingPromotion: null,
        inCheck: nextCheck,
        gameOver: status.over
          ? {
              kind: status.kind,
              winner: status.kind === "checkmate" ? status.winner : null,
            }
          : null,
      });

      // Choreograph the fight animation.
      const shown: Piece = move.promotion
        ? { type: move.promotion, color: piece.color }
        : piece;
      fightId.current += 1;
      setFight({ id: fightId.current, move, piece: shown, captured });
      if (captured || nextCheck) setShakeId((i) => i + 1);
      if (fightTimer.current) window.clearTimeout(fightTimer.current);
      fightTimer.current = window.setTimeout(
        () => setFight(null),
        captured ? 1050 : 620
      );
    },
    [lang]
  );

  // Computer move (waits for any fight animation to finish first).
  useEffect(() => {
    if (state.gameOver || state.turn !== aiColor || fight) return;
    setThinking(true);
    const t = window.setTimeout(() => {
      const t0 = Date.now();
      const { move, stats } = findBestMove(
        { board: state.board, turn: aiColor, castling: state.castling, ep: state.ep },
        level
      );
      setAiStats(stats);
      // Keep the thinking indicator visible long enough to read.
      const wait = Math.max(0, 700 - (Date.now() - t0));
      window.setTimeout(() => {
        setThinking(false);
        if (move) commitMove(move);
      }, wait);
    }, 250);
    return () => window.clearTimeout(t);
  }, [state.board, state.turn, state.gameOver, state.castling, state.ep, aiColor, level, fight, commitMove]);

  const targets = useMemo(
    () =>
      state.selected
        ? legalMovesForSquare(
            state.board,
            state.turn,
            state.selected.x,
            state.selected.y,
            state.castling,
            state.ep
          )
        : [],
    [state.board, state.turn, state.selected, state.castling, state.ep]
  );

  const onSquareClick = useCallback(
    (x: number, y: number) => {
      if (thinking || fight || state.gameOver || state.turn !== playerColor) return;
      if (state.pendingPromotion) return;
      const hit = targets.find((t) => t.toX === x && t.toY === y);
      if (hit) {
        const piece = state.board[hit.fromY][hit.fromX];
        const promoRank = piece?.color === "white" ? 0 : 7;
        if (piece?.type === "P" && y === promoRank) {
          setState((prev) => ({
            ...prev,
            pendingPromotion: {
              from: { x: hit.fromX, y: hit.fromY },
              to: { x, y },
            },
          }));
          return;
        }
        commitMove(hit);
        return;
      }
      const piece = state.board[y][x];
      setState((prev) => ({
        ...prev,
        selected: piece && piece.color === playerColor ? { x, y } : null,
      }));
    },
    [thinking, fight, state.gameOver, state.turn, state.board, state.pendingPromotion, playerColor, targets, commitMove]
  );

  const choosePromotion = useCallback(
    (pt: PieceType) => {
      const pp = state.pendingPromotion;
      if (!pp) return;
      commitMove({
        fromX: pp.from.x,
        fromY: pp.from.y,
        toX: pp.to.x,
        toY: pp.to.y,
        promotion: pt,
      });
    },
    [state.pendingPromotion, commitMove]
  );

  const undo = useCallback(() => {
    if (thinking || fight) return;
    if (fightTimer.current) window.clearTimeout(fightTimer.current);
    setFight(null);
    setState((prev) => {
      const h = [...prev.history];
      if (h.length === 0) return prev;
      let snap = h.pop()!;
      if (snap.turn !== playerColor && h.length > 0) snap = h.pop()!;
      const status = gameStatus(snap.board, snap.turn, snap.castling, snap.ep, snap.halfmove);
      return {
        ...prev,
        board: snap.board,
        turn: snap.turn,
        castling: snap.castling,
        ep: snap.ep,
        halfmove: snap.halfmove,
        lastMove: snap.lastMove,
        log: prev.log.slice(0, snap.logLength),
        uciLog: prev.uciLog.slice(0, snap.logLength),
        history: h,
        selected: null,
        pendingPromotion: null,
        inCheck: !status.over && inCheck(snap.board, snap.turn),
        gameOver: null,
      };
    });
  }, [thinking, fight, playerColor]);

  const newGame = useCallback((color: Color) => {
    if (fightTimer.current) window.clearTimeout(fightTimer.current);
    setPlayerColor(color);
    setThinking(false);
    setAiStats(null);
    setFight(null);
    setState(freshState());
  }, []);

  const captured = useMemo(() => {
    const remaining: Record<Color, Record<PieceType, number>> = {
      white: { K: 0, Q: 0, R: 0, B: 0, N: 0, P: 0 },
      black: { K: 0, Q: 0, R: 0, B: 0, N: 0, P: 0 },
    };
    for (const row of state.board)
      for (const p of row) if (p) remaining[p.color][p.type]++;
    const taken = (color: Color): Piece[] => {
      const out: Piece[] = [];
      (Object.keys(INITIAL_COUNTS) as PieceType[]).forEach((t) => {
        for (let i = 0; i < INITIAL_COUNTS[t] - remaining[color][t]; i++)
          out.push({ type: t, color });
      });
      return out;
    };
    return { byYou: taken(aiColor), byComputer: taken(playerColor) };
  }, [state.board, aiColor, playerColor]);

  const checkAt = useMemo(
    () => (state.inCheck ? findKing(state.board, state.turn) : null),
    [state.board, state.turn, state.inCheck]
  );

  const statusText = state.gameOver
    ? state.gameOver.kind === "checkmate"
      ? s.checkmate(state.gameOver.winner === "white" ? s.whiteName : s.blackName)
      : state.gameOver.kind === "stalemate"
        ? s.stalemateDraw()
        : state.gameOver.kind === "fifty-move"
          ? s.fiftyMoveDraw()
          : s.materialDraw()
    : s.toMove(
        state.turn === "white" ? s.whiteName : s.blackName,
        state.inCheck
      );

  const logPairs = useMemo(() => {
    const pairs: Array<[string, string?]> = [];
    for (let i = 0; i < state.log.length; i += 2)
      pairs.push([state.log[i], state.log[i + 1]]);
    return pairs;
  }, [state.log]);

  const isMate = state.gameOver?.kind === "checkmate";

  return (
    <div className="ch-page">
      <header className="ch-header">
        <div className="ch-brand">
          <h1 className="ch-title">{s.title}</h1>
          <p className="ch-subtitle">{s.subtitle}</p>
        </div>
        <div className="ch-controls">
          <div className="ch-lang" role="group" aria-label="Language / Ngôn ngữ">
            <button
              type="button"
              className={lang === "en" ? "active" : ""}
              onClick={() => setLang("en")}
            >
              EN
            </button>
            <button
              type="button"
              className={lang === "vi" ? "active" : ""}
              onClick={() => setLang("vi")}
            >
              VI
            </button>
          </div>
          <label className="ch-field">
            <span>{s.level}</span>
            <select
              value={level}
              onChange={(e) => setLevel(Number(e.target.value))}
              className="ch-select"
            >
              {LEVELS.map((l) => (
                <option key={l.level} value={l.level}>
                  {s.levelLabel(l.level)} — {s.levelDesc[l.level - 1]}
                </option>
              ))}
            </select>
          </label>
          <label className="ch-field">
            <span>{s.youPlay}</span>
            <select
              value={playerColor}
              onChange={(e) => newGame(e.target.value as Color)}
              className="ch-select"
            >
              <option value="white">{s.whiteFirst}</option>
              <option value="black">{s.blackSecond}</option>
            </select>
          </label>
          <div className="ch-buttons">
            <button
              type="button"
              className="ch-btn"
              onClick={undo}
              disabled={thinking || !!fight || state.history.length === 0}
            >
              {s.undo}
            </button>
            <button
              type="button"
              className="ch-btn ch-btn-primary"
              onClick={() => newGame(playerColor)}
            >
              {s.newGame}
            </button>
          </div>
        </div>
      </header>

      <div
        className={`ch-status ${state.gameOver ? "ch-status-over" : ""} ${
          thinking ? "ch-status-thinking" : ""
        }`}
        role="status"
        aria-live="polite"
      >
        {thinking ? (
          <span className="ch-thinking">
            <span className="ch-spinner" aria-hidden="true" />
            <span>
              {s.thinking}
              <span className="ch-dots" aria-hidden="true">
                <span>.</span>
                <span>.</span>
                <span>.</span>
              </span>
              <span className="ch-think-meta">
                {s.thinkMeta(s.levelLabel(level), getLevelConfig(level).depth)}
              </span>
            </span>
          </span>
        ) : (
          statusText
        )}
      </div>

      <main className="ch-layout">
        <div className={`ch-board-area ${thinking ? "is-thinking" : ""}`}>
          <div
            key={shakeId}
            className={`ch-board-fit ${shakeId > 0 ? "shake" : ""}`}
          >
            <Board
              board={state.board}
              flipped={playerColor === "black"}
              selected={state.selected}
              targets={targets}
              lastMove={state.lastMove}
              checkAt={checkAt}
              checkKey={state.log.length}
              checkBadge={s.checkBadge}
              fight={fight}
              interactive={
                !thinking && !fight && !state.gameOver &&
                state.turn === playerColor && !state.pendingPromotion
              }
              boardLabel={s.boardLabel}
              onSquareClick={onSquareClick}
            />
            {thinking && (
              <div className="ch-think-overlay" aria-hidden="true">
                <span className="ch-spinner ch-spinner-lg" />
              </div>
            )}
            {state.pendingPromotion && (
              <div className="ch-promo-overlay">
                <div className="ch-promo-dialog" role="dialog" aria-label={s.promoteTitle}>
                  <p>{s.promoteTitle}</p>
                  <div className="ch-promo-choices">
                    {PROMO_CHOICES.map((pt) => (
                      <button
                        key={pt}
                        type="button"
                        onClick={() => choosePromotion(pt)}
                        title={s.pieceName(pt)}
                      >
                        {GLYPHS[pt]}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
            {isMate && (
              <div className="ch-mate-overlay" aria-hidden="true">
                <div key={state.log.length} className="ch-mate-banner">
                  <span className="ch-mate-crown">♔</span>
                  <span>{s.checkmateBadge}</span>
                </div>
              </div>
            )}
            {state.gameOver && !fight && (
              <GameOverPanel
                gameOver={state.gameOver}
                playerColor={playerColor}
                level={level}
                moves={state.log.length}
                board={state.board}
                lang={lang}
                onNewGame={() => newGame(playerColor)}
              />
            )}
          </div>
        </div>

        <aside className="ch-panel">
          <section>
            <h2>{s.computer}</h2>
            <div className="ch-captured-row">
              <span className="ch-captured-label">{s.strength}</span>
              <span>
                {s.levelLabel(level)} · {s.levelDesc[level - 1]}
              </span>
            </div>
            <div className="ch-captured-row">
              <span className="ch-captured-label">{s.lastSearch}</span>
              <span className="ch-stats">
                {aiStats
                  ? s.searchStats(
                      aiStats.depth,
                      num(formatNodes(aiStats.nodes)),
                      num((aiStats.timeMs / 1000).toFixed(1))
                    )
                  : "—"}
              </span>
            </div>
          </section>

          <section>
            <h2>{s.captured}</h2>
            <div className="ch-captured-row">
              <span className="ch-captured-label">{s.youTook}</span>
              <span className="ch-captured-pieces">
                {captured.byYou.length === 0
                  ? "—"
                  : captured.byYou.map((p, i) => (
                      <span key={i} className="ch-cap">
                        {GLYPHS[p.type]}
                      </span>
                    ))}
              </span>
            </div>
            <div className="ch-captured-row">
              <span className="ch-captured-label">{s.computerTook}</span>
              <span className="ch-captured-pieces">
                {captured.byComputer.length === 0
                  ? "—"
                  : captured.byComputer.map((p, i) => (
                      <span key={i} className="ch-cap">
                        {GLYPHS[p.type]}
                      </span>
                    ))}
              </span>
            </div>
          </section>

          <section className="ch-moves">
            <h2>{s.moves}</h2>
            <ol className="ch-log">
              {logPairs.length === 0 && (
                <li className="ch-log-empty">{s.noMoves}</li>
              )}
              {logPairs.map(([a, b], i) => (
                <li key={i}>
                  <span className="ch-log-num">{i + 1}.</span> {a}
                  {b ? <span> {b}</span> : null}
                </li>
              ))}
            </ol>
          </section>

          <section className="ch-help">
            <h2>{s.howToPlay}</h2>
            <ul>
              {s.helpBullets.map((b, i) => (
                <li key={i}>{b}</li>
              ))}
            </ul>
          </section>
        </aside>
      </main>
    </div>
  );
}
