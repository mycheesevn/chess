"use client";

import { useEffect, useMemo, useState } from "react";
import { Board, type FightAnim } from "./Board";
import { VectorPiece } from "./Pieces";
import { Pagination, usePagination } from "./Pagination";
import { burstConfetti } from "@/lib/chess/confetti";
import { useAuth } from "./AuthProvider";
import { fetchGameHistory, type ChessGameRow } from "@/lib/supabase/engagement";
import {
  applyMove,
  gameStatus,
  initialBoard,
  INITIAL_CASTLING,
} from "@/lib/chess/engine";
import { uciToMove } from "@/lib/chess/uci";
import type { Board as BoardT, CastlingRights, Lang, Move } from "@/lib/chess/types";
import { opposite } from "@/lib/chess/types";
import { useRef } from "react";

interface BoardState {
  board: BoardT;
  turn: "white" | "black";
  castling: CastlingRights;
  ep: { x: number; y: number } | null;
}

function boardStateAfter(movesStr: string, plyCount: number): BoardState {
  let board = initialBoard();
  let castling = { ...INITIAL_CASTLING };
  let ep: { x: number; y: number } | null = null;
  let turn: "white" | "black" = "white";
  const ucis = movesStr.trim().split(/\s+/).filter(Boolean).slice(0, plyCount);
  for (const uci of ucis) {
    const r = applyMove(board, uciToMove(uci), castling, ep);
    board = r.board;
    castling = r.castling;
    ep = r.ep;
    turn = opposite(turn);
  }
  return { board, turn, castling, ep };
}

function boardAfter(movesStr: string, plyCount: number): BoardT {
  return boardStateAfter(movesStr, plyCount).board;
}

