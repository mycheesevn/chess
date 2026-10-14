"use client";

import { useEffect, useRef, useState } from "react";
import { useAuth } from "./AuthProvider";
import { createClient } from "@/lib/supabase/client";
import {
  fetchProfile,
  updateProfile,
  uploadAvatar,
  type UserProfile,
} from "@/lib/supabase/profile";
import { displayName } from "@/lib/supabase/rooms";
import { levelForXp, titleForLevel } from "@/lib/chess/levels";
import { shareAchievement } from "@/lib/chess/achievementCard";
import { fetchMyInviteCount } from "@/lib/supabase/referral";
import { ReferralCard } from "./ReferralCard";
import { STR } from "@/lib/chess/i18n";
import type { Lang } from "@/lib/chess/types";

interface Props {
  lang: Lang;
  onClose: () => void;
}

export function ProfileModal({ lang, onClose }: Props) {
  const s = STR[lang];
  const { user, chessStats, refreshProfile } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [fullName, setFullName] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [city, setCity] = useState("");
  const [country, setCountry] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarBust, setAvatarBust] = useState(0);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [pw1, setPw1] = useState("");
  const [pw2, setPw2] = useState("");
  const [pwBusy, setPwBusy] = useState(false);
  const [pwMsg, setPwMsg] = useState<{ ok: boolean; text: string } | null>(
    null
  );
  const [invites, setInvites] = useState(0);
  const [sharingAch, setSharingAch] = useState(false);
  const [shareToast, setShareToast] = useState<string | null>(null);

  useEffect(() => {
    fetchProfile().then((p) => {
      setProfile(p);
      if (p) {
        setFullName(p.full_name ?? "");
        setBirthDate(p.birth_date ?? "");
        setCity(p.city ?? "");
        setCountry(p.country ?? "");
        setAvatarUrl(p.avatar_url);
      }
      setLoading(false);
    });
    // Ambassador stats: never break the modal on failure.
    fetchMyInviteCount().then(setInvites).catch(() => {});
  }, []);

  /** Share the user's profile as an achievement card. */
  const shareProfile = async () => {
    if (sharingAch) return;
    setSharingAch(true);
    try {
      const name =
        profile?.full_name?.trim() ||
        displayName({
          full_name: profile?.full_name ?? null,
          username: profile?.username ?? null,
          email: user?.email ?? null,
        });
      const rating = chessStats?.rating ?? 800;
      const level = levelForXp(chessStats?.xp ?? 0);
      const title = titleForLevel(level, lang);
      const outcome = await shareAchievement(
        "profile",
        {
          title: s.achProfileTitle,
          displayName: name,
          playerTitle: title,
          rating,
          level,
        },
        lang
      );
      setShareToast(outcome === "shared" ? s.shareDone : s.shareDownloaded);
      window.setTimeout(() => setShareToast(null), 4000);
    } catch {
      /* ignore */
    } finally {
      setSharingAch(false);
    }
  };

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
    const err = await updateProfile({
      full_name: fullName.trim() || null,
      birth_date: birthDate || null,
      city: city.trim() || null,
      country: country.trim() || null,
    });
    setSaving(false);
    if (err) setError(err);
    else {
      setSaved(true);
      void refreshProfile();
    }
  };

  const avatarSrc = avatarUrl ? `${avatarUrl}?v=${avatarBust}` : null;

  const onChangePassword = async () => {
    setPwMsg(null);
    if (pw1.length < 6) {
      setPwMsg({ ok: false, text: s.passwordTooShort });
      return;
    }
    if (pw1 !== pw2) {
      setPwMsg({ ok: false, text: s.passwordMismatch });
      return;
    }
    setPwBusy(true);
    try {
      const { error: err } = await createClient().auth.updateUser({
        password: pw1,
      });
      if (err) setPwMsg({ ok: false, text: err.message });
      else {
        setPwMsg({ ok: true, text: s.passwordChanged });
        setPw1("");
        setPw2("");
      }
    } catch (e) {
      setPwMsg({
        ok: false,
        text: e instanceof Error ? e.message : "Failed",
      });
    } finally {
      setPwBusy(false);
    }
  };

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
                  <img src={avatarSrc} alt={s.profileAvatar} />
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
                  {uploading ? s.profileUploading : s.profileChangeAvatar}
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
                placeholder={profile?.username ?? ""}
              />
            </label>
            <label className="ch-field">
              <span>{s.profileBirthDate}</span>
              <input
                className="ch-input"
                type="date"
                value={birthDate}
                onChange={(e) => setBirthDate(e.target.value)}
              />
            </label>
            <label className="ch-field">
              <span>{s.profileCity}</span>
              <input
                className="ch-input"
                value={city}
                maxLength={80}
                onChange={(e) => setCity(e.target.value)}
              />
            </label>
            <label className="ch-field">
              <span>{s.profileCountry}</span>
              <input
                className="ch-input"
                value={country}
                maxLength={80}
                onChange={(e) => setCountry(e.target.value)}
              />
            </label>
            <div className="ch-profile-readonly">
              <div>
                <span className="ch-muted">{s.profileUsername}: </span>
                <strong>{profile?.username ?? "—"}</strong>
              </div>
              <div>
                <span className="ch-muted">{s.profileEmail}: </span>
                <strong>{user?.email ?? "—"}</strong>
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
            <button
              type="button"
              className="ch-btn ch-profile-save"
              onClick={shareProfile}
              disabled={sharingAch}
            >
              {sharingAch ? "…" : s.achShare}
            </button>
            {shareToast && <div className="ch-toast">{shareToast}</div>}
            {invites > 0 && (
              <div className="ch-ambassador-line">
                🎁 {s.ambStats(invites, invites * 20)}
              </div>
            )}
            <ReferralCard lang={lang} />
            <div className="ch-profile-pw">
              <h3>🔑 {s.changePassword}</h3>
              <input
                className="ch-input"
                type="password"
                autoComplete="new-password"
                placeholder={s.newPassword}
                value={pw1}
                onChange={(e) => setPw1(e.target.value)}
              />
              <input
                className="ch-input"
                type="password"
                autoComplete="new-password"
                placeholder={s.confirmPassword}
                value={pw2}
                onChange={(e) => setPw2(e.target.value)}
              />
              <button
                type="button"
                className="ch-btn"
                onClick={onChangePassword}
                disabled={pwBusy || !pw1 || !pw2}
              >
                {pwBusy ? "…" : s.changePassword}
              </button>
              {pwMsg && (
                <p className={pwMsg.ok ? "ch-msg" : "ch-msg ch-msg-error"}>
                  {pwMsg.text}
                </p>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
