/**
 * Simulation validation tests.
 *
 * Run:  npm test
 * Watch: npm run test:watch
 *
 * These tests guard against regressions when:
 * - Scoring logic changes (scoring.ts)
 * - Simulation engine changes (simResults.ts)
 * - Brand profiles or goal structures change (scenarios.ts)
 *
 * Every test uses deterministic, hardcoded inputs — no randomness.
 */

import { describe, it, expect } from "vitest";

// ─── Scoring ────────────────────────────────────────────────────────────────
import {
  requiredBuckets,
  isAwarenessFormat,
  isConversionFormat,
  AWARENESS_FORMATS,
  CONVERSION_FORMATS,
} from "@/lib/scoring";
import type { GoalType } from "@/data/scenarios";

describe("Format buckets", () => {
  it("classifies awareness formats correctly", () => {
    for (const f of AWARENESS_FORMATS) expect(isAwarenessFormat(f)).toBe(true);
  });

  it("classifies conversion formats correctly", () => {
    for (const f of CONVERSION_FORMATS) expect(isConversionFormat(f)).toBe(true);
  });

  it("does not cross-classify", () => {
    for (const f of AWARENESS_FORMATS) expect(isConversionFormat(f)).toBe(false);
    for (const f of CONVERSION_FORMATS) expect(isAwarenessFormat(f)).toBe(false);
  });

  it("handles null / undefined safely", () => {
    expect(isAwarenessFormat(null)).toBe(false);
    expect(isConversionFormat(undefined)).toBe(false);
    expect(isAwarenessFormat("")).toBe(false);
  });
});

describe("requiredBuckets", () => {
  const cases: [GoalType, ReturnType<typeof requiredBuckets>][] = [
    ["Awareness-First",    "awareness"],
    ["Category-Creation",  "awareness"],
    ["ROAS-First",         "conversion"],
    ["Inventory-Clearance","conversion"],
    ["Volume-First",       "both"],
  ];

  for (const [goalType, expected] of cases) {
    it(`${goalType} → ${expected}`, () => {
      expect(requiredBuckets(goalType)).toBe(expected);
    });
  }
});

// ─── Simulation engine ───────────────────────────────────────────────────────
import { simulateRun } from "@/lib/simResults";
import { BRAND_PROFILES, BLINKIT_STATES } from "@/data/scenarios";
import type { Scenario, CityStockMap } from "@/data/scenarios";
import type { SavedCampaign, CmPitchResult } from "@/context/SimContext";

/** Build a minimal deterministic scenario for a given brand id */
function makeScenario(brandId: string, stockOverride?: Partial<CityStockMap>): Scenario {
  const profile = BRAND_PROFILES.find((b) => b.id === brandId)!;
  const cityStockMap = BLINKIT_STATES.reduce((m, s) => ({ ...m, [s]: 0 }), {} as CityStockMap);
  // Give stock only in primary state
  cityStockMap[profile.primaryState] = 80;
  if (stockOverride) Object.assign(cityStockMap, stockOverride);

  return {
    seed: `test-${brandId}`,
    profile,
    cityStockMap,
    season: { name: "Normal Week", note: "Baseline demand, no spikes." },
    market: { name: "Stable Market", note: "No major competitor moves." },
    inventory: { id: "healthy", label: "Healthy", osa: 85, fillRate: 90, activeStores: 54, agingUnits: 80, tone: "healthy" },
    budget: 200000,
    clientGoals: {
      primary: "Drive sales",
      performanceGoals: [{ label: "ROAS", target: 3, unit: "x" }, { label: "Units sold", target: 600, unit: "units" }],
      reachGoals: [{ label: "Reach", target: 200000, unit: "users" }],
      metrics: [{ label: "ROAS", target: 3, unit: "x" }, { label: "Units sold", target: 600, unit: "units" }, { label: "Reach", target: 200000, unit: "users" }],
      threshold: "90%+ = promotion",
      lifecycle: "Convert",
      campaignHint: "Lead with Product Booster.",
    },
    scheduledCrisis: { day: 12, eventId: "stock_crisis", reason: "test" },
    city: profile.primaryState,
  };
}

