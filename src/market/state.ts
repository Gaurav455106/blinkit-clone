// ── Starting market state (before day 1) ──────────────────────────────────────

import { BLINKIT_STATES, CITY_STORE_COUNT } from "@/data/scenarios";
import type { MarketContext, MarketState } from "@/market/engineTypes";
import { initialRivalState } from "@/market/rivals";
import { initialUnits } from "@/market/stock";

export function initialMarketState(ctx: MarketContext): MarketState {
  const { scenario, market } = ctx;
  const stock = Object.fromEntries(
    scenario.profile.skus.map((sku) => [
      sku.id,
      Object.fromEntries(
        BLINKIT_STATES.map((s) => [s, initialUnits(scenario.cityStockMap[s] ?? 0, CITY_STORE_COUNT[s] ?? 0, sku.velocity)]),
      ),
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
    totalSpend: 0,
  };
}
