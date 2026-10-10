// ── Demand: searches per keyword × state × slot × day (SPEC §14 F1) ───────────

import { BLINKIT_STATES, CITY_STORE_COUNT } from "@/data/scenarios";
import type { BrandMarket, KeywordData } from "@/market/types";

/** Anything with a daily volume: a keyword, or a placement (its id as the term). */
export type DemandUnit = Pick<KeywordData, "term" | "dailyVolume">;
import { poisson, streamFor } from "@/market/rng";

/** Weekday multipliers, 0 = Sunday … 6 = Saturday; they average to 1. */
export const DOW_MULT = [1.15, 0.92, 0.92, 0.95, 0.95, 1.0, 1.11] as const;

/** Combined event multipliers (sale day × rain × IPL…) never exceed this. */
export const EVENT_CAP = 2.0;

export interface DemandContext {
  /** Batch + brand seed (SPEC §2). */
  seed: string;
  day: number;
  /** 0 = Sunday … 6 = Saturday; null = an average day (multiplier 1). */
  weekday: number | null;
  seasonMult: number;
  /** Multipliers from events active in this state/slot today. */
  eventMults: readonly number[];
}

const shareCache = new WeakMap<BrandMarket, Readonly<Record<string, number>>>();

/** Each state's share of national demand: dark stores × brand affinity, normalised. Cached per market. */
export function stateShares(market: BrandMarket): Readonly<Record<string, number>> {
  const cached = shareCache.get(market);
  if (cached) return cached;
  const raw = BLINKIT_STATES.map((s) => [s, (CITY_STORE_COUNT[s] ?? 0) * (market.stateAffinity[s] ?? 1)] as const);
  const total = raw.reduce((sum, [, w]) => sum + w, 0);
  const shares = Object.freeze(Object.fromEntries(raw.map(([s, w]) => [s, total > 0 ? w / total : 0])));
  shareCache.set(market, shares);
  return shares;
}

function eventMultiplier(mults: readonly number[]): number {
  return Math.min(mults.reduce((p, m) => p * m, 1), EVENT_CAP);
}

/** Expected (mean) searches before noise. */
export function expectedSearches(
  market: BrandMarket,
  keyword: DemandUnit,
  state: string,
  slot: number,
  ctx: DemandContext,
): number {
  const dow = ctx.weekday === null ? 1 : DOW_MULT[ctx.weekday] ?? 1;
  return keyword.dailyVolume
    * (stateShares(market)[state] ?? 0)
    * market.category.slotShare[slot]
    * dow
    * ctx.seasonMult
    * eventMultiplier(ctx.eventMults);
}

/** Actual searches: a Poisson draw from its own seeded stream. */
export function searches(
  market: BrandMarket,
  keyword: DemandUnit,
  state: string,
  slot: number,
  ctx: DemandContext,
): number {
  const rand = streamFor(ctx.seed, "demand", keyword.term, state, slot, ctx.day);
  return poisson(expectedSearches(market, keyword, state, slot, ctx), rand);
}