function makeCampaign(overrides: Partial<SavedCampaign> = {}): SavedCampaign {
  return {
    id: "c1",
    name: "Test Campaign",
    objective: "performance",
    adFormat: "product_booster",
    cities: ["Karnataka"],
    skuIds: ["henlo-1"],
    keywords: ["dog treats"],
    budget: 50000,
    budgetType: "daily",
    geography: "select_cities",
    ...overrides,
  };
}

const strongCm: CmPitchResult = {
  status: "strong",
  approvedSKUs: ["henlo-1"],
  approvedCities: ["Karnataka"],
  pitchScore: 15,
  osaBoost: true,
  message: "Strong pitch",
  flags: [],
};

const weakCm: CmPitchResult = {
  status: "weak",
  approvedSKUs: ["henlo-1"],
  approvedCities: ["Karnataka"],
  pitchScore: 5,
  osaBoost: false,
  message: "Weak pitch",
  flags: ["some flag"],
};

// ─── buildEffectiveStockMap / effectiveDelivery ──────────────────────────────
describe("OSA & stock delivery", () => {
  it("strong CM pitch boosts OSA in approved cities", () => {
    const scenario = makeScenario("henlo"); // Karnataka = 80
    const campaign = makeCampaign({ cities: ["Karnataka"] });
    const resultStrong = simulateRun(scenario, [campaign], strongCm);
    const resultWeak   = simulateRun(scenario, [campaign], weakCm);
    // Strong CM → osaBoost → more impressions
    expect(resultStrong.perCampaign[0].impressions).toBeGreaterThan(resultWeak.perCampaign[0].impressions);
  });

  it("zero-OSA states produce zero impressions", () => {
    const scenario = makeScenario("henlo"); // only Karnataka stocked
    // Campaign targeting an unstocked state
    const campaign = makeCampaign({ cities: ["Rajasthan"] });
    const result = simulateRun(scenario, [campaign], null);
    expect(result.perCampaign[0].impressions).toBe(0);
    expect(result.perCampaign[0].spend).toBe(0);
  });

  it("Pan India with 1/23 states stocked delivers far less than selecting that state only", () => {
    const scenario = makeScenario("henlo"); // Karnataka = 80, rest = 0
    const allStates = [...BLINKIT_STATES];
    const panIndia = makeCampaign({ cities: allStates, budget: 100000 });
    const selectOnly = makeCampaign({ cities: ["Karnataka"], budget: 100000 });

    const panResult    = simulateRun(scenario, [panIndia],    null);
    const selectResult = simulateRun(scenario, [selectOnly],  null);

    // Pan India with 1/23 stocked → stateScale ≈ 0.043 → much lower delivery
    expect(panResult.perCampaign[0].impressions).toBeLessThan(selectResult.perCampaign[0].impressions);
  });

  it("selecting only stocked states = no noBadCities penalty in score", () => {
    const scenario = makeScenario("henlo");
    const goodCampaign = makeCampaign({ cities: ["Karnataka"] });
    const badCampaign  = makeCampaign({ cities: ["Karnataka", "Rajasthan"] }); // Rajasthan = 0 stock

    const good = simulateRun(scenario, [goodCampaign], null);
    const bad  = simulateRun(scenario, [badCampaign],  null);

    const stockGood = good.decisionScore.find((d) => d.label === "Stock Management")!;
    const stockBad  = bad.decisionScore.find((d) => d.label === "Stock Management")!;
    expect(stockGood.earned).toBeGreaterThan(stockBad.earned);
  });
});

