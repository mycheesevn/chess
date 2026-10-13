"use client";

import { useEffect, useState } from "react";
import {
  createRoom,
  joinRoom,
  listMyRooms,
  listPublicRooms,
  startMatch,
  type Room,
} from "@/lib/supabase/rooms";
import { useAuth } from "./AuthProvider";
import { RoomMatchView } from "./RoomMatchView";
import { TournamentView } from "./TournamentView";
import type { Lang } from "@/lib/chess/types";

export function RoomView({ lang }: { lang: Lang }) {
  const { user } = useAuth();
  const [myRooms, setMyRooms] = useState<Room[]>([]);
  const [publicRooms, setPublicRooms] = useState<Room[]>([]);
  const [activeRoom, setActiveRoom] = useState<Room | null>(null);
  const [roomName, setRoomName] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [joinCode, setJoinCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const load = async () => {
    try {
      setMyRooms(await listMyRooms());
      setPublicRooms(await listPublicRooms());
    } catch {
      /* not configured */
    }
  };

  useEffect(() => {
    if (user) load();
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!user) {
    return (
      <div className="ch-view">
        <p>{lang === "vi" ? "Đăng nhập để chơi phòng." : "Sign in to play in rooms."}</p>
      </div>
    );
  }

  if (activeRoom) {
    return (
      <div className="ch-view">
        <button type="button" className="ch-btn ch-btn-sm" onClick={() => setActiveRoom(null)}>
          ← {activeRoom.name} ({activeRoom.code})
        </button>
        <RoomDetail room={activeRoom} lang={lang} onUpdate={load} />
      </div>
    );
  }

  const doCreate = async () => {
    if (!roomName.trim()) return;
    setBusy(true);
    setMsg("");
    try {
      const room = await createRoom(roomName.trim(), isPublic);
      setRoomName("");
      await load();
      setActiveRoom(room);
    } catch {
      setMsg(lang === "vi" ? "Lỗi tạo phòng." : "Failed to create room.");
    } finally {
      setBusy(false);
    }
  };

  const doJoin = async () => {
    if (!joinCode.trim()) return;
    setBusy(true);
    setMsg("");
    try {
      const room = await joinRoom(joinCode.trim());
      setJoinCode("");
      await load();
      setActiveRoom(room);
    } catch {
      setMsg(lang === "vi" ? "Không tìm thấy phòng." : "Room not found.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="ch-view">
      <h2>👥 {lang === "vi" ? "Phòng chơi" : "Game rooms"}</h2>

      <div className="ch-room-form">
        <input
          value={roomName}
          onChange={(e) => setRoomName(e.target.value)}
          placeholder={lang === "vi" ? "Tên phòng mới" : "New room name"}
          className="ch-input"
        />
        <label className="ch-check">
          <input
            type="checkbox"
            checked={isPublic}
            onChange={(e) => setIsPublic(e.target.checked)}
          />
          🌐 {lang === "vi" ? "Phòng công khai" : "Public room"}
        </label>
        <button type="button" className="ch-btn ch-btn-primary" disabled={busy} onClick={doCreate}>
          {lang === "vi" ? "Tạo phòng" : "Create room"}
        </button>
      </div>

      <div className="ch-room-form">
        <input
          value={joinCode}
          onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
          placeholder={lang === "vi" ? "Nhập mã phòng" : "Enter room code"}
          className="ch-input"
          maxLength={6}
        />
        <button type="button" className="ch-btn" disabled={busy} onClick={doJoin}>
          {lang === "vi" ? "Tham gia" : "Join"}
        </button>
      </div>
      {msg && <p className="ch-msg">{msg}</p>}

      <h3>{lang === "vi" ? "Phòng của tôi" : "My rooms"}</h3>
      {myRooms.length === 0 ? (
        <p className="ch-hint">—</p>
      ) : (
        <ul className="ch-board-list">
          {myRooms.map((r) => (
            <li key={r.id}>
              <button type="button" className="ch-room-row" onClick={() => setActiveRoom(r)}>
                <span>{r.name}</span>
                <code>{r.code}</code>
              </button>
            </li>
          ))}
        </ul>
      )}

      <h3>🌐 {lang === "vi" ? "Sảnh chung" : "Public lobby"}</h3>
      {publicRooms.length === 0 ? (
        <p className="ch-hint">—</p>
      ) : (
        <ul className="ch-board-list">
          {publicRooms.map((r) => (
            <li key={r.id}>
              <button type="button" className="ch-room-row" onClick={() => setActiveRoom(r)}>
                <span>{r.name}</span>
                <code>{r.code}</code>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function RoomDetail({
  room,
  lang,
  onUpdate,
}: {
  room: Room;
  lang: Lang;
  onUpdate: () => void;
}) {
  const { user } = useAuth();
  const [starting, setStarting] = useState(false);
  const isLeader = user && room.leader_id === user.id;

  const doStart = async () => {
    const order = room.turn_order ?? [];
    if (order.length < 2 || !isLeader) return;
    setStarting(true);
    try {
      // First two in turn order play; white = first, black = second
      await startMatch(room.id, order[0], order[1]);
      onUpdate();
    } catch {
      /* ignore */
    } finally {
      setStarting(false);
    }
  };

  return (
    <div>
      {isLeader && (
        <button
          type="button"
          className="ch-btn ch-btn-primary"
          disabled={starting}
          onClick={doStart}
        >
          ▶ {lang === "vi" ? "Bắt đầu ván mới" : "Start new match"}
        </button>
      )}
      <RoomMatchView roomId={room.id} matchId={null} lang={lang} />
      <TournamentView roomId={room.id} isLeader={!!isLeader} lang={lang} />
    </div>
  );
}
