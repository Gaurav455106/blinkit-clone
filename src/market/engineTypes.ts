// ── stepDay inputs, state and outputs (SPEC §2, §3.6, §14 F5, F8) ─────────────
// The engine has its own campaign shape; slice 1h maps the wizard's
// SavedCampaign onto it.

import type { Scenario } from "@/data/scenarios";
import type { BrandMarket, InventoryKind } from "@/market/types";
import type { RivalState } from "@/market/rivals";

export interface KeywordBid {
  term: string;
  /** ₹ CPM exact-match bid. */
  exactBid: number;
  /** ₹ CPM smart-match bid; undefined = smart match off for this keyword. */
  smartBid?: number;
}

/** A bid on a non-keyword placement (category page, Spotlight, Stories feed, Rec Ads slot). */
export interface PlacementBid {
  /** Placement id, see placements.ts. */
  id: string;
  /** ₹ CPM. */
  bid: number;
}

export interface CampaignConfig {
  id: string;
  skuIds: readonly string[];
  keywords: readonly KeywordBid[];
  placements?: readonly PlacementBid[];
  /** CTR multiplier from the creative on Spotlight and Stories (SPEC §14 F10); default 1. */
  creativeMult?: number;
  /** "Boost my bid up to X%" as a fraction (0.2 = 20%); always applied (decision #23). */
  boostPct?: number;
  geography: "pan_india" | "select_cities" | null;
  /** Selected state names (ignored for Pan India). */
  cities: readonly string[];
  budgetType: "daily" | "overall";
  /** ₹ per day (daily) or ₹ for the whole campaign (overall). */
  budget: number;
  launchDay: number;
  /** Last day for overall budgets; default 30. */
  endDay?: number;
  /** Active slot indices; empty/undefined = 24/7. */
  schedule?: readonly number[];
  paused?: boolean;
}

export interface MarketContext {
  seed: string;
  scenario: Scenario;
  market: BrandMarket;
  totalDays: number;
  /** Weekday of day 1, 0 = Sunday. */
  startWeekday: number;
  /** Day-1 units per SKU per state from the opening deal (SPEC §6.1); default = the brief's split. */
  startStock?: Readonly<Record<string, Readonly<Record<string, number>>>>;
}

/** Rolling windows hold the most recent values last. */
export interface MarketState {
  /** Last completed day (0 before the run starts). */
  day: number;
  /** Units per SKU per state. */
  stock: Readonly<Record<string, Readonly<Record<string, number>>>>;
  rivals: Readonly<Record<string, RivalState>>;
  /** Rival keyword spend and revenue for the last 3 days (for the ROAS floor). */
  rivalWindow: Readonly<Record<string, { spend: readonly number[]; revenue: readonly number[] }>>;
  /** CTR history per "term|sku", last 3 days. */
  ctrWindow: Readonly<Record<string, { clicks: readonly number[]; viewable: readonly number[] }>>;
  /** Cumulative viewable impressions of the student's ads per state (reach, frequency). */
  studentViewable: Readonly<Record<string, number>>;
  /** Units sold (ads + organic) per "sku|state", last 7 days (for restock). */
  salesWindow: Readonly<Record<string, readonly number[]>>;
  /** ₹ spent so far per campaign. */
  campaignSpend: Readonly<Record<string, number>>;
  /** ₹ spent per campaign in the current week (days 1–7, 8–14…), for weekly normalisation. */
  campaignWeekSpend: Readonly<Record<string, { week: number; spent: number }>>;
  totalSpend: number;
}

/** One campaign × keyword-or-placement × match type × state × slot for one day. */
export interface CellRow {
  campaignId: string;
  inventory: InventoryKind;
  /** Keyword term, or placement id for non-keyword inventory. */
  term: string;
  matchType: "exact" | "smart" | "placement";
  skuId: string;
  state: string;
  slot: number;
  /** Visibility partition (F8): searches = lostToStock + lostToBudget + lostToRank + won. */
  searches: number;
  lostToStock: number;
  lostToBudget: number;
  lostToRank: number;
  won: number;
  /** 0-based slot won, or null. */
  position: number | null;
  viewableImpressions: number;
  /** All advertisers' viewable impressions on this page (SOV denominator). */
  totalAdViewable: number;
  spend: number;
  clicks: number;
  atcs: number;
  units: number;
  directRevenue: number;
  indirectRevenue: number;
  contribution: number;
}

export interface RivalDayRow {
  rivalId: string;
  inventory: InventoryKind;
  /** Keyword term or placement id. */
  term: string;
  viewableImpressions: number;
  totalAdViewable: number;
  topSlotWins: number;
  appearances: number;
  spend: number;
  revenue: number;
}

export interface StockRow {
  skuId: string;
  state: string;
  opening: number;
  adUnits: number;
  organicUnits: number;
  restocked: number;
  closing: number;
  osa: number;
}

export interface DayResult {
  day: number;
  cells: readonly CellRow[];
  rivals: readonly RivalDayRow[];
  stock: readonly StockRow[];
}
