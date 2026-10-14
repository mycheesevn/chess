"use client";

import { useEffect, useState } from "react";
import { STR } from "@/lib/chess/i18n";
import type { Lang } from "@/lib/chess/types";
import { fetchMyReferralCode } from "@/lib/supabase/referral";

/** "Invite friends" — referral link with +20 XP for both sides. */
export function ReferralCard({ lang }: { lang: Lang }) {
  const s = STR[lang];
  const [code, setCode] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    fetchMyReferralCode().then(setCode).catch(() => {});
  }, []);

  if (!code) return null;
  const link = `${window.location.origin}/?ref=${code}`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setMsg(s.referralCopied);
    } catch {
      setMsg(link);
    }
    window.setTimeout(() => setMsg(null), 3000);
  };

  const share = async () => {
    if (typeof navigator !== "undefined" && "share" in navigator) {
      try {
        await navigator.share({
          title: s.referralTitle,
          text: s.referralDesc,
          url: link,
        });
        return;
      } catch {
        /* fall through to copy */
      }
    }
    copy();
  };

  return (
    <div className="ch-referral">
      <h3>{s.referralTitle}</h3>
      <p className="ch-muted">{s.referralDesc}</p>
      <div className="ch-referral-row">
        <code className="ch-referral-code">{code}</code>
        <button type="button" className="ch-btn ch-btn-sm" onClick={copy}>
          📋 {s.referralCopy}
        </button>
        <button type="button" className="ch-btn ch-btn-sm" onClick={share}>
          📤 {s.referralShare}
        </button>
      </div>
      {msg && <p className="ch-msg">{msg}</p>}
    </div>
  );
}
