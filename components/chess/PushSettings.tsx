"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  currentSubscription,
  pushCapability,
  pushPermission,
  sendTestPush,
  subscribePush,
  unsubscribePush,
} from "@/lib/push/client";
import type { Lang } from "@/lib/chess/types";

type PushState =
  | { kind: "unsupported"; reason: string }
  | { kind: "denied" }
  | { kind: "off" }
  | { kind: "on" }
  | { kind: "working" };

export function PushSettings({ lang }: { lang: Lang }) {
  const [state, setState] = useState<PushState>({ kind: "working" });
  const [tested, setTested] = useState(false);

  const refresh = useCallback(async () => {
    const cap = pushCapability();
    if (!cap.ok) {
      setState({
        kind: "unsupported",
        reason:
          cap.reason === "ios-needs-install"
            ? lang === "vi"
              ? "iOS: cài app ra màn hình chính mới bật được thông báo."
              : "iOS: install the app to Home Screen to enable notifications."
            : lang === "vi"
              ? "Trình duyệt không hỗ trợ thông báo đẩy."
              : "Push notifications not supported.",
      });
      return;
    }
    if (pushPermission() === "denied") {
      setState({ kind: "denied" });
      return;
    }
    const sub = await currentSubscription();
    setState({ kind: sub ? "on" : "off" });
  }, [lang]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const accessToken = async (): Promise<string | null> => {
    const sb = createClient();
    const { data } = await sb.auth.getSession();
    return data?.session?.access_token || null;
  };

  const enable = async () => {
    setState({ kind: "working" });
    try {
      const token = await accessToken();
      if (!token) throw new Error("not_authenticated");
      await subscribePush(token);
      setState({ kind: "on" });
    } catch (e) {
      if ((e as Error).message === "denied") setState({ kind: "denied" });
      else refresh();
    }
  };

  const disable = async () => {
    setState({ kind: "working" });
    try {
      const token = await accessToken();
      if (token) await unsubscribePush(token);
    } finally {
      setState({ kind: "off" });
    }
  };

  const test = async () => {
    const token = await accessToken();
    if (!token) return;
    const ok = await sendTestPush(token);
    setTested(ok);
    setTimeout(() => setTested(false), 3000);
  };

  return (
    <div className="ch-view">
      <h2>🔔 {lang === "vi" ? "Thông báo đẩy" : "Push notifications"}</h2>
      {state.kind === "working" && <p className="ch-hint">…</p>}
      {state.kind === "unsupported" && <p className="ch-hint">{state.reason}</p>}
      {state.kind === "denied" && (
        <p className="ch-hint">
          {lang === "vi"
            ? "Bạn đã chặn thông báo. Mở cài đặt trình duyệt để bật lại."
            : "Notifications blocked. Enable them in browser settings."}
        </p>
      )}
      {(state.kind === "on" || state.kind === "off") && (
        <label className="ch-check-toggle">
          <input
            type="checkbox"
            checked={state.kind === "on"}
            onChange={(e) => (e.target.checked ? enable() : disable())}
          />
          <span>
            {state.kind === "on"
              ? lang === "vi" ? "Tắt thông báo" : "Turn off"
              : lang === "vi" ? "Bật thông báo" : "Turn on"}
          </span>
        </label>
      )}
      {state.kind === "on" && (
        <button type="button" className="ch-btn" onClick={test}>
          {tested ? "✓" : lang === "vi" ? "📨 Gửi thử" : "📨 Send test"}
        </button>
      )}
      <p className="ch-hint">
        {lang === "vi"
          ? "Nhận tin khi có lời thách đấu, đến lượt đi trong phòng và cờ thư."
          : "Get notified about challenges, your turn in rooms and correspondence games."}
      </p>
    </div>
  );
}
