// ── How crowded a keyword or placement is with "other brands" (SPEC §3.2.1) ──
// Scales the background bidders' bids. Long-tail terms and the brand's own
// name attract few other advertisers, so they clear near the ₹200 minimum.

import type { KeywordTier } from "@/market/types";

export const TIER_COMPETITION: Readonly<Record<KeywordTier, number>> = {
  head: 1.0,
  mid: 0.8,
  long: 0.55,
};

export const BRAND_TERM_COMPETITION = 0.5;

/** Placements (category pages, Spotlight, Stories, Rec Ads) are as crowded as head terms. */
export const PLACEMENT_COMPETITION = 1.0;

export function keywordCompetition(tier: KeywordTier, isBrandTerm: boolean): number {
  return isBrandTerm ? BRAND_TERM_COMPETITION : TIER_COMPETITION[tier];
}
