// ── Relevance (SPEC §14 F2a) ──────────────────────────────────────────────────
// relevance = clamp(fit × √ctrRatio, 0.6, 1.3). CTR is measured per viewable
// impression, so position doesn't feed back into relevance.

export const RELEVANCE_MIN = 0.6;
export const RELEVANCE_MAX = 1.3;

/** Below this many viewable impressions in the last 3 days, CTR history is ignored. */
export const CTR_HISTORY_MIN_IMPRESSIONS = 500;

/** Rolling 3-day CTR history, kept per keyword × SKU (survives campaign splits). */
export interface CtrHistory {
  clicks: number;
  viewableImpressions: number;
}

export function relevance(fit: number, history: CtrHistory | undefined, categoryCTR: number): number {
  if (fit <= 0) return 0;
  const hasHistory = history !== undefined && history.viewableImpressions >= CTR_HISTORY_MIN_IMPRESSIONS;
  const ctrRatio = hasHistory ? history.clicks / history.viewableImpressions / categoryCTR : 1;
  return Math.min(RELEVANCE_MAX, Math.max(RELEVANCE_MIN, fit * Math.sqrt(ctrRatio)));
}
