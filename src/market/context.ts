// ── Build the engine context from the app's scenario (SPEC §2: seed per batch + brand) ──

import type { Scenario } from "@/data/scenarios";
import type { MarketContext } from "@/market/engineTypes";
import { MARKET_DATA } from "@/market/data";

const RUN_DAYS = 30;
/** Day 1 is a Monday. */
const START_WEEKDAY = 1;

/** Everyone in the same batch on the same brand gets the same market. */
export function seedFor(batchCode: string, brandId: string): string {
  return `${batchCode.trim().toUpperCase()}|${brandId}`;
}

const cache = new WeakMap<Scenario, Map<string, MarketContext>>();

/** The engine context for a scenario, or null if the brand has no market data. Cached per scenario + batch. */
export function marketContextFor(scenario: Scenario, batchCode: string): MarketContext | null {
  const market = MARKET_DATA[scenario.profile.id];
  if (!market) return null;
  let byBatch = cache.get(scenario);
  if (!byBatch) {
    byBatch = new Map();
    cache.set(scenario, byBatch);
  }
  const hit = byBatch.get(batchCode);
  if (hit) return hit;
  const ctx: MarketContext = {
    seed: seedFor(batchCode, scenario.profile.id),
    scenario,
    market,
    totalDays: RUN_DAYS,
    startWeekday: START_WEEKDAY,
  };
  byBatch.set(batchCode, ctx);
  return ctx;
}
