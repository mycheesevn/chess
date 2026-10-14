"use client";

import { useEffect, useRef, useState } from "react";
import { useAuth } from "./AuthProvider";
import {
  fetchProfile,
  updateProfile,
  uploadAvatar,
} from "@/lib/supabase/profile";
import { levelForXp, titleForLevel, xpForNextLevel, LEVEL_THRESHOLDS } from "@/lib/chess/levels";
import { STR } from "@/lib/chess/i18n";
import type { Lang } from "@/lib/chess/types";

interface Props {
  lang: Lang;
  onClose: () => void;
}

function memberSince(iso: string | null, lang: Lang): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString(lang === "vi" ? "vi-VN" : "en-US", {
      day: "numeric",
      month: "numeric",
      year: "numeric",
    });
  } catch {
    return "—";
  }
}

export function ProfileModal({ lang, onClose }: Props) {
  const s = STR[lang];
  const { user, chessStats, refreshProfile } = useAuth();
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [since, setSince] = useState<string | null>(null);
  const [avatarBust, setAvatarBust] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    (async () => {
      try {
        const p = await fetchProfile();
        if (p) {
          setFullName(p.full_name ?? "");
          setUsername(p.username);
          setAvatarUrl(p.avatar_url);
          setSince(p.created_at);
        }
      } catch {
        /* supabase not configured */
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const onPickAvatar = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    setError(null);
    setSaved(false);
    const { url, error: err } = await uploadAvatar(file);
    setUploading(false);
    if (err || !url) {
      setError(err ?? "Upload failed");
      return;
    }
    const saveErr = await updateProfile({ avatar_url: url });
    if (saveErr) {
      setError(saveErr);
      return;
    }
    setAvatarUrl(url);
    setAvatarBust(Date.now());
    setSaved(true);
    void refreshProfile();
  };

  const onSave = async () => {
    setSaving(true);
    setError(null);
    setSaved(false);
    const err = await updateProfile({ full_name: fullName.trim() || null });
    setSaving(false);
    if (err) setError(err);
    else {
      setSaved(true);
      void refreshProfile();
    }
  };

  const xp = chessStats?.xp ?? 0;
  const level = levelForXp(xp);
  const title = titleForLevel(level, lang);
  const nextTh = xpForNextLevel(xp);
  const prevTh = LEVEL_THRESHOLDS[level - 1] ?? 0;
  const intoLevel = xp - prevTh;
  const forNext = (nextTh ?? xp) - prevTh;
  const pct = nextTh === null ? 100 : Math.min(100, (intoLevel / Math.max(1, forNext)) * 100);
  const avatarSrc = avatarUrl ? `${avatarUrl}?v=${avatarBust}` : null;

  return (
    <div className="ch-modal-root" onClick={onClose}>
      <div
        className="ch-modal ch-profile-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label={s.profile}
      >
        <div className="ch-profile-head">
          <h2>👤 {s.profile}</h2>
          <button
            type="button"
            className="ch-btn ch-btn-icon"
            onClick={onClose}
            aria-label={s.authClose}
          >
            ✕
          </button>
        </div>
        {loading ? (
          <p className="ch-muted">…</p>
        ) : (
          <>
            <div className="ch-profile-avatar-row">
              <div className="ch-profile-avatar">
                {avatarSrc ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={avatarSrc} alt={s.profileAvatarAlt} />
                ) : (
                  <span>👤</span>
                )}
              </div>
              <div>
                <button
                  type="button"
                  className="ch-btn ch-btn-sm"
                  disabled={uploading}
                  onClick={() => fileRef.current?.click()}
                >
                  {uploading ? s.profileAvatarUploading : s.profileAvatarChange}
                </button>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  hidden
                  onChange={(e) => {
                    onPickAvatar(e.target.files?.[0]);
                    e.target.value = "";
                  }}
                />
              </div>
            </div>

            <label className="ch-field">
              <span>{s.profileFullName}</span>
              <input
                className="ch-input"
                value={fullName}
                maxLength={80}
                onChange={(e) => setFullName(e.target.value)}
                placeholder={username ?? ""}
              />
            </label>

            <div className="ch-profile-level">
              <div className="ch-profile-level-head">
                <span>⭐ Lv {level} · {title}</span>
                <span className="ch-muted">
                  {nextTh === null
                    ? `${xp} XP`
                    : `${intoLevel}/${forNext} XP`}
                </span>
              </div>
              <div className="ch-profile-xpbar" aria-hidden="true">
                <span style={{ width: `${pct}%` }} />
              </div>
            </div>

            <div className="ch-profile-stats">
              <div className="ch-profile-stat">
                <b>{chessStats?.rating ?? 800}</b>
                <span>{s.profileRating}</span>
              </div>
              <div className="ch-profile-stat">
                <b>{chessStats?.games_played ?? 0}</b>
                <span>{s.profileGames}</span>
              </div>
              <div className="ch-profile-stat">
                <b>{chessStats?.wins ?? 0}</b>
                <span>{s.profileWins}</span>
              </div>
            </div>

            <div className="ch-profile-readonly">
              <div>
                <span className="ch-muted">{s.profileUsername}: </span>
                <strong>{username ?? "—"}</strong>
              </div>
              <div>
                <span className="ch-muted">{s.profileEmail}: </span>
                <strong>{user?.email ?? "—"}</strong>
              </div>
              <div>
                <span className="ch-muted">{s.profileMemberSince}: </span>
                <strong>{memberSince(since, lang)}</strong>
              </div>
            </div>

            {error && <p className="ch-msg ch-msg-error">{error}</p>}
            {saved && <p className="ch-msg">{s.profileSaved}</p>}
            <button
              type="button"
              className="ch-btn ch-btn-primary ch-profile-save"
              onClick={onSave}
              disabled={saving || uploading}
            >
              {saving ? "…" : s.profileSave}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
