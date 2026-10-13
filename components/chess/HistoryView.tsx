"use client";

import { useEffect, useMemo, useState } from "react";
import { Board } from "./Board";
import { Pagination, usePagination } from "./Pagination";
import { useAuth } from "./AuthProvider";
import { fetchGameHistory, type ChessGameRow } from "@/lib/supabase/engagement";
import {
  applyMove,
  initialBoard,
  INITIAL_CASTLING,
} from "@/lib/chess/engine";
import { uciToMove } from "@/lib/chess/uci";
import type { Board as BoardT, Lang } from "@/lib/chess/types";
import { opposite } from "@/lib/chess/types";

function boardAfter(movesStr: string, plyCount: number): BoardT {
  let board = initialBoard();
  let castling = { ...INITIAL_CASTLING };
  let ep: { x: number; y: number } | null = null;
  const ucis = movesStr.trim().split(/\s+/).filter(Boolean).slice(0, plyCount);
  for (const uci of ucis) {
    const r = applyMove(board, uciToMove(uci), castling, ep);
    board = r.board;
    castling = r.castling;
    ep = r.ep;
  }
  return board;
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
      <div className="ch-view">
        <p>{lang === "vi" ? "Đăng nhập để xem lịch sử." : "Sign in to view history."}</p>
      </div>
    );
  }

  if (replay) {
    const totalPlies = replay.moves.trim().split(/\s+/).filter(Boolean).length;
    return (
      <div className="ch-view">
        <button type="button" className="ch-btn ch-btn-sm" onClick={() => setReplay(null)}>
          ← {lang === "vi" ? "Lịch sử" : "History"}
        </button>
        <div className="ch-board-area" style={{ marginTop: 12 }}>
          <div className="ch-board-fit">
            <Board
              board={boardAfter(replay.moves, ply)}
              flipped={replay.player_color === "black"}
              selected={null}
              targets={[]}
              lastMove={null}
              checkAt={null}
              checkKey={0}
              checkBadge=""
              fight={null}
              interactive={false}
              boardLabel=""
              onSquareClick={() => {}}
            />
          </div>
        </div>
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
        </div>
      </div>
    );
  }

  const resultIcon = (r: string) =>
    r === "win" ? "✅" : r === "loss" ? "❌" : "➖";

  return (
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
  );
}
