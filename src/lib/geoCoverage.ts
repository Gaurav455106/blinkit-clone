// ── Geography coverage ────────────────────────────────────────────────────────
// Blinkit only runs ads where the advertised SKU is in stock. Selecting a state
// with no stock costs nothing (the ads just don't run there), and Pan India
// reaches every stocked state. So what matters is how many of the brand's
// stocked states a campaign covers, not how many unstocked ones it includes.
// Used by dayEngine (live), simResults (results) and newScoring (setup score).

import type { SavedCampaign } from "@/context/SimContext";

export type StockByState = Record<string, number>;
type GeoFields = Pick<SavedCampaign, "geography" | "cities">;

/** States where the brand has stock (OSA > 0). */
export function stockedStateNames(stockMap: StockByState): string[] {
  return Object.keys(stockMap).filter((s) => (stockMap[s] ?? 0) > 0);
}

/** Pan India, or no explicit state selection, means "everywhere". */
export function isPanIndia(campaign: GeoFields): boolean {
  return campaign.geography === "pan_india" || !campaign.cities || campaign.cities.length === 0;
}

/** States where this campaign's ads can actually run (selected ∩ stocked). */
export function deliverableStates(campaign: GeoFields, stockMap: StockByState): string[] {
  const stocked = stockedStateNames(stockMap);
  if (isPanIndia(campaign)) return stocked;
  return [...new Set(campaign.cities)].filter((s) => stocked.includes(s));
}

/** Share of the brand's stocked states this campaign reaches (0–1). Pan India = 1. */
export function stockedCoverage(campaign: GeoFields, stockMap: StockByState): number {
  const stocked = stockedStateNames(stockMap);
  if (stocked.length === 0) return 0;
  return deliverableStates(campaign, stockMap).length / stocked.length;
}
