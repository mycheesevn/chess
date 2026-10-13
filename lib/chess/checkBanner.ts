import { useSyncExternalStore } from "react";

/**
 * "Big Check banner" preference: when ON, a large ⚔️ CHECK!/CHIẾU! banner
 * flashes in the middle of the board on every checking move (off by default,
 * like PacClone). Stored in localStorage and shared via a tiny external
 * store, so the Settings toggles (in AppShell's identity menus) and the
 * board overlay (in ChessGame) stay in sync.
 */
const KEY = "chess-big-check-banner";

let current = false;
try {
  current = localStorage.getItem(KEY) === "1";
} catch {
  /* storage unavailable */
}

const listeners = new Set<() => void>();

export function setBigCheckBanner(v: boolean) {
  current = v;
  try {
    localStorage.setItem(KEY, v ? "1" : "0");
  } catch {
    /* ignore */
  }
  listeners.forEach((l) => l());
}

export function getBigCheckBanner(): boolean {
  return current;
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

export function useBigCheckBanner(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => current,
    () => false
  );
}
