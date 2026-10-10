// Small helpers shared by moments and scoring.

import type { MarketContext } from "@/market/engineTypes";

/** The category's busiest slot (highest search share). */
export function peakSlotOf(ctx: MarketContext): number {
  const shares = ctx.market.category.slotShare;
  return shares.reduce((best, s, i) => (s > shares[best] ? i : best), 0);
}