// ─── Format bucket coverage in Campaign Architecture ────────────────────────
describe("Campaign Architecture — bucket coverage", () => {
  it("ROAS-First brand: only conversion campaign → full arch score", () => {
    const scenario = makeScenario("henlo"); // ROAS-First
    const campaign = makeCampaign({ adFormat: "product_booster" });
    const result = simulateRun(scenario, [campaign], null);
    const arch = result.decisionScore.find((d) => d.label === "Campaign Architecture")!;
    // bucket covered → arch score NOT halved
    expect(arch.earned).toBeGreaterThan(0);
    expect(result.wrongs.some((w) => w.includes("conversion"))).toBe(false);
  });

  it("Awareness-First brand: only conversion campaign → arch score halved + wrong feedback", () => {
    // Use Glow Republic (Awareness-First) but override goalType via clientGoals
    const scenario = makeScenario("glow");
    scenario.profile = { ...scenario.profile, goalType: "Awareness-First" };
    scenario.clientGoals = { ...scenario.clientGoals, performanceGoals: [], reachGoals: [{ label: "Impressions", target: 5000000, unit: "imp" }], metrics: [{ label: "Impressions", target: 5000000, unit: "imp" }] };

    const campaign = makeCampaign({ adFormat: "product_booster", objective: "performance" });
    const result = simulateRun(scenario, [campaign], null);

    expect(result.wrongs.some((w) => w.includes("awareness"))).toBe(true);
  });

  it("Volume-First brand: both buckets covered → no wrong feedback about buckets", () => {
    const scenario = makeScenario("tinybuddy");
    scenario.profile = { ...scenario.profile, goalType: "Volume-First" };
    scenario.cityStockMap["Delhi"] = 80;

    const conversionCampaign = makeCampaign({ id: "c1", adFormat: "recommendation_ads", objective: "performance", cities: ["Delhi"], skuIds: ["tiny-1"] });
    const awarenessCampaign  = makeCampaign({ id: "c2", adFormat: "brand_booster",      objective: "reach",       cities: ["Delhi"], skuIds: ["tiny-1"] });

    const result = simulateRun(scenario, [conversionCampaign, awarenessCampaign], null);
    expect(result.wrongs.some((w) => w.includes("Missing awareness") || w.includes("Missing conversion"))).toBe(false);
    expect(result.rights.some((r) => r.includes("full funnel"))).toBe(true);
  });

  it("Volume-First brand: only awareness campaign → penalised for missing conversion", () => {
    const scenario = makeScenario("tinybuddy");
    scenario.profile = { ...scenario.profile, goalType: "Volume-First" };
    scenario.cityStockMap["Delhi"] = 80;

    const campaign = makeCampaign({ adFormat: "brand_booster", objective: "reach", cities: ["Delhi"] });
    const result = simulateRun(scenario, [campaign], null);
    expect(result.wrongs.some((w) => w.includes("Missing conversion"))).toBe(true);
  });
});

// ─── ClientGoals structure ───────────────────────────────────────────────────
import { BRAND_PROFILES as BP } from "@/data/scenarios";

describe("generateScenario — ClientGoals structure", () => {
  // We can't call generateScenario directly (it has randomness) so we test
  // the brand profiles themselves for required fields.

  it("all brand profiles have required fields", () => {
    for (const p of BP) {
      expect(p.id).toBeTruthy();
      expect(p.goodKeywords.length).toBeGreaterThan(0);
      expect(p.riskyKeywords.length).toBeGreaterThan(0);
      expect(p.skus.length).toBeGreaterThanOrEqual(2);
      expect(p.primaryState).toBeTruthy();
      expect(["performance", "reach"]).toContain(p.optimalObjective);
    }
  });

  it("metrics = union of performanceGoals + reachGoals in makeScenario", () => {
    const scenario = makeScenario("henlo");
    const { performanceGoals, reachGoals, metrics } = scenario.clientGoals;
    expect(metrics.length).toBe(performanceGoals.length + reachGoals.length);
    for (const g of performanceGoals) expect(metrics).toContainEqual(g);
    for (const g of reachGoals)      expect(metrics).toContainEqual(g);
  });
});

