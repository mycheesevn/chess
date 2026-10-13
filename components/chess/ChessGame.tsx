"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Board, type FightAnim } from "./Board";
import { GameOverPanel } from "./GameOverPanel";
import { EvalBar } from "./EvalBar";
import { burstConfetti } from "@/lib/chess/confetti";
import {
  playCapture,
  playCheck,
  playCheckmateFanfare,
  playHint,
  playMove,
  playSadTrombone,
  playSelect,
} from "@/lib/chess/sound";
import { getBigCheckBanner } from "@/lib/chess/checkBanner";
import {
  analyzePosition,
  findBestMove,
  getLevelConfig,
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
import { moveToUci, uciToMove } from "@/lib/chess/uci";
import {
  Board as BoardT,
  CastlingRights,
  Color,
  Lang,
  Level,
  Move,
  Piece,
  PieceType,
  opposite,
} from "@/lib/chess/types";
import { VectorPiece } from "./Pieces";

interface Snapshot {
  board: BoardT;
  turn: Color;
  castling: CastlingRights;
  ep: { x: number; y: number } | null;
  halfmove: number;
  lastMove: Move | null;
  logLength: number;
  clocksMs: { white: number; black: number } | null;
}

export type TcMs = "none" | number;

interface InProgress {
  v: 1;
  uciLog: string[];
  level: number;
  playerColor: Color;
  tcMs: TcMs;
  clocksMs: { white: number; black: number } | null;
}

const IN_PROGRESS_KEY = "chess-in-progress";

function loadProgress(): InProgress | null {
  try {
    const raw = localStorage.getItem(IN_PROGRESS_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as InProgress;
    if (p.v !== 1 || !Array.isArray(p.uciLog)) return null;
    return p;
  } catch {
    return null;
  }
}

function saveProgress(p: InProgress): void {
  try {
    localStorage.setItem(IN_PROGRESS_KEY, JSON.stringify(p));
  } catch {
    /* storage unavailable */
  }
}

function clearSaved(): void {
  try {
    localStorage.removeItem(IN_PROGRESS_KEY);
  } catch {
    /* ignore */
  }
}

/** |score| above this bound means a forced mate was found (matches ai.ts). */
const MATE_SCORE_BOUND = 99000;

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
    kind: "checkmate" | "stalemate" | "fifty-move" | "insufficient-material" | "flag";
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

/** Rebuild a full game state by replaying a saved UCI move list. */
function restoreGame(saved: InProgress, lang: Lang): GameState {
  const st = freshState();
  let board = st.board;
  let castling = { ...INITIAL_CASTLING };
  let ep: { x: number; y: number } | null = null;
  let halfmove = 0;
  let turn: Color = "white";
  let lastMove: Move | null = null;
  const log: string[] = [];
  const uciLog: string[] = [];
  const history: Snapshot[] = [];
  for (const uci of saved.uciLog) {
    const move = uciToMove(uci);
    const piece = board[move.fromY][move.fromX];
    if (!piece) break;
    let captured = board[move.toY][move.toX];
    if (
      !captured &&
      piece.type === "P" &&
      ep &&
      move.toX === ep.x &&
      move.toY === ep.y
    ) {
      captured = board[move.fromY][move.toX];
    }
    history.push({
      board,
      turn,
      castling,
      ep,
      halfmove,
      lastMove,
      logLength: log.length,
      clocksMs: saved.clocksMs,
    });
    const r = applyMove(board, move, castling, ep);
    const nextTurn = opposite(turn);
    halfmove = piece.type === "P" || captured ? 0 : halfmove + 1;
    const status = gameStatus(r.board, nextTurn, r.castling, r.ep, halfmove);
    const nextCheck = !status.over && inCheck(r.board, nextTurn);
    const suffix =
      status.over && status.kind === "checkmate"
        ? "#"
        : nextCheck
          ? "+"
          : "";
    log.push(toSAN(board, move, turn, castling, ep, lang, suffix));
    uciLog.push(uci);
    board = r.board;
    castling = r.castling;
    ep = r.ep;
    turn = nextTurn;
    lastMove = move;
  }
  const finalStatus = gameStatus(board, turn, castling, ep, halfmove);
  return {
    board,
    turn,
    castling,
    ep,
    halfmove,
    lastMove,
    log,
    uciLog,
    history,
    selected: null,
    pendingPromotion: null,
    inCheck: !finalStatus.over && inCheck(board, turn),
    gameOver: finalStatus.over
      ? {
          kind: finalStatus.kind,
          winner: finalStatus.kind === "checkmate" ? finalStatus.winner : null,
        }
      : null,
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
  level,
  onLevelChange,
  playerColor,
  onPlayerColorChange,
  tcMs,
  onTcChange,
  configNonce,
}: {
  onGameEnd?: (
    result: "win" | "loss" | "draw",
    color: "white" | "black",
    level: number,
    plies: number,
    uciMoves: string
  ) => void;
  lang: Lang;
  // Play configuration (level / side / time control) is owned by AppShell —
  // it lives in the drawer's play-settings section (PacClone pattern).
  // The setters keep their familiar names via the aliases below.
  level: Level;
  onLevelChange: (l: Level) => void;
  playerColor: Color;
  onPlayerColorChange: (c: Color) => void;
  tcMs: TcMs;
  onTcChange: (tc: TcMs) => void;
  /** Bumped by AppShell when the drawer changes side/time → start a new game. */
  configNonce: number;
}) {
  const [state, setState] = useState<GameState>(freshState);
  const setLevel = onLevelChange;
  const setPlayerColor = onPlayerColorChange;
  const setTcMs = onTcChange;
  const [thinking, setThinking] = useState(false);
  const [aiStats, setAiStats] = useState<SearchStats | null>(null);
  const [fight, setFight] = useState<FightAnim | null>(null);
  const [shakeId, setShakeId] = useState(0);
  // Big "CHECK!" banner overlay key (user setting — off by default).
  const [checkBannerKey, setCheckBannerKey] = useState(0);
  const reportedEnd = useRef<string | number>(0);
  // Hint.
  const [hintMove, setHintMove] = useState<Move | null>(null);
  const [hintThinking, setHintThinking] = useState(false);
  const [hintToast, setHintToast] = useState<string | null>(null);
  const hintTimer = useRef<number | null>(null);
  // Live eval bar.
  const [evalInfo, setEvalInfo] = useState({
    winProbWhite: 0.5,
    cpWhite: 0,
    mate: false,
  });
  const evalGen = useRef(0);
  // Blitz clocks.
  const [clocksMs, setClocksMs] = useState<{ white: number; black: number } | null>(null);
  const clocksMsRef = useRef(clocksMs);
  clocksMsRef.current = clocksMs;
  // Resume.
  const [restoreToast, setRestoreToast] = useState<string | null>(null);

  const s = STR[lang];
  const num = (v: string) => (lang === "vi" ? v.replace(".", ",") : v);
  const aiColor = opposite(playerColor);
  const fightId = useRef(0);
  const fightTimer = useRef<number | null>(null);
  const stateRef = useRef(state);
  stateRef.current = state;

  const clearHint = useCallback(() => {
    if (hintTimer.current) window.clearTimeout(hintTimer.current);
    setHintMove(null);
    setHintToast(null);
    setHintThinking(false);
  }, []);

  // Resume an in-progress game (auto-saved on every move).
  useEffect(() => {
    const saved = loadProgress();
    if (!saved || saved.uciLog.length === 0) return;
    try {
      const restored = restoreGame(saved, lang);
      setLevel(Math.min(12, Math.max(1, Math.round(saved.level) || 5)));
      setPlayerColor(saved.playerColor === "black" ? "black" : "white");
      setTcMs(saved.tcMs);
      setClocksMs(saved.clocksMs);
      setState(restored);
      setRestoreToast(s.restoreToast);
      window.setTimeout(() => setRestoreToast(null), 4000);
    } catch {
      clearSaved();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    const id = `${state.log.length}`;
    if (reportedEnd.current === id) return;
    reportedEnd.current = id;
    const go = state.gameOver;
    const result: "win" | "loss" | "draw" =
      go.kind === "checkmate" || go.kind === "flag"
        ? go.winner === playerColor
          ? "win"
          : "loss"
        : "draw";
    onGameEnd(result, playerColor, level, state.log.length, state.uciLog.join(" "));
    // Party popper + fanfare when the player wins by checkmate (skill:
    // excitement.md). Sad trombone when the computer mates the player.
    if (go.kind === "checkmate") {
      if (go.winner === playerColor) {
        burstConfetti();
        playCheckmateFanfare();
      } else {
        playSadTrombone();
      }
    }
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

      const isOver = status.over;
      const nextUciLog = [...prev.uciLog, moveToUci(move)];
      setState({
        board: r.board,
        turn: nextTurn,
        castling: r.castling,
        ep: r.ep,
        halfmove,
        lastMove: move,
        log: [...prev.log, san],
        uciLog: nextUciLog,
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
            clocksMs: clocksMsRef.current,
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

      // Auto-save / resume + hint cleanup.
      clearHint();
      if (isOver) clearSaved();
      else
        saveProgress({
          v: 1,
          uciLog: nextUciLog,
          level,
          playerColor,
          tcMs,
          clocksMs: clocksMsRef.current,
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

      // Move/capture/check sounds + the optional big "CHECK!" banner.
      if (captured) playCapture();
      else playMove();
      if (nextCheck && !status.over) {
        playCheck();
        if (getBigCheckBanner()) setCheckBannerKey((k) => k + 1);
      }
    },
    [lang, level, playerColor, tcMs, clearHint]
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

  // Blitz clocks: tick the side to move (AI thinking time is charged to
  // the AI's clock, like PacClone). Starts on the first move.
  const clocksActive = !!clocksMs && !state.gameOver && state.log.length > 0;
  useEffect(() => {
    if (!clocksActive) return;
    const t = window.setInterval(() => {
      const side = stateRef.current.turn;
      setClocksMs((prev) => {
        if (!prev) return prev;
        return { ...prev, [side]: Math.max(0, prev[side] - 100) };
      });
    }, 100);
    return () => window.clearInterval(t);
  }, [clocksActive]);

  // Flag fall = loss for the flagged side.
  useEffect(() => {
    if (!clocksMs || state.gameOver) return;
    const loser: Color | null =
      clocksMs.white <= 0 ? "white" : clocksMs.black <= 0 ? "black" : null;
    if (loser) {
      clearSaved();
      setState((prev) => ({
        ...prev,
        gameOver: { kind: "flag", winner: opposite(loser) },
        inCheck: false,
      }));
    }
  }, [clocksMs, state.gameOver]);

  // Live eval bar: shallow deterministic search after each move.
  useEffect(() => {
    const gen = ++evalGen.current;
    const t = window.setTimeout(() => {
      if (evalGen.current !== gen) return;
      const { board, turn, castling, ep } = stateRef.current;
      const a = analyzePosition(board, turn, castling, ep, 400);
      if (evalGen.current !== gen) return;
      const cpWhite = turn === "white" ? a.score : -a.score;
      setEvalInfo({
        winProbWhite: 1 / (1 + Math.pow(10, -cpWhite / 400)),
        cpWhite: Math.max(-99999, Math.min(99999, cpWhite)),
        mate: Math.abs(a.score) > MATE_SCORE_BOUND,
      });
    }, 60);
    return () => window.clearTimeout(t);
  }, [state.board, state.turn, state.gameOver]);

  // Hint: engine best move, gold rings on from/to + a toast naming the move.
  const doHint = useCallback(() => {
    if (thinking || fight || state.gameOver || hintThinking) return;
    const snap = stateRef.current;
    if (snap.turn !== playerColor) return;
    setHintThinking(true);
    window.setTimeout(() => {
      try {
        const { bestMove } = analyzePosition(
          snap.board,
          snap.turn,
          snap.castling,
          snap.ep,
          1500
        );
        if (bestMove && stateRef.current.turn === playerColor) {
          setHintMove(bestMove);
          playHint();
          const san = toSAN(
            snap.board,
            bestMove,
            snap.turn,
            snap.castling,
            snap.ep,
            lang,
            ""
          );
          setHintToast(s.hintToast(san));
          if (hintTimer.current) window.clearTimeout(hintTimer.current);
          hintTimer.current = window.setTimeout(() => {
            setHintMove(null);
            setHintToast(null);
          }, 4500);
        }
      } finally {
        setHintThinking(false);
      }
    }, 50);
  }, [thinking, fight, state.gameOver, hintThinking, playerColor, lang, s]);

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
      const own = piece && piece.color === playerColor;
      setState((prev) => ({
        ...prev,
        selected: own ? { x, y } : null,
      }));
      if (own) playSelect();
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
    const prev = stateRef.current;
    if (prev.history.length === 0) return;
    if (fightTimer.current) window.clearTimeout(fightTimer.current);
    setFight(null);
    clearHint();
    const h = [...prev.history];
    let snap = h.pop()!;
    if (snap.turn !== playerColor && h.length > 0) snap = h.pop()!;
    const status = gameStatus(snap.board, snap.turn, snap.castling, snap.ep, snap.halfmove);
    setClocksMs(snap.clocksMs);
    saveProgress({
      v: 1,
      uciLog: prev.uciLog.slice(0, snap.logLength),
      level,
      playerColor,
      tcMs,
      clocksMs: snap.clocksMs,
    });
    setState({
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
    });
  }, [thinking, fight, playerColor, level, tcMs, clearHint]);

  const newGame = useCallback(
    (color: Color, tc?: TcMs) => {
      if (fightTimer.current) window.clearTimeout(fightTimer.current);
      const t = tc ?? tcMs;
      setPlayerColor(color);
      setThinking(false);
      setAiStats(null);
      setFight(null);
      setClocksMs(t === "none" ? null : { white: t, black: t });
      clearHint();
      clearSaved();
      setState(freshState());
    },
    [tcMs, clearHint]
  );

  // Drawer play-settings: when AppShell bumps configNonce (side or time
  // control changed in the drawer), start a fresh game with the new config.
  const seenNonce = useRef(configNonce);
  useEffect(() => {
    if (seenNonce.current === configNonce) return;
    seenNonce.current = configNonce;
    newGame(playerColor, tcMs);
  }, [configNonce, newGame, playerColor, tcMs]);

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
      : state.gameOver.kind === "flag"
        ? s.flagged(state.gameOver.winner === "white" ? s.whiteName : s.blackName)
        : state.gameOver.kind === "stalemate"
          ? s.stalemateDraw()
          : state.gameOver.kind === "fifty-move"
            ? s.fiftyMoveDraw()
            : s.materialDraw()
    : s.toMove(
        state.turn === "white" ? s.whiteName : s.blackName,
        state.inCheck
      );

  const fmtClock = (ms: number): string => {
    const totalSec = Math.ceil(ms / 1000);
    const m = Math.floor(totalSec / 60);
    const sec = totalSec % 60;
    if (ms < 20000) {
      const tenths = Math.floor((ms % 1000) / 100);
      return `${m}:${sec.toString().padStart(2, "0")}.${tenths}`;
    }
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  const logPairs = useMemo(() => {
    const pairs: Array<[string, string?]> = [];
    for (let i = 0; i < state.log.length; i += 2)
      pairs.push([state.log[i], state.log[i + 1]]);
    return pairs;
  }, [state.log]);

  const isMate = state.gameOver?.kind === "checkmate";

  return (
    <div className="ch-page">
      <div className="ch-quick">
        <button
          type="button"
          className="ch-btn"
          onClick={undo}
          disabled={thinking || !!fight || state.history.length === 0}
        >
          ↩ {s.undo}
        </button>
        <button
          type="button"
          className="ch-btn"
          onClick={() => newGame(opposite(playerColor))}
          disabled={thinking || !!fight || state.gameOver !== null}
          title={s.switchSides}
        >
          {s.switchSides}
        </button>
        <button
          type="button"
          className="ch-btn"
          onClick={doHint}
          disabled={
            thinking || !!fight || !!state.gameOver ||
            state.turn !== playerColor || hintThinking
          }
          title={s.hint}
        >
          {hintThinking ? s.hintBusy : s.hint}
        </button>
        <span className="ch-quick-spacer" />
        <button
          type="button"
          className="ch-btn ch-btn-primary"
          onClick={() => newGame(playerColor)}
        >
          ＋ {s.newGame}
        </button>
      </div>


      <main className="ch-layout">
        <div className={`ch-board-area ${thinking ? "is-thinking" : ""}`}>
          <div className="ch-board-col">
            {clocksMs && (
              <div className="ch-clock-row">
                <span
                  className={`ch-clock${state.turn === aiColor && !state.gameOver ? " active" : ""}${clocksMs[aiColor] < 20000 ? " low" : ""}`}
                >
                  <svg viewBox="0 0 100 100" className="ch-clock-king" aria-hidden="true">
                    <VectorPiece type="K" color={aiColor} />
                  </svg>{" "}
                  {fmtClock(clocksMs[aiColor])}
                </span>
              </div>
            )}
            <div className="ch-board-with-eval">
              <EvalBar
                winProbWhite={evalInfo.winProbWhite}
                cpWhite={evalInfo.cpWhite}
                mate={evalInfo.mate}
                flipped={playerColor === "black"}
              />
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
              hintMove={hintMove}
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
                        <svg viewBox="0 0 100 100" className="ch-promo-piece" aria-hidden="true">
                          <VectorPiece type={pt} color={playerColor} />
                        </svg>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
            {isMate && (
              <div className="ch-mate-overlay" aria-hidden="true">
                <div key={state.log.length} className="ch-mate-banner">
                  <span className="ch-mate-crown">
                    <svg viewBox="0 0 100 100" aria-hidden="true">
                      <VectorPiece type="K" color="white" />
                    </svg>
                  </span>
                  <span>{s.checkmateBadge}</span>
                </div>
              </div>
            )}
            {checkBannerKey > 0 && !state.gameOver && (
              <div
                key={checkBannerKey}
                className="ch-check-banner"
                onAnimationEnd={() => setCheckBannerKey(0)}
              >
                <span>⚔️ {s.checkBadge}</span>
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
          {clocksMs && (
            <div className="ch-clock-row">
              <span
                className={`ch-clock${state.turn === playerColor && !state.gameOver ? " active" : ""}${clocksMs[playerColor] < 20000 ? " low" : ""}`}
              >
                <svg viewBox="0 0 100 100" className="ch-clock-king" aria-hidden="true">
                  <VectorPiece type="K" color={playerColor} />
                </svg>{" "}
                {fmtClock(clocksMs[playerColor])}
              </span>
            </div>
          )}
        </div>
      </div>

      {hintToast && (
        <div className="ch-hint-toast" role="status">
          {hintToast}
        </div>
      )}
      {restoreToast && <div className="ch-toast">{restoreToast}</div>}

        <aside className="ch-panel">
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
                        <svg viewBox="0 0 100 100" className="ch-cap-piece" aria-hidden="true">
                          <VectorPiece type={p.type} color={p.color} />
                        </svg>
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
                        <svg viewBox="0 0 100 100" className="ch-cap-piece" aria-hidden="true">
                          <VectorPiece type={p.type} color={p.color} />
                        </svg>
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
