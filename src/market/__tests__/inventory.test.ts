// Slice 1f-b: every format has inventory to win (SPEC §3.2.2).

import { describe, it, expect } from "vitest";
import { stepDay } from "@/market/step";
import { initialMarketState } from "@/market/state";
import { runAuction } from "@/market/auction";
import type { CampaignConfig, CellRow, DayResult, MarketContext, MarketState } from "@/market/engineTypes";
import { FUELUP } from "@/market/data/fuelup";
import { BRAND_PROFILES, BLINKIT_STATES, SEASONS, MARKET_CONDITIONS } from "@/data/scenarios";
import type { Scenario, CityStockMap } from "@/data/scenarios";

const PLACEMENTS = {
  category: "category:Sports Nutrition",
  spotlight: "spotlight:search",
  stories: "stories:main-feed",
  recommendation: "rec:cart",
} as const;

function makeCtx(): MarketContext {
  const profile = BRAND_PROFILES.find((b) => b.id === "fuelup")!;
  const cityStockMap = BLINKIT_STATES.reduce((m, s) => ({ ...m, [s]: 0 }), {} as CityStockMap);
  const scenario: Scenario = {
    seed: "test", profile, cityStockMap: { ...cityStockMap, Karnataka: 80, Maharashtra: 70, Delhi: 60 },
    season: SEASONS.find((x) => x.name === "Normal Week")!,
    market: MARKET_CONDITIONS.find((x) => x.name === "Stable Market")!,
    inventory: { id: "healthy", label: "Healthy", osa: 85, fillRate: 90, activeStores: 54, agingUnits: 80, tone: "healthy" },
    budget: 200000,
    clientGoals: { primary: "", performanceGoals: [], reachGoals: [], metrics: [], threshold: "", lifecycle: "Convert", campaignHint: "" },
    scheduledCrisis: { day: 12, eventId: "stock_crisis", reason: "" },
    city: profile.primaryState,
  };
  return { seed: "batch-1|fuelup", scenario, market: FUELUP, totalDays: 30, startWeekday: 1 };
}

function placementCampaign(id: string, bid: number, overrides: Partial<CampaignConfig> = {}): CampaignConfig {
  return {
    id: "p1", skuIds: ["fuel-1", "fuel-2"], keywords: [], placements: [{ id, bid }],
    geography: "pan_india", cities: [], budgetType: "daily", budget: 100000, launchDay: 1,
    ...overrides,
  };
}

const total = (rows: readonly CellRow[], key: keyof CellRow) => rows.reduce((s, r) => s + (r[key] as number), 0);
const day1 = (ctx: MarketContext, campaigns: CampaignConfig[]) => stepDay(ctx, initialMarketState(ctx), campaigns).result;

describe("runAuction with fewer slots", () => {
  it("fills only as many slots as the view rates allow", () => {
    const bidders = [300, 400, 500].map((b, i) => ({ id: `r${i}`, ownerId: `r${i}`, bid: b, relevance: 1 }));
    expect(runAuction(bidders, [1])).toHaveLength(1);
    expect(runAuction(bidders, [1, 0.55])).toHaveLength(2);
  });
});