// ─── Simulation smoke test — all brand profiles ─────────────────────────────
describe("simulateRun smoke test — all brands", () => {
  for (const profile of BRAND_PROFILES) {
    it(`${profile.name} (${profile.id}) produces valid output`, () => {
      const scenario = makeScenario(profile.id);
      scenario.cityStockMap[profile.primaryState] = 80;

      const campaign = makeCampaign({
        adFormat: profile.optimalAdFormat,
        objective: profile.optimalObjective,
        cities: [profile.primaryState],
        skuIds: [profile.skus[0].id],
        keywords: profile.goodKeywords.slice(0, 2),
        budget: 50000,
      });

      const result = simulateRun(scenario, [campaign], null);

      // Basic shape checks
      expect(result.perCampaign).toHaveLength(1);
      expect(result.totals.impressions).toBeGreaterThanOrEqual(0);
      expect(result.totals.spend).toBeGreaterThanOrEqual(0);
      expect(result.totals.spend).toBeLessThanOrEqual(campaign.budget);
      expect(result.totals.roas).toBeGreaterThanOrEqual(0);
      expect(result.achievementPct).toBeGreaterThanOrEqual(0);
      expect(result.achievementPct).toBeLessThanOrEqual(200); // capped at 150 per metric but allow some headroom
      expect(result.decisionTotal).toBeGreaterThanOrEqual(0);
      expect(Array.isArray(result.rights)).toBe(true);
      expect(Array.isArray(result.wrongs)).toBe(true);

      // Optimal campaign should always have impressions > 0 (stock is set)
      expect(result.perCampaign[0].impressions).toBeGreaterThan(0);
    });
  }
});

// ─── Scoring direction checks ────────────────────────────────────────────────
describe("Score direction — better decisions score higher", () => {
  const scenario = makeScenario("henlo"); // ROAS-First, optimal = product_booster

  it("optimal format scores higher than wrong format", () => {
    const optimal  = makeCampaign({ adFormat: "product_booster",  objective: "performance" });
    const wrong    = makeCampaign({ adFormat: "listing_spotlight", objective: "reach"       });

    const r1 = simulateRun(scenario, [optimal], null);
    const r2 = simulateRun(scenario, [wrong],   null);
    expect(r1.decisionTotal).toBeGreaterThan(r2.decisionTotal);
  });

  it("good keywords produce more clicks and units than risky keywords (same impressions)", () => {
    // Keywords affect CTR (click quality), not raw impression volume.
    // Good keywords → higher kwQuality → higher CTR → more clicks → more units/revenue.
    const good  = makeCampaign({ keywords: scenario.profile.goodKeywords });
    const risky = makeCampaign({ keywords: scenario.profile.riskyKeywords });

    const r1 = simulateRun(scenario, [good],  null);
    const r2 = simulateRun(scenario, [risky], null);

    // Impressions are the same (keywords don't affect delivery volume)
    expect(r1.totals.impressions).toBe(r2.totals.impressions);
    // But clicks and units are higher for good keywords
    expect(r1.totals.clicks).toBeGreaterThan(r2.totals.clicks);
    expect(r1.totals.units).toBeGreaterThan(r2.totals.units);
  });

  it("strong CM pitch produces more revenue than weak CM pitch", () => {
    const campaign = makeCampaign();
    const r1 = simulateRun(scenario, [campaign], strongCm);
    const r2 = simulateRun(scenario, [campaign], weakCm);
    expect(r1.totals.revenue).toBeGreaterThan(r2.totals.revenue);
  });

  it("correct objective scores higher than wrong objective", () => {
    const correct = makeCampaign({ objective: "performance" }); // henlo = ROAS-First
    const wrong   = makeCampaign({ objective: "reach" });

    const r1 = simulateRun(scenario, [correct], null);
    const r2 = simulateRun(scenario, [wrong],   null);

    const objRight = r1.decisionScore.find((d) => d.label === "Brief comprehension")!;
    const objWrong = r2.decisionScore.find((d) => d.label === "Brief comprehension")!;
    expect(objRight.earned).toBeGreaterThan(objWrong.earned);
  });
});
