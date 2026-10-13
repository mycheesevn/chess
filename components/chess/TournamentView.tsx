"use client";

import { useEffect, useState } from "react";
import {
  createTournament,
  listTournaments,
  standings,
  type Tournament,
} from "@/lib/supabase/tournaments";
import { useAuth } from "./AuthProvider";
import type { Lang } from "@/lib/chess/types";

export function TournamentView({
  roomId,
  isLeader,
  lang,
}: {
  roomId: string;
  isLeader: boolean;
  lang: Lang;
}) {
  const { user } = useAuth();
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [name, setName] = useState("");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    if (user) listTournaments(roomId).then(setTournaments).catch(() => {});
  }, [roomId, user]);

  const doCreate = async () => {
    setMsg("");
    try {
      const t = await createTournament(roomId, name.trim() || (lang === "vi" ? "Giải đấu" : "Tournament"));
      setName("");
      setTournaments([t, ...tournaments]);
    } catch (e) {
      setMsg(
        lang === "vi"
          ? "Cần ít nhất 3 người chơi và không có giải/ván đang diễn ra."
          : "Need 3+ players and no active tournament/match."
      );
    }
  };

  if (!user) return null;

  return (
    <div className="ch-tournaments">
      <h3>🏆 {lang === "vi" ? "Giải đấu" : "Tournaments"}</h3>
      {isLeader && (
        <div className="ch-room-form">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={lang === "vi" ? "Tên giải" : "Tournament name"}
            className="ch-input"
          />
          <button type="button" className="ch-btn ch-btn-sm" onClick={doCreate}>
            {lang === "vi" ? "Tạo giải" : "Create"}
          </button>
        </div>
      )}
      {msg && <p className="ch-msg">{msg}</p>}
      {tournaments.map((t) => (
        <div key={t.id} className="ch-tournament">
          <strong>{t.name}</strong>
          <span className="ch-hint"> ({t.status})</span>
          <ol className="ch-board-list">
            {standings(t).map((s, i) => (
              <li key={s.player} className="ch-lb-row">
                <span className="ch-lb-rank">#{i + 1}</span>
                <span className="ch-lb-name">{s.player.slice(0, 8)}…</span>
                <span className="ch-lb-xp">{s.score}</span>
              </li>
            ))}
          </ol>
        </div>
      ))}
    </div>
  );
}
