// ── Calibration strategies (SPEC §12.1 slice 1g) ──────────────────────────────
// Fixed "students" built from a brand's own data, so every brand is checked
// the same way: does each lesson in the spec actually change the outcome?

import type { CampaignConfig, MarketContext } from "@/market/engineTypes";
import type { Strategy } from "@/market/headless";

export type { Strategy };
import type { KeywordData } from "@/market/types";
import { suggestKeywordRange } from "@/market/suggest";
import { maxProfitableCPM } from "@/market/shoppers";
import { SLOT_COUNT } from "@/market/types";

const RUN_DAYS = 30;

const fixed = (campaigns: readonly CampaignConfig[]): Strategy => () => campaigns;

function base(ctx: MarketContext, overrides: Partial<CampaignConfig>): CampaignConfig {
  return {
    id: "c1",
    skuIds: ctx.scenario.profile.skus.map((s) => s.id),
    keywords: [],
    geography: "pan_india",
    cities: [],
    budgetType: "daily",
    budget: ctx.scenario.budget / RUN_DAYS,
    launchDay: 1,
    ...overrides,
  };
}

const topOfRange = (ctx: MarketContext, k: KeywordData) => ({ term: k.term, exactBid: suggestKeywordRange(ctx, k.term).hi });

/** Max profitable CPM for a keyword with its best-fitting SKU, at average intent and state (F4). */
export function keywordMaxCPM(ctx: MarketContext, k: KeywordData): number {
  const cat = ctx.market.category;
  return Math.max(...ctx.scenario.profile.skus.map((sku) => maxProfitableCPM({
    baseCTR: cat.baseCTR, creativeMult: 1, affinity: k.isBrandTerm ? 1.5 : 1, fatigueMult: 1,
    baseCVR: cat.baseCVR, fit: k.fit[sku.id] ?? 0, intent: 1, stateCVR: 1, priceEffect: 1,
    sellingPrice: sku.mrp, contributionPerUnit: sku.margin,
  })));
}

/** Slots carrying the most searches (the category's peak), up to two. */
export function peakSlots(ctx: MarketContext): number[] {
  const shares = ctx.market.category.slotShare;
  return Array.from({ length: SLOT_COUNT }, (_, i) => i).sort((a, b) => shares[b] - shares[a]).slice(0, 1);
}

/** Every keyword at the top of its suggested range, all SKUs, 24/7, Pan India. */
export function naive(ctx: MarketContext): Strategy {
  return fixed([base(ctx, { keywords: ctx.market.keywords.map((k) => topOfRange(ctx, k)) })]);
}

export function deadHoursOff(ctx: MarketContext): Strategy {
  return fixed([base(ctx, { keywords: ctx.market.keywords.map((k) => topOfRange(ctx, k)), schedule: [2, 3, 4, 5, 6, 7] })]);
}

/** Dead hours off AND the category's peak off. Compared with deadHoursOff (a schedule that
 *  reaches the peak): a tight 24/7 budget is already dry by the peak, so 24/7 isn't the baseline. */
export function peakOff(ctx: MarketContext): Strategy {
  const off = [0, 1, ...peakSlots(ctx)];
  const schedule = Array.from({ length: SLOT_COUNT }, (_, i) => i).filter((s) => !off.includes(s));
  return fixed([base(ctx, { keywords: ctx.market.keywords.map((k) => topOfRange(ctx, k)), schedule })]);
}

/** Same total budget: long-tail keywords get their own campaign, head and mid the rest. */
export function headLongSplit(ctx: MarketContext, longShare = 0.2): Strategy {
  const daily = ctx.scenario.budget / RUN_DAYS;
  const long = ctx.market.keywords.filter((k) => k.tier === "long");
  const rest = ctx.market.keywords.filter((k) => k.tier !== "long");
  return fixed([
    base(ctx, { id: "head", keywords: rest.map((k) => topOfRange(ctx, k)), budget: daily * (1 - longShare) }),
    base(ctx, { id: "long", keywords: long.map((k) => topOfRange(ctx, k)), budget: daily * longShare }),
  ]);
}

