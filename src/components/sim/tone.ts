// Tone helpers for simulation-layer UI.

export type Tone = "neutral" | "good" | "warn" | "bad";

/** Tone for a score share: ≥ 70% good, ≥ 40% warn, else bad. */
export function scoreTone(earned: number, max: number): Tone {
  if (max <= 0) return "neutral";
  const share = earned / max;
  return share >= 0.7 ? "good" : share >= 0.4 ? "warn" : "bad";
}
