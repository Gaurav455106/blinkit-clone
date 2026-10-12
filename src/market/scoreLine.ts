// Small helpers shared by the scoring v2 modules.

import type { ScoreLineV2 } from "@/market/scoringV2";

export const round1 = (n: number) => Math.round(n * 10) / 10;
export const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

/** A score line with its points rounded and kept between 0 and max (rounding never lifts it over max). */
export function line(l: ScoreLineV2): ScoreLineV2 {
  return { ...l, earned: Math.min(l.max, round1(clamp(l.earned, 0, l.max))) };
}
