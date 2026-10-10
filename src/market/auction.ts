// ── Auction: ad rank, slots and second price (SPEC §3.2, §14 F2) ──────────────
// Pure functions. One call = one results page (keyword × state × slot).

import type { CategoryProfile } from "@/market/types";
import { logNormal, type Rand } from "@/market/rng";

/** Platform minimum bid and reserve price, ₹ CPM (matches the wizard). */
export const MIN_BID = 200;

/** Added to the next ad rank when pricing (second price + increment). */
export const PRICE_INCREMENT = 5;

/** Share of searches in which each slot is actually seen; billing is on viewable impressions (F2b). */
export const VIEW_RATES = [1.0, 0.55, 0.3] as const;

export interface Bidder {
  id: string;
  /** Entries with the same owner never compete: only the highest-ranked enters (F2g). */
  ownerId: string;
  /** Effective bid, ₹ CPM (boost already applied by the caller). */
  bid: number;
  relevance: number;
}

export interface SlotResult {
  bidderId: string;
  ownerId: string;
  /** 0-based slot. */
  slot: number;
  bid: number;
  relevance: number;
  adRank: number;
  /** ₹ CPM charged per viewable impression. */
  price: number;
  viewRate: number;
}

interface Ranked extends Bidder {
  adRank: number;
}

function byRankThenId(a: Ranked, b: Ranked): number {
  return b.adRank - a.adRank || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
}

/** Keep each owner's highest-ranked entry only. */
function dedupeByOwner(ranked: readonly Ranked[]): Ranked[] {
  const best = new Map<string, Ranked>();
  for (const r of ranked) {
    const current = best.get(r.ownerId);
    if (!current || byRankThenId(r, current) < 0) best.set(r.ownerId, r);
  }
  return [...best.values()];
}

/** One results page. `viewRates` sets how many slots there are and how often each is seen. */
export function runAuction(bidders: readonly Bidder[], viewRates: readonly number[] = VIEW_RATES): SlotResult[] {
  const eligible = bidders
    .filter((b) => b.bid >= MIN_BID && b.relevance > 0)
    .map((b) => ({ ...b, adRank: b.bid * b.relevance }));
  const ordered = dedupeByOwner(eligible).sort(byRankThenId);
  const winners = ordered.slice(0, viewRates.length);

  return winners.map((w, slot) => {
    const next = ordered[slot + 1];
    const secondPrice = next ? next.adRank / w.relevance + PRICE_INCREMENT : MIN_BID;
    return {
      bidderId: w.id,
      ownerId: w.ownerId,
      slot,
      bid: w.bid,
      relevance: w.relevance,
      adRank: w.adRank,
      price: Math.max(MIN_BID, Math.min(w.bid, secondPrice)),
      viewRate: viewRates[slot],
    };
  });
}

/** Lowest relevance of a background bidder (F2c: 0.8–1.0). */
const BACKGROUND_RELEVANCE_MIN = 0.8;
const BACKGROUND_RELEVANCE_SPAN = 0.2;

/** Seeded "other brands" so every slot has someone below it (F2c). */
export function backgroundBidders(category: CategoryProfile, rivalPressure: number, rand: Rand): Bidder[] {
  const [min, max] = category.backgroundBidderCount;
  const count = min + Math.floor(rand() * (max - min + 1));
  return Array.from({ length: count }, (_, i) => ({
    id: `other-${i}`,
    ownerId: `other-${i}`,
    bid: Math.max(MIN_BID, logNormal(category.backgroundBidMedian * rivalPressure, category.backgroundBidSigma, rand)),
    relevance: BACKGROUND_RELEVANCE_MIN + rand() * BACKGROUND_RELEVANCE_SPAN,
  }));
}
