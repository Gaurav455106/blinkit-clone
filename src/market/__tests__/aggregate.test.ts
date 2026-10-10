import { describe, it, expect } from "vitest";
import { runHeadless } from "@/market/headless";
import { byUnit, byState, bySlot, bySku, byCampaign, dayTotals, rivalInsights, sumMetrics } from "@/market/aggregate";
import type { CampaignConfig } from "@/market/engineTypes";
import { testContext } from "./testContext";

const ctx = testContext("fuelup");
const campaigns: CampaignConfig[] = [
  { id: "a", skuIds: ["fuel-1", "fuel-3"], keywords: [{ term: "whey protein", exactBid: 500 }, { term: "protein bar", exactBid: 450, smartBid: 350 }], placements: [{ id: "category:Sports Nutrition", bid: 450 }], geography: "pan_india", cities: [], budgetType: "daily", budget: 4000, launchDay: 1 },
  { id: "b", skuIds: ["fuel-2"], keywords: [{ term: "plant protein", exactBid: 400 }], geography: "select_cities", cities: ["Karnataka"], budgetType: "daily", budget: 1500, launchDay: 1 },
];
const run = runHeadless(ctx, () => campaigns, 8);
const cells = run.results.flatMap((r) => r.cells);

describe("aggregations", () => {
  it("every breakdown adds back up to the same totals", () => {
    const total = sumMetrics(cells);
    for (const rows of [byUnit(cells), byState(cells), bySlot(cells), bySku(cells), byCampaign(cells)]) {
      const spend = rows.reduce((s, r) => s + r.spend, 0);
      const revenue = rows.reduce((s, r) => s + r.revenue, 0);
      expect(spend).toBeCloseTo(total.spend, 6);
      expect(revenue).toBeCloseTo(total.revenue, 6);
    }
  });

  it("computes impression share, SOV, CPM, CTR, ROAS and break-even consistently", () => {
    const m = sumMetrics(cells);
    expect(m.impressionShare).toBeCloseTo(m.won / m.searches, 9);
    expect(m.sov).toBeCloseTo(m.viewableImpressions / m.totalAdViewable, 9);
    expect(m.cpm).toBeCloseTo((m.spend / m.viewableImpressions) * 1000, 9);
    expect(m.ctr).toBeCloseTo(m.clicks / m.viewableImpressions, 9);
    expect(m.roas).toBeCloseTo(m.revenue / m.spend, 9);
    expect(m.breakEvenRoas).toBeCloseTo(m.revenue / m.contribution, 9);
    expect(m.profit).toBeCloseTo(m.contribution - m.spend, 9);
    expect(m.lostToStock + m.lostToBudget + m.lostToRank + m.won).toBeCloseTo(m.searches, 6);
  });

  it("realised max profitable CPM is contribution per 1,000 views", () => {
    const m = sumMetrics(cells);
    expect(m.maxProfitableCpm).toBeCloseTo((m.contribution / m.viewableImpressions) * 1000, 9);
  });

  it("average position is 1-based and view-weighted, between 1 and 3", () => {
    const m = sumMetrics(cells.filter((c) => c.inventory === "keyword"));
    expect(m.avgPosition).toBeGreaterThanOrEqual(1);
    expect(m.avgPosition).toBeLessThanOrEqual(3);
  });

  it("breaks out keywords and placements separately with their inventory kind", () => {
    const units = byUnit(cells);
    expect(units.find((u) => u.key === "whey protein")?.inventory).toBe("keyword");
    expect(units.find((u) => u.key === "category:Sports Nutrition")?.inventory).toBe("category");
  });

  it("returns zeroed metrics, not NaN, for empty input", () => {
    const m = sumMetrics([]);
    expect(m.roas).toBe(0);
    expect(m.cpm).toBe(0);
    expect(m.avgPosition).toBe(0);
  });

  it("daily totals match the cells of each day", () => {
    expect(dayTotals(run.results[0]).spend).toBeCloseTo(sumMetrics(run.results[0].cells).spend, 9);
  });
});

describe("rival insights (no bids, SPEC §4.3)", () => {
  it("reports each rival's share and top-slot rate on a keyword, and never a bid", () => {
    const rows = rivalInsights(run.results, "whey protein");
    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) {
      expect(r.sov).toBeGreaterThanOrEqual(0);
      expect(r.sov).toBeLessThanOrEqual(1);
      expect(r.topSlotRate).toBeGreaterThanOrEqual(0);
      expect(r.topSlotRate).toBeLessThanOrEqual(1);
      expect(Object.keys(r)).not.toContain("bid");
    }
    expect(rows.find((r) => r.rivalId === "you")).toBeDefined();
  });
});