/** The SKU with the highest contribution per click on its best keyword, with enough stock to matter. */
export function heroSku(ctx: MarketContext): string {
  return ctx.scenario.profile.skus
    .map((sku) => ({ id: sku.id, value: Math.max(...ctx.market.keywords.map((k) => (k.fit[sku.id] ?? 0) * sku.margin)) }))
    .sort((a, b) => b.value - a.value)[0].id;
}

/** Same total budget, like a good student: the hero SKU in its own campaign with most of
 *  the money and its keywords; other SKUs only on keywords that can be profitable
 *  (max profitable CPM above the suggested low bid). */
export function heroWeighted(ctx: MarketContext, heroShare = 0.85): Strategy {
  const daily = ctx.scenario.budget / RUN_DAYS;
  const hero = heroSku(ctx);
  const others = ctx.scenario.profile.skus.map((s) => s.id).filter((id) => id !== hero);
  const bestFor = (k: KeywordData) => ctx.scenario.profile.skus.reduce((a, b) => ((k.fit[b.id] ?? 0) > (k.fit[a.id] ?? 0) ? b : a)).id;
  const canProfit = (k: KeywordData) => keywordMaxCPM(ctx, k) > suggestKeywordRange(ctx, k.term).lo;
  const heroKws = ctx.market.keywords.filter((k) => bestFor(k) === hero && canProfit(k));
  const otherKws = ctx.market.keywords.filter((k) => bestFor(k) !== hero && canProfit(k));
  return fixed([
    base(ctx, { id: "hero", skuIds: [hero], keywords: heroKws.map((k) => topOfRange(ctx, k)), budget: daily * heroShare }),
    base(ctx, { id: "rest", skuIds: others, keywords: otherKws.map((k) => topOfRange(ctx, k)), budget: daily * (1 - heroShare) }),
  ]);
}

/** One campaign on a fixed schedule (all keywords at the top of their range). */
export function onSchedule(ctx: MarketContext, schedule: readonly number[] | undefined): Strategy {
  return fixed([base(ctx, { keywords: ctx.market.keywords.map((k) => topOfRange(ctx, k)), schedule })]);
}

/** Candidate schedules a thoughtful student might try (SPEC §3.3.4). */
export const CANDIDATE_SCHEDULES: Readonly<Record<string, readonly number[]>> = {
  "dead hours off": [2, 3, 4, 5, 6, 7],
  "12 PM–12 AM": [4, 5, 6, 7],
  "3 PM–12 AM": [5, 6, 7],
  "6 PM–12 AM": [6, 7],
  "6–9 AM + 6 PM–12 AM": [2, 6, 7],
  "6–9 AM + 3 PM–12 AM": [2, 5, 6, 7],
  "9 AM–3 PM + 6–9 PM": [3, 4, 6],
};

/** Same total budget: the best-converting stocked state gets its own campaign. */
export function stateSplit(ctx: MarketContext, bestShare = 0.4): Strategy {
  const daily = ctx.scenario.budget / RUN_DAYS;
  const stocked = Object.keys(ctx.scenario.cityStockMap).filter((s) => (ctx.scenario.cityStockMap[s as keyof typeof ctx.scenario.cityStockMap] ?? 0) > 0);
  const cvr = (s: string) => ctx.market.stateCVR[s as keyof typeof ctx.market.stateCVR] ?? 1;
  const best = [...stocked].sort((a, b) => cvr(b) - cvr(a))[0];
  const kws = ctx.market.keywords.map((k) => topOfRange(ctx, k));
  return fixed([
    base(ctx, { id: "best-state", geography: "select_cities", cities: [best], keywords: kws, budget: daily * bestShare }),
    base(ctx, { id: "other-states", geography: "select_cities", cities: stocked.filter((s) => s !== best), keywords: kws, budget: daily * (1 - bestShare) }),
  ]);
}
