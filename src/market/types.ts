// ── Market engine data model (SPEC §3, §4, §14) ───────────────────────────────
// Everything tunable lives in data files typed by these interfaces, so the
// engine logic never hard-codes a number that calibration might change.

import type { StateName } from "@/data/scenarios";

/** Number of 3-hour slots in a day; slot 0 = 12–3 AM (see slots.ts). */
export const SLOT_COUNT = 8;

/** Exactly SLOT_COUNT numbers, one per slot. */
export type PerSlot = readonly [number, number, number, number, number, number, number, number];

export type KeywordTier = "head" | "mid" | "long";

/** The five kinds of ad inventory (SPEC §3.2.2). */
export type InventoryKind = "keyword" | "category" | "spotlight" | "stories" | "recommendation";

/** A non-keyword placement: category page, Spotlight banner, Stories feed or Rec Ads slot. */
export interface PlacementData {
  /** e.g. "category:Sports Nutrition", "spotlight:home", "stories:main-feed", "rec:cart". */
  id: string;
  kind: Exclude<InventoryKind, "keyword">;
  label: string;
  /** National page views / feed opens per day, before state, slot and weekday shares. */
  dailyVolume: number;
  /** Fit of each SKU for this placement. */
  fit: Readonly<Record<string, number>>;
  /** CTR and CVR relative to the category's search baseline (browsing converts less). */
  ctrMult: number;
  cvrMult: number;
}

/** One keyword the brand can bid on (SPEC §3.7.2, §14 F2e, F16). */
export interface KeywordData {
  term: string;
  tier: KeywordTier;
  /** National searches per day before state, slot, weekday and event shares. */
  dailyVolume: number;
  /** Keywords in the same cluster are reached by smart match. */
  cluster: string;
  /** Fit of each of the brand's SKUs for this keyword (0 = never shown). */
  fit: Readonly<Record<string, number>>;
  /** The brand's own name: relevance and shopper affinity are higher. */
  isBrandTerm?: boolean;
}

/** Category-level shopper behaviour (SPEC §3.3.3, §14 F1, F7). */
export interface CategoryProfile {
  id: string;
  /** Share of a day's searches in each slot; sums to 1. */
  slotShare: PerSlot;
  /** CVR multiplier per slot (intent). */
  intent: PerSlot;
  /** Rival bid multiplier per slot (CPM pressure). */
  rivalPressure: PerSlot;
  /** CTR per viewable impression for an average creative in slot 1. */
  baseCTR: number;
  /** Click → add-to-cart rate for an average SKU fit of 1.0. */
  baseCVR: number;
  /** Background "other brands" bid median (₹ CPM) and spread (§14 F2c). */
  backgroundBidMedian: number;
  backgroundBidSigma: number;
  backgroundBidderCount: readonly [min: number, max: number];
}

/** Structural lessons built into a brand's data (SPEC §3.10). */
export type TrapId = "stateSplit" | "headLong" | "hero" | "creative";

export type RivalArchetype = "leader" | "challenger" | "price_warrior" | "newcomer";

/** A named competitor (SPEC §4, §14 F11). Bids are ₹ CPM. */
export interface RivalData {
  id: string;
  name: string;
  archetype: RivalArchetype;
  /** ₹ for the 30-day run; out of auctions once spent. */
  monthlyBudget: number;
  /** Starting bid per keyword term; terms not listed aren't bid on. */
  bids: Readonly<Record<string, number>>;
  /** Starting bid per placement id; placements not listed aren't bid on. */
  placementBids?: Readonly<Record<string, number>>;
  /** Highest bid it will go to, as a multiple of its starting bid. */
  maxBidMult: number;
  /** Position-weighted SOV it tries to hold (0–1, max ≈ 0.54). */
  targetSov: number;
  /** Cuts bids when its own 3-day ROAS falls below this. */
  roasFloor: number;
  /** Days of low SOV before it first reacts. */
  lagDays: number;
  /** Relevance on its keywords (0.6–1.3). */
  relevance: number;
  /** Average selling price and contribution per unit (for its own ROAS). */
  price: number;
  contributionPerUnit: number;
  /** Day it enters the market (newcomers); default 1. */
  activeFromDay?: number;
  /** Temporary bid burst (challengers), multiplier on its bids. */
  burst?: { fromDay: number; toDay: number; bidMult: number };
  /** Day it cuts price, and by how much (price warriors). */
  priceCut?: { day: number; pct: number };
}

/** Everything the engine needs about one brand's market. */
export interface BrandMarket {
  brandId: string;
  category: CategoryProfile;
  keywords: readonly KeywordData[];
  placements: readonly PlacementData[];
  /** CVR multiplier per state; states not listed = 1.0 (SPEC §3.7.1). */
  stateCVR: Readonly<Partial<Record<StateName, number>>>;
  /** Demand multiplier per state on top of dark-store share; default 1.0. */
  stateAffinity: Readonly<Partial<Record<StateName, number>>>;
  rivals: readonly RivalData[];
  /** Organic units per day per SKU, nationally, at full OSA (SPEC §14 F6). */
  organicDailyUnits: Readonly<Record<string, number>>;
  /** The 2–3 traps this brand's data is built to teach (checked by calibration). */
  traps: readonly TrapId[];
}
