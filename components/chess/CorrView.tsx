"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Board } from "./Board";
import {
  applyMove,
  gameStatus,
  initialBoard,
  INITIAL_CASTLING,
  inCheck,
  legalMovesForSquare,
} from "@/lib/chess/engine";
import { moveToUci, uciToMove } from "@/lib/chess/uci";
import {
  createCorrGame,
  finishCorrGame,
  getCorrGame,
  listMyCorrGames,
  pushCorrMove,
  resignCorrGame,
  subscribeCorrGame,
  type CorrGame,
  type CorrGameRow,
} from "@/lib/supabase/correspondence";
import { listFriends, type FriendRow } from "@/lib/supabase/friends";
import { useAuth } from "./AuthProvider";
import { usePagination, Pagination } from "./Pagination";
import { notifyPushTrigger } from "@/lib/push/client";
import type {
  Board as BoardT,
  CastlingRights,
  Color,
  Lang,
  Move,
  PieceType,
} from "@/lib/chess/types";
import { opposite } from "@/lib/chess/types";

const PROMO_CHOICES: PieceType[] = ["Q", "R", "B", "N"];

interface BoardState {
  board: BoardT;
  turn: Color;
  castling: CastlingRights;
  ep: { x: number; y: number } | null;
  halfmove: number;
  lastMove: Move | null;
}

function replay(movesStr: string): BoardState {
  let board = initialBoard();
  let castling = { ...INITIAL_CASTLING };
  let ep: { x: number; y: number } | null = null;
  let turn: Color = "white";
  let halfmove = 0;
  let lastMove: Move | null = null;
  const ucis = movesStr.trim().split(/\s+/).filter(Boolean);
  for (const uci of ucis) {
    const m = uciToMove(uci);
    const piece = board[m.fromY][m.fromX];
    const captured = board[m.toY][m.toX];
    const r = applyMove(board, m, castling, ep);
    board = r.board;
    castling = r.castling;
    ep = r.ep;
    if (piece && (piece.type === "P" || captured)) halfmove = 0;
    else halfmove++;
    lastMove = m;
    turn = opposite(turn);
  }
  return { board, turn, castling, ep, halfmove, lastMove };
}

function moveCount(moves: string): number {
  return moves.trim().split(/\s+/).filter(Boolean).length;
}