describe("every non-keyword inventory type", () => {
  for (const [kind, id] of Object.entries(PLACEMENTS)) {
    describe(kind, () => {
      it("delivers impressions and spend, labelled with the placement", () => {
        const r = day1(makeCtx(), [placementCampaign(id, 500)]);
        expect(r.cells.length).toBeGreaterThan(0);
        expect(r.cells.every((c) => c.term === id && c.matchType === "placement" && c.inventory === kind)).toBe(true);
        expect(total(r.cells, "viewableImpressions")).toBeGreaterThan(0);
        expect(total(r.cells, "spend")).toBeGreaterThan(0);
      });

      it("keeps the visibility partition exact", () => {
        const r = day1(makeCtx(), [placementCampaign(id, 400, { budget: 300 })]);
        for (const c of r.cells) expect(c.lostToStock + c.lostToBudget + c.lostToRank + c.won).toBeCloseTo(c.searches, 6);
      });

      it("a higher bid never lowers viewable impressions, and a very high bid wins nearly every top slot", () => {
        const ctx = makeCtx();
        const vi = (bid: number) => {
          const r = day1(ctx, [placementCampaign(id, bid)]);
          return total(r.cells, "viewableImpressions") / (total(r.cells, "searches") - total(r.cells, "lostToStock"));
        };
        const levels = [250, 400, 600, 1000, 5000].map(vi);
        for (let i = 1; i < levels.length; i++) expect(levels[i]).toBeGreaterThanOrEqual(levels[i - 1] - 1e-9);
        expect(levels[levels.length - 1]).toBeGreaterThan(0.99);
      });
    });
  }

  it("single-slot placements (Spotlight, Stories) never give more than one view per eligible search", () => {
    for (const id of [PLACEMENTS.spotlight, PLACEMENTS.stories]) {
      const r = day1(makeCtx(), [placementCampaign(id, 5000)]);
      for (const c of r.cells) expect(c.viewableImpressions).toBeLessThanOrEqual(c.won + 1e-9);
      expect(total(r.cells, "totalAdViewable")).toBeCloseTo(total(r.cells, "searches"), 0);
    }
  });

  it("a rival's placement bid takes share: IronWhey bids on the Sports Nutrition page", () => {
    const iron = FUELUP.rivals.find((r) => r.id === "ironwhey")!;
    expect(iron.placementBids?.[PLACEMENTS.category]).toBeGreaterThan(0);
    const r = day1(makeCtx(), [placementCampaign(PLACEMENTS.category, 250)]);
    const ironRows = r.rivals.filter((x) => x.rivalId === "ironwhey" && x.term === PLACEMENTS.category);
    expect(ironRows.reduce((sum, x) => sum + x.viewableImpressions, 0)).toBeGreaterThan(0);
  });
});

describe("creative and fatigue (Spotlight, Stories)", () => {
  it("a better creative gets more clicks from the same impressions", () => {
    const ctx = makeCtx();
    const clicksPerView = (creativeMult: number) => {
      const r = day1(ctx, [placementCampaign(PLACEMENTS.spotlight, 5000, { creativeMult })]);
      return total(r.cells, "clicks") / total(r.cells, "viewableImpressions");
    };
    expect(clicksPerView(1.1)).toBeGreaterThan(clicksPerView(0.8));
  });

  it("Stories CTR falls as the same shoppers keep seeing the ad", () => {
    const ctx = makeCtx();
    // ₹15,000/day for 12 days stays inside the ₹2,00,000 scenario budget
    const camp = [placementCampaign(PLACEMENTS.stories, 5000, { geography: "select_cities", cities: ["Karnataka"], budget: 15000 })];
    let state: MarketState = initialMarketState(ctx);
    const results: DayResult[] = [];
    for (let d = 0; d < 12; d++) {
      const out = stepDay(ctx, state, camp);
      state = out.state;
      results.push(out.result);
    }
    const ctr = (r: DayResult) => total(r.cells, "clicks") / total(r.cells, "viewableImpressions");
    expect(total(results[11].cells, "viewableImpressions")).toBeGreaterThan(0);
    expect(ctr(results[11])).toBeLessThan(ctr(results[0]) * 0.92);
  });

  it("keyword ads don't fatigue", () => {
    const ctx = makeCtx();
    const camp: CampaignConfig[] = [{ ...placementCampaign(PLACEMENTS.category, 0), placements: [], keywords: [{ term: "whey protein", exactBid: 5000 }], geography: "select_cities", cities: ["Karnataka"] }];
    let state: MarketState = initialMarketState(ctx);
    const ctrs: number[] = [];
    for (let d = 0; d < 20; d++) {
      const out = stepDay(ctx, state, camp);
      state = out.state;
      const kwCells = out.result.cells.filter((c) => c.inventory === "keyword");
      ctrs.push(total(kwCells, "clicks") / total(kwCells, "viewableImpressions"));
    }
    expect(ctrs[19]).toBeGreaterThanOrEqual(ctrs[0] * 0.95);
  });
});

describe("keyword and placement campaigns together", () => {
  it("one campaign can run keywords and category bids, sharing one budget", () => {
    const ctx = makeCtx();
    const c: CampaignConfig = {
      id: "pb", skuIds: ["fuel-1"], keywords: [{ term: "whey protein", exactBid: 450 }],
      placements: [{ id: PLACEMENTS.category, bid: 450 }],
      geography: "pan_india", cities: [], budgetType: "daily", budget: 800, launchDay: 1,
    };
    const r = day1(ctx, [c]);
    expect(new Set(r.cells.map((x) => x.inventory))).toEqual(new Set(["keyword", "category"]));
    expect(total(r.cells, "spend")).toBeLessThanOrEqual(800 + 1e-6);
  });
});
