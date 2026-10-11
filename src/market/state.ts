// ── Starting market state (before day 1) ──────────────────────────────────────

import { BLINKIT_STATES, CITY_STORE_COUNT } from "@/data/scenarios";
import type { MarketContext, MarketState } from "@/market/engineTypes";
import { initialRivalState } from "@/market/rivals";
import { START_AD_DEMAND_RATIO, TARGET_COVER_DAYS } from "@/market/stock";
import { seasonDemandMult, stateShares } from "@/market/demand";

/**
 * The brief's stock (SPEC §13 #32): each SKU holds the inventory label's days of cover
 * (Healthy 21 … Overstocked 45) at its expected daily demand in the stocked states, organic
 * plus ads. The brief's per-state stock % only decides where it sits, so a split that doesn't
 * match searches (the deal's lesson) stays possible.
 */
function briefStartStock(ctx: MarketContext): Record<string, Record<string, number>> {
  const { scenario, market } = ctx;
  const shares = stateShares(market);
  const weights = BLINKIT_STATES.map((s) => [s, Math.max(0, scenario.cityStockMap[s] ?? 0)] as const);
  const weightTotal = weights.reduce((t, [, w]) => t + w, 0);
  const stockedShare = weights.reduce((t, [s, w]) => t + (w > 0 ? shares[s] ?? 0 : 0), 0);
  const season = seasonDemandMult(scenario.season.name, market.category.id);
  const cover = TARGET_COVER_DAYS[scenario.inventory.tone];
  return Object.fromEntries(scenario.profile.skus.map((sku) => {
    const dailyDemand = (market.organicDailyUnits[sku.id] ?? 0) * stockedShare * season * (1 + START_AD_DEMAND_RATIO);
    const pool = cover * dailyDemand;
    return [sku.id, Object.fromEntries(weights.map(([s, w]) => [s, weightTotal > 0 ? pool * (w / weightTotal) : 0]))];
  }));
}

export function initialMarketState(ctx: MarketContext): MarketState {
  const { scenario, market } = ctx;
  const brief = briefStartStock(ctx);
  const stock = Object.fromEntries(
    scenario.profile.skus.map((sku) => [
      sku.id,
      Object.fromEntries(BLINKIT_STATES.map((s) => [s, ctx.startStock?.[sku.id]?.[s] ?? brief[sku.id][s]])),
    ]),
  );
  return {
    day: 0,
    stock,
    rivals: Object.fromEntries(market.rivals.map((r) => [r.id, initialRivalState(r)])),
    rivalWindow: Object.fromEntries(market.rivals.map((r) => [r.id, { spend: [], revenue: [] }])),
    ctrWindow: {},
    studentViewable: {},
    salesWindow: {},
    campaignSpend: {},
    campaignWeekSpend: {},
    totalSpend: 0,
  };
}
