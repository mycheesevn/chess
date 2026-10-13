import { useSyncExternalStore } from "react";

/**
 * Board style preference ("wood" = the original gradient/wood look,
 * "green" = flat cream/green board with flat vector pieces). Stored in
 * localStorage and shared by every board in the app via a tiny external
 * store, so changing it in Settings re-renders all boards at once.
 */
export type BoardTheme = "wood" | "green";

const KEY = "chess-board-theme";

let current: BoardTheme = "wood";
try {
  const v = localStorage.getItem(KEY);
  if (v === "green" || v === "wood") current = v;
} catch {
  /* storage unavailable */
}

const listeners = new Set<() => void>();

export function setBoardTheme(t: BoardTheme) {
  current = t;
  try {
    localStorage.setItem(KEY, t);
  } catch {
    /* ignore */
  }
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

export function useBoardTheme(): BoardTheme {
  return useSyncExternalStore(
    subscribe,
    () => current,
    () => "wood" as BoardTheme
  );
}
