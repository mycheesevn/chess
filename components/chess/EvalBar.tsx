"use client";

interface Props {
  /** Win probability for White, 0..1. */
  winProbWhite: number;
  /** Centipawns from White's perspective. */
  cpWhite: number;
  /** Forced mate found. */
  mate: boolean;
  /** True when Black is at the bottom of the board (board flipped). */
  flipped: boolean;
}

/**
 * Live evaluation bar: vertical beside the board on desktop, thin
 * horizontal above the board on phones (CSS switches orientation).
 * The bottom side's color always fills from the bottom/left.
 */
export function EvalBar({ winProbWhite, cpWhite, mate, flipped }: Props) {
  const bottomProb = flipped ? 1 - winProbWhite : winProbWhite;
  const pct = Math.max(0, Math.min(100, Math.round(bottomProb * 100)));
  const label = mate
    ? cpWhite > 0
      ? "M"
      : "-M"
    : `${cpWhite >= 0 ? "+" : ""}${(cpWhite / 100).toFixed(1)}`;
  return (
    <div className="ch-evalbar-wrap" aria-hidden="true">
      <div className={`ch-evalbar${flipped ? " flipped" : ""}`}>
        <div
          className="ch-evalbar-fill"
          style={{ "--fill": `${pct}%` } as React.CSSProperties}
        />
      </div>
      <div className="ch-evalbar-label">{label}</div>
    </div>
  );
}
