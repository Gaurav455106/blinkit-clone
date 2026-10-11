// Shared test helper: a deterministic MarketContext for any brand in MARKET_DATA.

import { BRAND_PROFILES, BLINKIT_STATES, SEASONS, MARKET_CONDITIONS } from "@/data/scenarios";
import type { Scenario, CityStockMap, InventoryState } from "@/data/scenarios";
import type { MarketContext } from "@/market/engineTypes";
import { MARKET_DATA } from "@/market/data";

const HEALTHY: InventoryState = { id: "healthy", label: "Healthy", osa: 85, fillRate: 90, activeStores: 54, agingUnits: 80, tone: "healthy" };

/** Stock at 80% OSA in the primary state and 70% / 60% in the secondary states. */
export function testContext(brandId: string, overrides: { stock?: Partial<CityStockMap>; seed?: string } = {}): MarketContext {
  const profile = BRAND_PROFILES.find((b) => b.id === brandId)!;
  const empty = BLINKIT_STATES.reduce((m, s) => ({ ...m, [s]: 0 }), {} as CityStockMap);
  const [second, third] = profile.secondaryStates;
  const defaultStock: Partial<CityStockMap> = { [profile.primaryState]: 80, ...(second ? { [second]: 70 } : {}), ...(third ? { [third]: 60 } : {}) };
  const scenario: Scenario = {
    seed: "test", profile,
    cityStockMap: { ...empty, ...(overrides.stock ?? defaultStock) },
    season: SEASONS.find((x) => x.name === "Normal Week")!,
    market: MARKET_CONDITIONS.find((x) => x.name === "Stable Market")!,
    inventory: HEALTHY,
    budget: 200000,
    clientGoals: { primary: "", performanceGoals: [], reachGoals: [], metrics: [], threshold: "", lifecycle: "Convert", campaignHint: "" },
    scheduledCrisis: { day: 12, eventId: "stock_crisis", reason: "" },
    city: profile.primaryState,
  };
  return { seed: overrides.seed ?? `batch-1|${brandId}`, scenario, market: MARKET_DATA[brandId], totalDays: 30, startWeekday: 1 };
}
