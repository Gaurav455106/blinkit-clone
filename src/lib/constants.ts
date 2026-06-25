/**
 * constants.ts — shared simulation multipliers
 *
 * All engines (dayEngine, weeklyMetrics, simResults) MUST import from here.
 * Changing a value here propagates to every calculation automatically.
 */

// ── Season demand multipliers ─────────────────────────────────────────────────
export const SEASON_MULT: Record<string, number> = {
  "Festival Surge":         1.30,
  "Post-Festival Slowdown": 0.70,
  "Summer Season":          1.10,
  "New Year Health Spike":  1.15,
};
export function getSeasonMult(seasonName: string): number {
  return SEASON_MULT[seasonName] ?? 1.0;
}

// ── Competitor CPM multiplier ─────────────────────────────────────────────────
// Aggressive competitor raises CPMs (more bidders in auction) → spend more per impression.
export const COMPETITOR_CPM_MULT: Record<string, number> = {
  "Aggressive Competitor":  1.35,
  "Price War in Category":  1.20,
};
export function getCompetitorCPMMult(marketName: string): number {
  return COMPETITOR_CPM_MULT[marketName] ?? 1.0;
}
// Revenue drag from competitor (independent of CPM — conversion drag from price undercutting)
export const COMPETITOR_REV_DRAG: Record<string, number> = {
  "Aggressive Competitor":  0.90,
  "Price War in Category":  0.85,
};
export function getCompetitorRevDrag(marketName: string): number {
  return COMPETITOR_REV_DRAG[marketName] ?? 1.0;
}

// ── CM pitch boost ────────────────────────────────────────────────────────────
export const CM_BOOST: Record<string, number> = {
  strong: 1.15,
  decent: 1.05,
  weak:   0.95,
  none:   1.00,
};
export function getCmBoost(status: string | undefined | null): number {
  return CM_BOOST[status ?? "none"] ?? 1.0;
}

// ── Base simulation rates ─────────────────────────────────────────────────────
export const BASE_CPM       = 250;    // ₹ per 1,000 impressions (real Blinkit rate)
export const BASE_CTR       = 0.015;  // 1.5% click-through rate
export const BASE_CVR       = 0.18;   // 18% add-to-cart rate (real Blinkit ~15–25%)
export const ATC_TO_UNITS   = 0.85;   // 85% of ATCs become completed purchases

// ── Inventory-Clearance budget mix (for scoring) ─────────────────────────────
// How much of budget should go to conversion formats for clearance brands.
export const CLEARANCE_BUDGET_MIX = { min: 70, max: 100 };

// ── Performance ad formats (pause these during stock crises) ─────────────────
export const PERFORMANCE_FORMATS = ["product_booster", "recommendation_ads"] as const;
