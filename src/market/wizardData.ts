// ── Numbers the (frozen) wizard shows, sourced from the engine (SPEC §0.1, §3.2.1) ──
// The wizard's boxes, labels and layout don't change; only where the numbers
// come from. Keywords a student types in that aren't in the market data get a
// conservative estimate so the screen never shows nothing.

import type { Scenario } from "@/data/scenarios";
import { marketContextFor } from "@/market/context";
import { suggestKeywordRange, suggestSmartRange, suggestPlacementRange, monthlyVolume, type BidRange } from "@/market/suggest";
import { categoryPlacementId, recPlacementId } from "@/market/placements";
import { MIN_BID } from "@/market/auction";

/** Typed-in keywords: treated like a long-tail term with modest volume. */
const UNKNOWN_KEYWORD_MONTHLY = 9000;
const UNKNOWN_KEYWORD_RANGE: BidRange = { lo: 260, hi: 340 };
const FALLBACK_PLACEMENT_RANGE: BidRange = { lo: MIN_BID, hi: 400 };

const norm = (s: string) => s.trim().toLowerCase();

function knownKeyword(scenario: Scenario, batch: string, term: string): string | null {
  const ctx = marketContextFor(scenario, batch);
  return ctx?.market.keywords.find((k) => k.term === norm(term))?.term ?? null;
}

export function keywordSearches(scenario: Scenario, batch: string, term: string): number {
  const ctx = marketContextFor(scenario, batch);
  const known = knownKeyword(scenario, batch, term);
  return ctx && known ? monthlyVolume(ctx, known) : UNKNOWN_KEYWORD_MONTHLY;
}

export function keywordRange(scenario: Scenario, batch: string, term: string): BidRange {
  const ctx = marketContextFor(scenario, batch);
  const known = knownKeyword(scenario, batch, term);
  return ctx && known ? suggestKeywordRange(ctx, known) : UNKNOWN_KEYWORD_RANGE;
}

export function smartRange(scenario: Scenario, batch: string, term: string): BidRange {
  const ctx = marketContextFor(scenario, batch);
  const known = knownKeyword(scenario, batch, term);
  return ctx && known ? suggestSmartRange(ctx, known) : UNKNOWN_KEYWORD_RANGE;
}

function placementRange(scenario: Scenario, batch: string, id: string): BidRange {
  const ctx = marketContextFor(scenario, batch);
  if (!ctx || !ctx.market.placements.some((p) => p.id === id)) return FALLBACK_PLACEMENT_RANGE;
  return suggestPlacementRange(ctx, id);
}

export function categoryRange(scenario: Scenario, batch: string, category: string): BidRange {
  return placementRange(scenario, batch, categoryPlacementId(category));
}

export function categoryVisits(scenario: Scenario, batch: string, category: string): number {
  const ctx = marketContextFor(scenario, batch);
  const id = categoryPlacementId(category);
  return ctx && ctx.market.placements.some((p) => p.id === id) ? monthlyVolume(ctx, id) : 0;
}

export function recSlotRange(scenario: Scenario, batch: string, assetId: string): BidRange {
  return placementRange(scenario, batch, recPlacementId(assetId));
}
