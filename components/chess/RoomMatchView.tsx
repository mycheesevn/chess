"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Board } from "./Board";
import { VectorPiece } from "./Pieces";
import { MatchSocial } from "./MatchSocial";
import { notifyPushTrigger } from "@/lib/push/client";
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
  finishRoomMatch,
  getActiveMatch,
  pushMove,
  startRematch,
  subscribeMatch,
  subscribeRoomMatches,
  type RoomMatch,
} from "@/lib/supabase/rooms";
import { useAuth } from "./AuthProvider";
import { burstConfetti } from "@/lib/chess/confetti";
import {
  playCapture,
  playCheck,
  playMove,
  playSelect,
} from "@/lib/chess/sound";
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

export function RoomMatchView({
  roomId,
  matchId: initialMatchId,
  lang,
}: {
  roomId: string;
  matchId: string | null;
  lang: Lang;
}) {
  const { user } = useAuth();
  const [match, setMatch] = useState<RoomMatch | null>(null);
  const [selected, setSelected] = useState<{ x: number; y: number } | null>(null);
  const [pendingPromo, setPendingPromo] = useState<Move | null>(null);
  const [viewerCount, setViewerCount] = useState(0);
  const [rematching, setRematching] = useState(false);
  const [rematchMsg, setRematchMsg] = useState("");
  const matchRef = useRef<RoomMatch | null>(null);
  matchRef.current = match;
  const finishedRef = useRef(false);

  useEffect(() => {
    if (initialMatchId) {
      // Fetch full match row
      getActiveMatch(roomId).then((m) => {
        if (m && m.id === initialMatchId) setMatch(m);
      });
    } else {
      getActiveMatch(roomId).then(setMatch);
    }
  }, [roomId, initialMatchId]);

  useEffect(() => {
    if (!match) return;
    const ch = subscribeMatch(
      match.id,
      (m) => {
        // Only update if the remote has more moves (avoid echo loops)
        const local = (matchRef.current?.moves ?? "").trim().split(/\s+/).filter(Boolean).length;
        const remote = (m.moves ?? "").trim().split(/\s+/).filter(Boolean).length;
        if (remote >= local) setMatch(m);
      },
      { onPresence: setViewerCount, userId: user?.id }
    );
    return () => {
      ch.unsubscribe();
    };
  }, [match?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Switch to a newly created match in this room (e.g. a rematch)
  // without requiring a refresh.
  useEffect(() => {
    const ch = subscribeRoomMatches(roomId, (m) => {
      if (m.status !== "active") return;
      const cur = matchRef.current;
      if (cur && cur.id === m.id) return;
      finishedRef.current = false;
      setSelected(null);
      setPendingPromo(null);
      setMatch(m);
    });
    return () => {
      ch.unsubscribe();
    };
  }, [roomId]);

  const bs = useMemo(() => replay(match?.moves ?? ""), [match?.moves]);

  const myColor: Color | null = useMemo(() => {
    if (!user || !match) return null;
    if (match.white_id === user.id) return "white";
    if (match.black_id === user.id) return "black";
    return null; // spectator
  }, [user, match]);

  const status = useMemo(
    () => gameStatus(bs.board, bs.turn, bs.castling, bs.ep, bs.halfmove),
    [bs]
  );

  // Sounds for new moves (local + remote): capture knock vs quiet knock,
  // check chime. Only the newest move sounds — never replays history.
  const soundedPly = useRef(0);
  useEffect(() => {
    const ucis = (match?.moves ?? "").trim().split(/\s+/).filter(Boolean);
    const n = ucis.length;
    if (n > soundedPly.current) {
      soundedPly.current = n;
      const prev = replay(ucis.slice(0, n - 1).join(" "));
      const m = uciToMove(ucis[n - 1]);
      if (prev.board[m.toY][m.toX]) playCapture();
      else playMove();
      if (inCheck(bs.board, bs.turn) && !status.over) playCheck();
    } else if (n < soundedPly.current) {
      soundedPly.current = n; // new match — resync silently
    }
  }, [match?.moves, bs, status]);

  // Finish the match when the game ends (only the player who just moved reports)
  useEffect(() => {
    if (!status.over || !match || match.status !== "active" || finishedRef.current) return;
    finishedRef.current = true;
    // Party popper for the local winner (skill: excitement.md — same as live).
    if (status.kind === "checkmate" && myColor && status.winner === myColor)
      burstConfetti();
    const result =
      status.kind === "checkmate"
        ? status.winner === "white"
          ? ("white" as const)
          : ("black" as const)
        : ("draw" as const);
    const winnerId =
      status.kind === "checkmate"
        ? status.winner === "white"
          ? match.white_id
          : match.black_id
        : null;
    finishRoomMatch(match.id, result, status.kind, winnerId).catch(() => {});
  }, [status, match]);

  const doMove = useCallback(
    async (move: Move) => {
      if (!match || match.status !== "active") return;
      const uci = moveToUci(move);
      const newMoves = ((match.moves ?? "").trim() + " " + uci).trim();
      // Optimistic local update
      setMatch({ ...match, moves: newMoves });
      try {
        await pushMove(match.id, newMoves);
        notifyPushTrigger({ kind: "turn", matchId: match.id });
      } catch {
        /* realtime will correct */
      }
      setSelected(null);
      setPendingPromo(null);
    },
    [match]
  );

  const doRematch = useCallback(async () => {
    if (!match || match.status === "active" || !myColor) return;
    setRematching(true);
    setRematchMsg("");
    try {
      await startRematch(roomId, match.id);
      // The room-level INSERT subscription switches both players to the
      // new match automatically.
    } catch {
      setRematchMsg(
        lang === "vi" ? "Không thể bắt đầu ván mới." : "Could not start a rematch."
      );
    } finally {
      setRematching(false);
    }
  }, [match, myColor, roomId, lang]);

  const targets = useMemo(
    () =>
      selected && myColor
        ? legalMovesForSquare(bs.board, bs.turn, selected.x, selected.y, bs.castling, bs.ep)
        : [],
    [selected, bs, myColor]
  );

  const onSquareClick = useCallback(
    (x: number, y: number) => {
      if (!myColor || bs.turn !== myColor || status.over || !match || match.status !== "active")
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
      const own = piece && piece.color === myColor;
      setSelected(own ? { x, y } : null);
      if (own) playSelect();
    },
    [myColor, bs, status, match, targets, pendingPromo, doMove]
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

  if (!match) {
    return (
      <div className="ch-view">
        <p>{lang === "vi" ? "Chưa có ván đấu nào." : "No active match."}</p>
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
    <div className="ch-room-match">
      <div className="ch-room-status">
        {status.over ? (
          <span>
            {status.kind === "checkmate"
              ? lang === "vi"
                ? `Chiếu hết! ${status.winner === "white" ? "Trắng" : "Đen"} thắng`
                : `Checkmate! ${status.winner === "white" ? "White" : "Black"} wins`
              : lang === "vi"
                ? "Hòa!"
                : "Draw!"}
          </span>
        ) : (
          <span>
            {turnLabel}
            {myColor === bs.turn && (lang === "vi" ? " (bạn)" : " (you)")}
            {myColor === null && (lang === "vi" ? " (khán giả)" : " (spectator)")}
          </span>
        )}
        {viewerCount > 0 && (
          <span className="ch-viewers" title={lang === "vi" ? "Đang xem" : "Watching"}>
            👁 {viewerCount}
          </span>
        )}
      </div>
      {status.over && match.status !== "active" && myColor && (
        <div className="ch-rematch-row">
          <button
            type="button"
            className="ch-btn ch-btn-primary ch-btn-sm"
            disabled={rematching}
            onClick={doRematch}
          >
            🔁 {lang === "vi" ? "Đấu lại" : "Rematch"}
          </button>
          {rematchMsg && <span className="ch-msg">{rematchMsg}</span>}
        </div>
      )}
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
                      onClick={() =>
                        doMove({ ...pendingPromo, promotion: pt })
                      }
                    >
                      <svg viewBox="0 0 100 100" className="ch-promo-piece" aria-hidden="true">
                        <VectorPiece type={pt} color={myColor ?? "white"} />
                      </svg>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      <MatchSocial roomId={roomId} matchId={match.id} lang={lang} />
    </div>
  );
}
