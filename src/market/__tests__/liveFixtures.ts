// Shared fixtures for events and Rohit tests: hand-built DayResult rows so each
// condition can be set exactly.

import type { CampaignConfig, CellRow, DayResult, MarketContext, MarketState, RivalDayRow, StockRow } from "@/market/engineTypes";
import { initialMarketState } from "@/market/state";

export function cell(overrides: Partial<CellRow> = {}): CellRow {
  return {
    campaignId: "c1", inventory: "keyword", term: "whey protein", matchType: "exact", skuId: "fuel-1",
    state: "Karnataka", slot: 6,
    searches: 100, lostToStock: 0, lostToBudget: 0, lostToRank: 0, won: 100, position: 0,
    viewableImpressions: 100, totalAdViewable: 300,
    spend: 50, clicks: 4, atcs: 1, units: 1, directRevenue: 1299, indirectRevenue: 0, contribution: 400,
    ...overrides,
  };
}

export function rivalRow(overrides: Partial<RivalDayRow> = {}): RivalDayRow {
  return {
    rivalId: "ironwhey", inventory: "keyword", term: "whey protein",
    viewableImpressions: 100, totalAdViewable: 300, topSlotWins: 50, appearances: 100, spend: 100, revenue: 300,
    ...overrides,
  };
}

export function stockRow(overrides: Partial<StockRow> = {}): StockRow {
  return {
    skuId: "fuel-1", state: "Karnataka", opening: 500, adUnits: 20, organicUnits: 20, restocked: 0, closing: 460, osa: 0.8,
    ...overrides,
  };
}

export function dayResult(day: number, parts: Partial<Omit<DayResult, "day">> = {}): DayResult {
  return { day, cells: parts.cells ?? [], rivals: parts.rivals ?? [], stock: parts.stock ?? [] };
}

export function stateAt(ctx: MarketContext, day: number, overrides: Partial<MarketState> = {}): MarketState {
  return { ...initialMarketState(ctx), day, ...overrides };
}

export function campaign(overrides: Partial<CampaignConfig> = {}): CampaignConfig {
  return {
    id: "c1", skuIds: ["fuel-1"], keywords: [{ term: "whey protein", exactBid: 450 }],
    geography: "pan_india", cities: [], budgetType: "daily", budget: 6000, launchDay: 1,
    ...overrides,
  };
}

/** History of `n` days ending on `lastDay`, each built by `build(day)`. */
export function historyOf(lastDay: number, n: number, build: (day: number) => DayResult): DayResult[] {
  return Array.from({ length: n }, (_, i) => build(lastDay - n + 1 + i));
}

/** Pulls every number out of a string, ignoring ₹ and thousands separators. */
export function numbersIn(text: string): number[] {
  return (text.replace(/,/g, "").match(/\d+(\.\d+)?/g) ?? []).map(Number);
}
