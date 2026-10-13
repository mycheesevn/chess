"use client";

import { useState } from "react";
import { renderShareCard, shareCard } from "@/lib/chess/shareCard";
import type { Board as BoardT, Color, Lang } from "@/lib/chess/types";

interface Props {
  gameOver: {
    kind: "checkmate" | "stalemate" | "fifty-move" | "insufficient-material" | "flag";
    winner: Color | null;
  };
  playerColor: Color;
  level: number;
  moves: number;
  board: BoardT;
  lang: Lang;
  onNewGame: () => void;
  onExportVideo?: () => void;
}

export function GameOverPanel({
  gameOver,
  playerColor,
  level,
  moves,
  board,
  lang,
  onNewGame,
  onExportVideo,
}: Props) {
  const [sharing, setSharing] = useState(false);
  const won =
    (gameOver.kind === "checkmate" || gameOver.kind === "flag") &&
    gameOver.winner === playerColor;
  const draw = gameOver.kind !== "checkmate" && gameOver.kind !== "flag";

  const headline =
    gameOver.kind === "flag"
      ? won
        ? lang === "vi"
          ? "⏱ Đối thủ hết giờ — bạn thắng!"
          : "⏱ Opponent flagged — you win!"
        : lang === "vi"
          ? "⏱ Bạn hết giờ — bạn thua!"
          : "⏱ You flagged — you lose!"
      : lang === "vi"
        ? won
          ? "Chiếu hết! Bạn thắng! ♔"
          : draw
            ? "Hòa!"
            : "Bạn thua — phục thù nào!"
        : won
          ? "Checkmate! You won! ♔"
          : draw
            ? "Draw!"
            : "You lost — rematch?";

  const doShare = async () => {
    setSharing(true);
    try {
      const blob = await renderShareCard({
        board,
        playerColor,
        headline,
        subline:
          lang === "vi"
            ? `Thắng máy cấp ${level} · ${moves} nước đi`
            : `Beat level ${level} · ${moves} moves`,
        appName: "Chess vs Computer",
        appUrl: window.location.origin,
      });
      await shareCard(blob, headline, headline, window.location.origin);
    } catch {
      /* share cancelled or failed */
    } finally {
      setSharing(false);
    }
  };

  return (
    <div className="ch-gameover">
      <div className="ch-gameover-card">
        <h3>{headline}</h3>
        <div className="ch-gameover-actions">
          <button
            type="button"
            className="ch-btn ch-btn-primary"
            onClick={doShare}
            disabled={sharing}
          >
            📤 {lang === "vi" ? "Khoe" : "Share"}
          </button>
          {onExportVideo && (
            <button type="button" className="ch-btn" onClick={onExportVideo}>
              🎬 {lang === "vi" ? "Xuất video" : "Video"}
            </button>
          )}
          <button type="button" className="ch-btn" onClick={onNewGame}>
            {lang === "vi" ? "Ván mới" : "New game"}
          </button>
        </div>
      </div>
    </div>
  );
}
