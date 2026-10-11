// ── Suggested bid ranges for the wizard (SPEC §3.2.1, §14 F3) ─────────────────
// Before Day 1 the engine replays a seeded "last 14 days" with the rivals'
// starting bids and the background "other brands" (no student). For each
// keyword or placement it records the bid the student would need to take
// slot 1: adRank(slot-1 holder) ÷ the student's best SKU fit. The range is the
// search-weighted [p50, p80] of that over stocked states. It says what wins the
// top slot, never whether that's profitable (the student checks max profitable CPM).

import { BLINKIT_STATES } from "@/data/scenarios";
import type { MarketContext } from "@/market/engineTypes";
import { SLOT_COUNT } from "@/market/types";
import { expectedSearches, seasonDemandMult } from "@/market/demand";
import { backgroundBidders, MIN_BID } from "@/market/auction";
import { initialRivalState, rivalBid } from "@/market/rivals";
import { streamFor } from "@/market/rng";
import { SMART_FIT_MULT } from "@/market/entries";
import { keywordCompetition, PLACEMENT_COMPETITION } from "@/market/competition";

const PRE_RUN_DAYS = 14;
const RANGE_STEP = 10;
const MONTH_DAYS = 30;
const P_LOW = 0.5;
const P_HIGH = 0.8;

export interface BidRange {
  lo: number;
  hi: number;
}

/** One pre-run page: how many searches it stands for, the top rival ad rank, the student's fit. */
export interface PreRunPage {
  weight: number;
  topRank: number;
  fit: number;
}

interface Unit {
  id: string;
  dailyVolume: number;
  fit: Readonly<Record<string, number>>;
  competition: number;
}

function findUnit(ctx: MarketContext, id: string): Unit {
  const keyword = ctx.market.keywords.find((k) => k.term === id);
  if (keyword) {
    return { id, dailyVolume: keyword.dailyVolume, fit: keyword.fit, competition: keywordCompetition(keyword.tier, keyword.isBrandTerm === true) };
  }
  const placement = ctx.market.placements.find((p) => p.id === id);
  if (placement) return { id, dailyVolume: placement.dailyVolume, fit: placement.fit, competition: PLACEMENT_COMPETITION };
  throw new Error(`Unknown keyword or placement: ${id}`);
}

/** The pre-run pages for one keyword or placement, in stocked states. */
export function preRunAuctions(ctx: MarketContext, id: string, fitMult = 1): PreRunPage[] {
  const unit = findUnit(ctx, id);
  const { market, scenario } = ctx;
  const fit = Math.max(...scenario.profile.skus.map((s) => unit.fit[s.id] ?? 0)) * fitMult;
  const stocked = BLINKIT_STATES.filter((s) => (scenario.cityStockMap[s] ?? 0) > 0);
  const seasonMult = seasonDemandMult(scenario.season.name, market.category.id);
  const rivalStates = market.rivals.map((r) => [r, initialRivalState(r)] as const);
  const pages: PreRunPage[] = [];

  for (let d = 1; d <= PRE_RUN_DAYS; d++) {
    const weekday = (((ctx.startWeekday - 1 - PRE_RUN_DAYS + d) % 7) + 7) % 7;
    for (const st of stocked) {
      for (let slot = 0; slot < SLOT_COUNT; slot++) {
        const pressure = market.category.rivalPressure[slot];
        const weight = expectedSearches(market, { term: id, dailyVolume: unit.dailyVolume }, st, slot,
          { seed: ctx.seed, day: -d, weekday, seasonMult, eventMults: [] });
        if (weight <= 0) continue;
        // Rivals at their starting bids; newcomers who launch later are absent
        const rivalRanks = rivalStates.flatMap(([r, s]) => {
          const bid = rivalBid(r, s, id, 1, pressure);
          return bid === null || bid < MIN_BID ? [] : [bid * r.relevance];
        });
        const bgRanks = backgroundBidders(market.category, pressure, streamFor(ctx.seed, "prerun-bg", id, st, slot, d), unit.competition)
          .map((b) => b.bid * b.relevance);
        pages.push({ weight, topRank: Math.max(0, ...rivalRanks, ...bgRanks), fit });
      }
    }
  }
  return pages;
}

function weightedPercentile(values: readonly { value: number; weight: number }[], p: number): number {
  const sorted = [...values].sort((a, b) => a.value - b.value);
  const total = sorted.reduce((s, v) => s + v.weight, 0);
  let acc = 0;
  for (const v of sorted) {
    acc += v.weight;
    if (acc >= p * total) return v.value;
  }
  return sorted[sorted.length - 1]?.value ?? MIN_BID;
}

const ceilStep = (x: number) => Math.ceil(x / RANGE_STEP) * RANGE_STEP;

function rangeFrom(pages: readonly PreRunPage[]): BidRange {
  if (pages.length === 0 || pages[0].fit <= 0) return { lo: MIN_BID, hi: MIN_BID };
  const needed = pages.map((p) => ({ value: p.topRank / p.fit, weight: p.weight }));
  const lo = Math.max(MIN_BID, ceilStep(weightedPercentile(needed, P_LOW)));
  const hi = Math.max(lo, ceilStep(weightedPercentile(needed, P_HIGH)));
  return { lo, hi };
}

const cache = new WeakMap<MarketContext, Map<string, BidRange>>();

function cached(ctx: MarketContext, key: string, compute: () => BidRange): BidRange {
  let byKey = cache.get(ctx);
  if (!byKey) {
    byKey = new Map();
    cache.set(ctx, byKey);
  }
  const hit = byKey.get(key);
  if (hit) return hit;
  const value = compute();
  byKey.set(key, value);
  return value;
}

/** "Suggested top bid range" for an exact-match keyword. */
export function suggestKeywordRange(ctx: MarketContext, term: string): BidRange {
  return cached(ctx, `exact|${term}`, () => rangeFrom(preRunAuctions(ctx, term)));
}

/** Smart-match range: same auctions, the student's fit reduced (F2e). */
export function suggestSmartRange(ctx: MarketContext, term: string): BidRange {
  return cached(ctx, `smart|${term}`, () => rangeFrom(preRunAuctions(ctx, term, SMART_FIT_MULT)));
}

/** Range for a category page, Spotlight placement, Stories feed or Rec Ads slot. */
export function suggestPlacementRange(ctx: MarketContext, placementId: string): BidRange {
  return cached(ctx, `placement|${placementId}`, () => rangeFrom(preRunAuctions(ctx, placementId)));
}

/** National searches (or page views) per month, shown next to keywords and categories. */
export function monthlyVolume(ctx: MarketContext, id: string): number {
  const seasonMult = seasonDemandMult(ctx.scenario.season.name, ctx.market.category.id);
  return Math.round(findUnit(ctx, id).dailyVolume * MONTH_DAYS * seasonMult);
}