export function HistoryView({ lang }: { lang: Lang }) {
  const { user } = useAuth();
  const [games, setGames] = useState<ChessGameRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [replay, setReplay] = useState<ChessGameRow | null>(null);
  const [ply, setPly] = useState(0);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    fetchGameHistory(100)
      .then(setGames)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user]);

  const { page, pageCount, pageItems, setPage } = usePagination(games, 10);

  // --- replay celebration state ---
  const [fightAnim, setFightAnim] = useState<FightAnim | null>(null);
  const [shakeKey, setShakeKey] = useState(0);
  const [autoplay, setAutoplay] = useState(false);
  const celebratedRef = useRef<string | null>(null);
  const fightTimer = useRef<number | null>(null);

  const replayUcis = useMemo(
    () =>
      replay
        ? replay.moves.trim().split(/\s+/).filter(Boolean)
        : [],
    [replay]
  );
  const totalPlies = replayUcis.length;

  // Final position + status (for the checkmate celebration).
  const finalState = useMemo(
    () => (replay ? boardStateAfter(replay.moves, totalPlies) : null),
    [replay, totalPlies]
  );
  const finalStatus = useMemo(
    () =>
      finalState
        ? gameStatus(
            finalState.board,
            finalState.turn,
            finalState.castling,
            finalState.ep,
            0
          )
        : null,
    [finalState]
  );
  const endedInCheckmate =
    !!replay && ply === totalPlies && totalPlies > 0 &&
    !!finalStatus?.over && finalStatus.kind === "checkmate";

  // New game: reset celebration bookkeeping.
  useEffect(() => {
    celebratedRef.current = null;
    setFightAnim(null);
    setAutoplay(false);
    if (fightTimer.current) window.clearTimeout(fightTimer.current);
  }, [replay?.id]);

  // Checkmate celebration when stepping (or autoplaying) to the final ply.
  useEffect(() => {
    if (!replay || !endedInCheckmate) return;
    if (celebratedRef.current === replay.id) return;
    celebratedRef.current = replay.id;
    setShakeKey((k) => k + 1);
    burstConfetti();
  }, [replay, endedInCheckmate, ply]); // eslint-disable-line react-hooks/exhaustive-deps

  // Glide animation for manual navigation: synthesize the Board's fight
  // overlay (mover only, no clash) so steps feel like watching the game.
  useEffect(() => {
    if (fightTimer.current) window.clearTimeout(fightTimer.current);
    if (!replay || ply <= 0) {
      setFightAnim(null);
      return;
    }
    const uci = replayUcis[ply - 1];
    if (!uci) return;
    const move = uciToMove(uci);
    const prev = boardStateAfter(replay.moves, ply - 1);
    const piece = prev.board[move.fromY][move.fromX];
    if (!piece) return;
    setFightAnim({ id: ply, move, piece, captured: null });
    fightTimer.current = window.setTimeout(() => setFightAnim(null), 500);
  }, [ply, replay, replayUcis]);

  // Autoplay.
  useEffect(() => {
    if (!autoplay || !replay) return;
    if (ply >= totalPlies) {
      setAutoplay(false);
      return;
    }
    const t = window.setTimeout(() => setPly((p) => p + 1), 700);
    return () => window.clearTimeout(t);
  }, [autoplay, ply, replay, totalPlies]);

  const currentMove: Move | null =
    replay && ply > 0 && replayUcis[ply - 1]
      ? uciToMove(replayUcis[ply - 1])
      : null;

  const stats = useMemo(() => {
    let wins = 0,
      losses = 0,
      draws = 0;
    for (const g of games) {
      if (g.result === "win") wins++;
      else if (g.result === "loss") losses++;
      else draws++;
    }
    return { wins, losses, draws };
  }, [games]);

  if (!user) {
    return (
      <div className="ch-scroll-area">
        <div className="ch-view">
          <p>{lang === "vi" ? "Đăng nhập để xem lịch sử." : "Sign in to view history."}</p>
        </div>
      </div>
    );
  }

  if (replay) {
    return (
      <div className="ch-page">
        <div className="ch-layout">
          <div className="ch-board-area">
            <div key={shakeKey} className={`ch-board-fit${shakeKey > 0 ? " shake" : ""}`}>
            <Board
              board={boardAfter(replay.moves, ply)}
              flipped={replay.player_color === "black"}
              selected={null}
              targets={[]}
              lastMove={currentMove}
              checkAt={null}
              checkKey={0}
              checkBadge=""
              fight={fightAnim}
              interactive={false}
              boardLabel=""
              onSquareClick={() => {}}
            />
              {endedInCheckmate && (
                <div className="ch-mate-overlay" aria-hidden="true">
                  <div className="ch-mate-banner">
                    <span className="ch-mate-crown">
                      <svg viewBox="0 0 100 100" aria-hidden="true">
                        <VectorPiece type="K" color="white" />
                      </svg>
                    </span>
                    <span>{lang === "vi" ? "Chiếu hết!" : "Checkmate!"}</span>
                  </div>
                </div>
              )}
            </div>
          </div>
          <aside className="ch-panel">
            <button type="button" className="ch-btn ch-btn-sm" onClick={() => setReplay(null)}>
              ← {lang === "vi" ? "Lịch sử" : "History"}
            </button>
            <div className="ch-replay-controls">
          <button type="button" className="ch-btn ch-btn-sm" disabled={ply === 0} onClick={() => setPly(0)}>
            ⏮
          </button>
          <button type="button" className="ch-btn ch-btn-sm" disabled={ply === 0} onClick={() => setPly((p) => p - 1)}>
            ◀
          </button>
          <span>
            {ply} / {totalPlies}
          </span>
          <button
            type="button"
            className="ch-btn ch-btn-sm"
            disabled={ply === totalPlies}
            onClick={() => setPly((p) => p + 1)}
          >
            ▶
          </button>
          <button
            type="button"
            className="ch-btn ch-btn-sm"
            disabled={ply === totalPlies}
            onClick={() => setPly(totalPlies)}
          >
            ⏭
          </button>
              <button
                type="button"
                className="ch-btn ch-btn-sm"
                disabled={ply === totalPlies}
                onClick={() => setAutoplay((a) => !a)}
              >
                {autoplay
                  ? lang === "vi" ? "⏸ Dừng" : "⏸ Pause"
                  : lang === "vi" ? "⏵ Tự chạy" : "⏵ Auto"}
              </button>
            </div>
            <p className="ch-hint">
              {lang === "vi" ? "Máy cấp" : "Level"} {replay.ai_level} ·{" "}
              {replay.plies} {lang === "vi" ? "nước" : "plies"} ·{" "}
              {new Date(replay.created_at).toLocaleDateString(
                lang === "vi" ? "vi-VN" : "en-US"
              )}
            </p>
          </aside>
        </div>
      </div>
    );
  }

  const resultIcon = (r: string) =>
    r === "win" ? "✅" : r === "loss" ? "❌" : "➖";

  return (
    <div className="ch-scroll-area">
    <div className="ch-view">
      <h2>📜 {lang === "vi" ? "Lịch sử ván đấu" : "Game history"}</h2>
      {loading ? (
        <p>…</p>
      ) : games.length === 0 ? (
        <p className="ch-hint">
          {lang === "vi" ? "Chưa có ván nào." : "No games yet."}
        </p>
      ) : (
        <>
          <p className="ch-hint">
            ✅ {stats.wins} · ❌ {stats.losses} · ➖ {stats.draws}
          </p>
          <ul className="ch-board-list">
            {pageItems.map((g) => (
              <li key={g.id} className="ch-lb-row">
                <span>{resultIcon(g.result)}</span>
                <span className="ch-lb-name">
                  {lang === "vi" ? "Máy cấp" : "Level"} {g.ai_level} ·{" "}
                  {g.plies} {lang === "vi" ? "nước" : "plies"}
                </span>
                <span className="ch-lb-title">
                  {new Date(g.created_at).toLocaleDateString(
                    lang === "vi" ? "vi-VN" : "en-US"
                  )}
                </span>
                {g.moves && (
                  <button
                    type="button"
                    className="ch-btn ch-btn-sm"
                    onClick={() => {
                      setReplay(g);
                      setPly(0);
                    }}
                  >
                    {lang === "vi" ? "Xem lại" : "Replay"}
                  </button>
                )}
              </li>
            ))}
          </ul>
          <Pagination page={page} pageCount={pageCount} onPage={setPage} />
        </>
      )}
    </div>
    </div>
  );
}