export function CorrView({ lang }: { lang: Lang }) {
  const { user } = useAuth();
  const [games, setGames] = useState<CorrGameRow[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      setGames(await listMyCorrGames());
    } catch {
      /* not configured */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user) load();
    else setLoading(false);
  }, [user, load]);

  // Refresh the list when returning from a board view
  useEffect(() => {
    if (activeId === null && user) load();
  }, [activeId, user, load]);

  const { page, pageCount, pageItems, setPage } = usePagination(games, 10);

  if (!user) {
    return (
      <div className="ch-view">
        <p>
          {lang === "vi"
            ? "Đăng nhập để chơi cờ thư."
            : "Sign in to play correspondence chess."}
        </p>
      </div>
    );
  }

  if (activeId) {
    return (
      <CorrBoard
        gameId={activeId}
        lang={lang}
        onBack={() => setActiveId(null)}
      />
    );
  }

  return (
    <div className="ch-view">
      <div className="ch-view-head">
        <h2>✉️ {lang === "vi" ? "Cờ thư" : "Correspondence"}</h2>
        <button
          type="button"
          className="ch-btn ch-btn-primary ch-btn-sm"
          onClick={() => setShowNew((v) => !v)}
        >
          ＋ {lang === "vi" ? "Ván mới" : "New game"}
        </button>
      </div>
      {showNew && (
        <NewCorrGame
          lang={lang}
          onCreated={(id) => {
            setShowNew(false);
            setActiveId(id);
          }}
        />
      )}
      {loading ? (
        <p>…</p>
      ) : games.length === 0 ? (
        <p className="ch-hint">
          {lang === "vi"
            ? "Chưa có ván cờ thư nào. Tạo ván mới để chơi với bạn bè theo nhịp của bạn."
            : "No correspondence games yet. Start one to play with friends at your own pace."}
        </p>
      ) : (
        <>
          <ul className="ch-board-list">
            {pageItems.map((g) => {
              const myColor: Color =
                g.white_id === user.id ? "white" : "black";
              const oppName =
                myColor === "white" ? g.black_name : g.white_name;
              const myTurn =
                g.status === "active" &&
                (moveCount(g.moves) % 2 === 0) === (myColor === "white");
              return (
                <li key={g.id}>
                  <button
                    type="button"
                    className="ch-room-row"
                    onClick={() => setActiveId(g.id)}
                  >
                    <span>
                      {oppName}{" "}
                      <span className="ch-lb-title">
                        ({lang === "vi"
                          ? myColor === "white"
                            ? "bạn cầm Trắng"
                            : "bạn cầm Đen"
                          : myColor === "white"
                            ? "you are White"
                            : "you are Black"}
                        )
                      </span>
                    </span>
                    <span>
                      {g.status === "finished" ? (
                        <span className="ch-lb-title">
                          {g.result === "draw"
                            ? lang === "vi"
                              ? "Hòa"
                              : "Draw"
                            : g.winner_id === user.id
                              ? lang === "vi"
                                ? "Thắng"
                                : "Won"
                              : lang === "vi"
                                ? "Thua"
                                : "Lost"}
                        </span>
                      ) : myTurn ? (
                        <span className="ch-turn-badge">
                          {lang === "vi" ? "Đến lượt bạn" : "Your turn"}
                        </span>
                      ) : (
                        <span className="ch-lb-title">
                          {lang === "vi" ? "Chờ đối thủ" : "Waiting"}
                        </span>
                      )}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          <Pagination page={page} pageCount={pageCount} onPage={setPage} />
        </>
      )}
    </div>
  );
}

function NewCorrGame({
  lang,
  onCreated,
}: {
  lang: Lang;
  onCreated: (id: string) => void;
}) {
  const [friends, setFriends] = useState<FriendRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    listFriends().then(setFriends).catch(() => {});
  }, []);

  const start = async (opponentId: string) => {
    setBusy(true);
    setMsg("");
    try {
      const g = await createCorrGame(opponentId);
      onCreated(g.id);
    } catch {
      setMsg(lang === "vi" ? "Lỗi tạo ván." : "Failed to create game.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="ch-corr-new">
      <h3>{lang === "vi" ? "Chọn đối thủ" : "Choose opponent"}</h3>
      {friends.length === 0 ? (
        <p className="ch-hint">
          {lang === "vi"
            ? "Kết bạn trước (tab Bạn bè) để mời chơi cờ thư."
            : "Follow friends first (Friends tab) to invite them."}
        </p>
      ) : (
        <ul className="ch-board-list">
          {friends.map((f) => (
            <li key={f.id} className="ch-lb-row">
              <span className="ch-lb-name">
                {f.full_name || f.username || "Player"}
              </span>
              <button
                type="button"
                className="ch-btn ch-btn-primary ch-btn-sm"
                disabled={busy}
                onClick={() => start(f.id)}
              >
                {lang === "vi" ? "Mời chơi" : "Invite"}
              </button>
            </li>
          ))}
        </ul>
      )}
      {msg && <p className="ch-msg">{msg}</p>}
    </div>
  );
}

function CorrBoard({
  gameId,
  lang,
  onBack,
}: {
  gameId: string;
  lang: Lang;
  onBack: () => void;
}) {
  const { user } = useAuth();
  const [game, setGame] = useState<CorrGame | null>(null);
  const [selected, setSelected] = useState<{ x: number; y: number } | null>(null);
  const [pendingPromo, setPendingPromo] = useState<Move | null>(null);
  const [resigning, setResigning] = useState(false);
  const gameRef = useRef<CorrGame | null>(null);
  gameRef.current = game;

  useEffect(() => {
    getCorrGame(gameId).then((g) => g && setGame(g));
  }, [gameId]);

  useEffect(() => {
    if (!game) return;
    const ch = subscribeCorrGame(game.id, (g) => {
      const local = moveCount(gameRef.current?.moves ?? "");
      const remote = moveCount(g.moves ?? "");
      if (remote >= local) setGame(g);
    });
    return () => {
      ch.unsubscribe();
    };
  }, [game?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const bs = useMemo(() => replay(game?.moves ?? ""), [game?.moves]);

  const myColor: Color | null = useMemo(() => {
    if (!user || !game) return null;
    return game.white_id === user.id ? "white" : "black";
  }, [user, game]);

  const status = useMemo(
    () => gameStatus(bs.board, bs.turn, bs.castling, bs.ep, bs.halfmove),
    [bs]
  );

  // Finish when the game ends (the player who just moved reports)
  const finishedRef = useRef(false);
  useEffect(() => {
    if (!status.over || !game || game.status !== "active" || finishedRef.current)
      return;
    finishedRef.current = true;
    const result =
      status.kind === "checkmate"
        ? status.winner === "white"
          ? ("white" as const)
          : ("black" as const)
        : ("draw" as const);
    const winnerId =
      status.kind === "checkmate"
        ? status.winner === "white"
          ? game.white_id
          : game.black_id
        : null;
    finishCorrGame(game.id, result, winnerId).catch(() => {});
  }, [status, game]);

  const doMove = useCallback(
    async (move: Move) => {
      if (!game || game.status !== "active") return;
      const uci = moveToUci(move);
      const newMoves = ((game.moves ?? "").trim() + " " + uci).trim();
      setGame({ ...game, moves: newMoves });
      try {
        await pushCorrMove(game.id, newMoves);
        notifyPushTrigger({ kind: "corr", gameId: game.id });
      } catch {
        /* realtime will correct */
      }
      setSelected(null);
      setPendingPromo(null);
    },
    [game]
  );

  const targets = useMemo(
    () =>
      selected && myColor
        ? legalMovesForSquare(bs.board, bs.turn, selected.x, selected.y, bs.castling, bs.ep)
        : [],
    [selected, bs, myColor]
  );

  const onSquareClick = useCallback(
    (x: number, y: number) => {
      if (!myColor || bs.turn !== myColor || status.over || !game || game.status !== "active")
        return;
      if (pendingPromo) return;
      const hit = targets.find((t) => t.toX === x && t.toY === y);
      if (hit) {
        const piece = bs.board[hit.fromY][hit.fromX];
        const promoRank = piece?.color === "white" ? 0 : 7;
        if (piece?.type === "P" && y === promoRank) {
          setPendingPromo(hit);
          return;
        }
        doMove(hit);
        return;
      }
      const piece = bs.board[y][x];
      setSelected(piece && piece.color === myColor ? { x, y } : null);
    },
    [myColor, bs, status, game, targets, pendingPromo, doMove]
  );

  const checkAt = useMemo(() => {
    if (!inCheck(bs.board, bs.turn) || status.over) return null;
    for (let y = 0; y < 8; y++)
      for (let x = 0; x < 8; x++) {
        const p = bs.board[y][x];
        if (p && p.type === "K" && p.color === bs.turn) return { x, y };
      }
    return null;
  }, [bs, status]);

  const doResign = async () => {
    if (!game || resigning) return;
    setResigning(true);
    try {
      await resignCorrGame(game.id);
      const g = await getCorrGame(game.id);
      if (g) setGame(g);
    } catch {
      /* ignore */
    } finally {
      setResigning(false);
    }
  };

  if (!game) {
    return (
      <div className="ch-view">
        <p>…</p>
      </div>
    );
  }

  const turnLabel =
    lang === "vi"
      ? bs.turn === "white"
        ? "Trắng đi"
        : "Đen đi"
      : bs.turn === "white"
        ? "White to move"
        : "Black to move";

  return (
    <div className="ch-view">
      <button type="button" className="ch-btn ch-btn-sm" onClick={onBack}>
        ← {lang === "vi" ? "Danh sách" : "Games"}
      </button>
      <div className="ch-room-match">
        <div className="ch-room-status">
          {status.over || game.status === "finished" ? (
            <span>
              {game.result === "draw"
                ? lang === "vi"
                  ? "Hòa!"
                  : "Draw!"
                : game.winner_id === user?.id
                  ? lang === "vi"
                    ? "Bạn thắng! 🎉"
                    : "You won! 🎉"
                  : lang === "vi"
                    ? "Bạn thua."
                    : "You lost."}
            </span>
          ) : (
            <span>
              {turnLabel}
              {myColor === bs.turn && (lang === "vi" ? " (bạn)" : " (you)")}
            </span>
          )}
        </div>
        <div className="ch-board-area">
          <div className="ch-board-fit">
            <Board
              board={bs.board}
              flipped={myColor === "black"}
              selected={selected}
              targets={targets}
              lastMove={bs.lastMove}
              checkAt={checkAt}
              checkKey={0}
              checkBadge=""
              fight={null}
              interactive={!!myColor && bs.turn === myColor && !status.over}
              boardLabel=""
              onSquareClick={onSquareClick}
            />
            {pendingPromo && (
              <div className="ch-promo-overlay">
                <div className="ch-promo-dialog">
                  <div className="ch-promo-choices">
                    {PROMO_CHOICES.map((pt) => (
                      <button
                        key={pt}
                        type="button"
                        onClick={() => doMove({ ...pendingPromo, promotion: pt })}
                      >
                        {pt}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
        {game.status === "active" && !status.over && (
          <div className="ch-room-form">
            <button
              type="button"
              className="ch-btn ch-btn-sm"
              disabled={resigning}
              onClick={doResign}
            >
              🏳️ {lang === "vi" ? "Đầu hàng" : "Resign"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
