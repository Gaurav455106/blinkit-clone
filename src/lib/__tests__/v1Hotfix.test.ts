/**
 * v1 hotfix tests (SPEC.md §3.3.6 and §3.4).
 *
 * 1. Dayparting: engine.ts must number slots like the schedule editor
 *    (0 = 12–3 AM), so a correct schedule scores higher than a wrong one.
 * 2. Geography: Blinkit only runs ads where the SKU is in stock, so Pan India
 *    is not a mistake. Unstocked selections are ignored, not penalised.
 */

import { describe, it, expect } from "vitest";
import { HOUR_BLOCK_LABELS, DEAD_BLOCKS, getPeakBlocks, computeDaypartMult } from "@/lib/engine";
import { scoreDayparting, scoreSetup, scoreNewCampaign } from "@/lib/newScoring";
import { stockedCoverage, deliverableStates } from "@/lib/geoCoverage";
import { simulateRun } from "@/lib/simResults";
import { BRAND_PROFILES, BLINKIT_STATES, SEASONS, MARKET_CONDITIONS } from "@/data/scenarios";
import type { Scenario, CityStockMap } from "@/data/scenarios";
import type { SavedCampaign } from "@/context/SimContext";

const ALL_SLOTS = [0, 1, 2, 3, 4, 5, 6, 7];

function makeScenario(brandId: string, stocked: Partial<CityStockMap>): Scenario {
  const profile = BRAND_PROFILES.find((b) => b.id === brandId)!;
  const cityStockMap = BLINKIT_STATES.reduce((m, s) => ({ ...m, [s]: 0 }), {} as CityStockMap);
  return {
    seed: `hotfix-${brandId}`,
    profile,
    cityStockMap: { ...cityStockMap, ...stocked },
    season: SEASONS.find((x) => x.name === "Normal Week")!,
    market: MARKET_CONDITIONS.find((x) => x.name === "Stable Market")!,
    inventory: { id: "healthy", label: "Healthy", osa: 85, fillRate: 90, activeStores: 54, agingUnits: 80, tone: "healthy" },
    budget: 200000,
    clientGoals: {
      primary: "Drive sales",
      performanceGoals: [], reachGoals: [], metrics: [],
      threshold: "", lifecycle: "Convert", campaignHint: "",
    },
    scheduledCrisis: { day: 12, eventId: "stock_crisis", reason: "test" },
    city: profile.primaryState,
  };
}

function makeCampaign(overrides: Partial<SavedCampaign> = {}): SavedCampaign {
  return {
    id: "c1", name: "Test", objective: "performance", adFormat: "product_booster",
    cities: ["Karnataka"], skuIds: ["fuel-1"], keywords: ["whey protein"],
    budget: 50000, budgetType: "daily", geography: "select_cities",
    ...overrides,
  };
}

const without = (slots: number[]) => ALL_SLOTS.filter((s) => !slots.includes(s));

// ─── Dayparting ───────────────────────────────────────────────────────────────

describe("Dayparting slot numbering matches the schedule editor", () => {
  it("slot 0 is 12–3 AM and slot 6 is 6–9 PM", () => {
    expect(HOUR_BLOCK_LABELS[0]).toBe("12–3 AM");
    expect(HOUR_BLOCK_LABELS[6]).toBe("6–9 PM");
    expect(HOUR_BLOCK_LABELS[7]).toBe("9 PM–12 AM");
  });

  it("dead hours are 12–6 AM (slots 0 and 1)", () => {
    expect([...DEAD_BLOCKS]).toEqual([0, 1]);
  });

  it("no category has a dead slot as a peak", () => {
    for (const p of BRAND_PROFILES) {
      for (const b of getPeakBlocks(p.category)) expect(DEAD_BLOCKS).not.toContain(b);
    }
  });

  it("switching dead hours off beats 24/7, and switching the category's peaks off loses", () => {
    for (const p of BRAND_PROFILES) {
      const peaks = getPeakBlocks(p.category);
      const deadOff = computeDaypartMult(without([0, 1]), peaks);
      const peaksOff = computeDaypartMult(without(peaks), peaks);
      expect(deadOff).toBeGreaterThan(1.0);
      expect(peaksOff).toBeLessThan(1.0);
    }
  });

  it("FuelUp: dead hours off scores more than evening off (was inverted: 3 vs 15)", () => {
    const scenario = makeScenario("fuelup", { Karnataka: 80 });
    const campaigns = [makeCampaign()];
    const score = (blocks: number[]) => scoreDayparting({
      scenario, campaigns,
      customDayparts: { c1: blocks },
      daypartingChangedOnDay: { c1: 5 },
    }).earned;
    expect(score(without([0, 1]))).toBe(15);
    expect(score(without([6, 7]))).toBeLessThan(score(without([0, 1])));
  });
});

// ─── Geography ────────────────────────────────────────────────────────────────

describe("Geography: ads only run where stock exists", () => {
  const stock = { Karnataka: 80, Maharashtra: 60, Delhi: 40 };

  it("Pan India reaches every stocked state", () => {
    const c = makeCampaign({ geography: "pan_india", cities: [] });
    expect(stockedCoverage(c, stock)).toBe(1);
    expect(deliverableStates(c, stock).sort()).toEqual(["Delhi", "Karnataka", "Maharashtra"]);
  });

  it("unstocked selections are ignored, not penalised", () => {
    const c = makeCampaign({ cities: ["Karnataka", "Maharashtra", "Delhi", "Rajasthan", "Bihar"] });
    expect(stockedCoverage(c, stock)).toBe(1);
    expect(deliverableStates(c, stock)).not.toContain("Rajasthan");
  });

  it("covering one of three stocked states gives coverage 1/3", () => {
    expect(stockedCoverage(makeCampaign({ cities: ["Karnataka"] }), stock)).toBeCloseTo(1 / 3);
  });

  it("no state selected (any geography value) means everywhere, like Pan India", () => {
    expect(stockedCoverage(makeCampaign({ geography: "select_cities", cities: [] }), stock)).toBe(1);
    expect(stockedCoverage(makeCampaign({ geography: null, cities: [] }), stock)).toBe(1);
  });

  it("geography null with states selected uses the selection", () => {
    expect(stockedCoverage(makeCampaign({ geography: null, cities: ["Delhi"] }), stock)).toBeCloseTo(1 / 3);
  });

  it("duplicate states can't push coverage above 1", () => {
    expect(stockedCoverage(makeCampaign({ cities: ["Delhi", "Delhi", "Karnataka", "Maharashtra"] }), stock)).toBe(1);
  });

  it("only unstocked states gives coverage 0", () => {
    expect(stockedCoverage(makeCampaign({ cities: ["Rajasthan"] }), stock)).toBe(0);
  });

  it("setup score: Pan India earns full geography points", () => {
    const scenario = makeScenario("fuelup", stock);
    const geo = (c: SavedCampaign) => scoreSetup(scenario, [c]).lines.find((l) => l.key === "geo")!;
    expect(geo(makeCampaign({ geography: "pan_india", cities: [] })).earned).toBe(7);
    expect(geo(makeCampaign({ cities: ["Karnataka", "Maharashtra", "Delhi", "Rajasthan"] })).earned).toBe(7);
    expect(geo(makeCampaign({ cities: ["Karnataka", "Maharashtra"] })).earned).toBe(4);
    expect(geo(makeCampaign({ cities: ["Karnataka"] })).earned).toBe(2);
    expect(geo(makeCampaign({ cities: ["Rajasthan"] })).earned).toBe(0);
  });

  it("results: Pan India delivers the same as selecting exactly the stocked states", () => {
    const scenario = makeScenario("fuelup", stock);
    const pan = simulateRun(scenario, [makeCampaign({ geography: "pan_india", cities: [...BLINKIT_STATES] })], null);
    const exact = simulateRun(scenario, [makeCampaign({ cities: ["Karnataka", "Maharashtra", "Delhi"] })], null);
    expect(pan.perCampaign[0].impressions).toBe(exact.perCampaign[0].impressions);
    expect(pan.perCampaign[0].revenue).toBe(exact.perCampaign[0].revenue);
  });

  it("mid-run launch: dropping unstocked states is not an improvement; reaching more stocked states is", () => {
    const scenario = makeScenario("fuelup", stock);
    const kw = { keywords: ["whey protein"] };
    const score = (orig: Partial<SavedCampaign>, next: Partial<SavedCampaign>) => scoreNewCampaign({
      scenario,
      originalCampaigns: [makeCampaign({ ...kw, ...orig })],
      newCampaigns: [makeCampaign({ id: "c2", ...kw, ...next })],
      remainingBudgetAtEnd: 50000,
    }).earned;
    // Original Pan India → new campaign with only stocked states: same coverage, no credit
    expect(score({ geography: "pan_india", cities: [] }, { cities: ["Karnataka", "Maharashtra", "Delhi"] })).toBeLessThan(10);
    // Original covered 1 stocked state → new campaign covers all: credit
    expect(score({ cities: ["Karnataka"] }, { geography: "pan_india", cities: [] })).toBe(10);
  });
});
