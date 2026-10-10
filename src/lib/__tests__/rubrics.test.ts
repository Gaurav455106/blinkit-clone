import { describe, it, expect } from "vitest";
import {
  RUBRICS, RUBRIC_BY_KEY, CATEGORY_ORDER, rubricsForCategory, tierFor,
  linesFromFinalScore, qualitativeSummary, type LineResult,
} from "@/lib/rubrics";
import {
  SCORE_MAX, CRISIS_MAX, scoreSetup, scoreDayparting, scoreNewCampaign,
  scoreCrisisResponse, scoreResults, buildLiveOptScore, buildCrisisScore,
  assembleFinalScore, type ScoreLine,
} from "@/lib/newScoring";
import { BRAND_PROFILES, BLINKIT_STATES, SEASONS, MARKET_CONDITIONS } from "@/data/scenarios";
import type { Scenario, CityStockMap } from "@/data/scenarios";
import type { SavedCampaign } from "@/context/SimContext";
import type { RunTotals } from "@/lib/engine";

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeScenario(brandId: string, stocked: Partial<CityStockMap>, metrics: Scenario["clientGoals"]["metrics"] = []): Scenario {
  const profile = BRAND_PROFILES.find((b) => b.id === brandId)!;
  const cityStockMap = BLINKIT_STATES.reduce((m, s) => ({ ...m, [s]: 0 }), {} as CityStockMap);
  return {
    seed: `rubric-${brandId}`,
    profile,
    cityStockMap: { ...cityStockMap, ...stocked },
    season: SEASONS.find((x) => x.name === "Normal Week")!,
    market: MARKET_CONDITIONS.find((x) => x.name === "Stable Market")!,
    inventory: { id: "healthy", label: "Healthy", osa: 85, fillRate: 90, activeStores: 54, agingUnits: 80, tone: "healthy" },
    budget: 200000,
    clientGoals: {
      primary: "Drive sales", performanceGoals: [], reachGoals: [], metrics,
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

function totals(overrides: Partial<RunTotals> = {}): RunTotals {
  return {
    days: 30, totalSpend: 0, totalImpressions: 0, totalClicks: 0, totalAtcs: 0, totalUnits: 0,
    totalRevenue: 0, ctr: 0, roas: 0, cvr: 0, reach: 0, brandedLift: 0, sellThrough: 0,
    ...overrides,
  };
}

function expectOnLadder(line: ScoreLine) {
  const tier = tierFor(line.key, line.earned);
  expect(tier, `${line.key} earned ${line.earned} has no tier`).not.toBeNull();
  expect(RUBRIC_BY_KEY[line.key as keyof typeof RUBRIC_BY_KEY].max).toBe(line.max);
}

const fuelup = BRAND_PROFILES.find((b) => b.id === "fuelup")!;
const henlo = BRAND_PROFILES.find((b) => b.id === "henlo")!;

// ── Structure ─────────────────────────────────────────────────────────────────

describe("rubric structure", () => {
  it("has exactly the 11 v1 score lines", () => {
    expect(RUBRICS.map((r) => r.key)).toEqual([
      "comprehension", "geo", "keywords", "skus", "dayparting", "newcampaign",
      "crisis1", "crisis2", "crisis3", "goalach", "budgetutil",
    ]);
  });

  it("category maxes add up to SCORE_MAX and 100", () => {
    for (const cat of CATEGORY_ORDER) {
      const sum = rubricsForCategory(cat).reduce((s, r) => s + r.max, 0);
      expect(sum).toBe(SCORE_MAX[cat]);
    }
    expect(RUBRICS.reduce((s, r) => s + r.max, 0)).toBe(100);
  });

  it("crisis maxes match CRISIS_MAX", () => {
    expect(RUBRIC_BY_KEY.crisis1.max).toBe(CRISIS_MAX[1]);
    expect(RUBRIC_BY_KEY.crisis2.max).toBe(CRISIS_MAX[2]);
    expect(RUBRIC_BY_KEY.crisis3.max).toBe(CRISIS_MAX[3]);
  });

  it("every ladder starts at the max, ends at the lowest awardable value and is ordered high to low", () => {
    const minimum: Record<string, number> = {
      comprehension: 0, geo: 0, keywords: 1, skus: 0, dayparting: 0, newcampaign: 3,
      crisis1: 0, crisis2: 0, crisis3: 0, goalach: 1, budgetutil: 1,
    };
    for (const r of RUBRICS) {
      expect(r.tiers[0].points).toBe(r.max);
      const last = r.tiers[r.tiers.length - 1];
      expect(last.minPoints ?? last.points).toBe(minimum[r.key]);
      for (let i = 1; i < r.tiers.length; i++) {
        expect(r.tiers[i].points).toBeLessThan(r.tiers[i - 1].minPoints ?? r.tiers[i - 1].points);
      }
      expect(r.judgedOn.length).toBeGreaterThan(10);
      expect(r.howToImprove.length).toBeGreaterThan(10);
    }
  });

  it("crisis ladders cover every integer from 0 to the max", () => {
    for (const key of ["crisis1", "crisis2", "crisis3"] as const) {
      for (let p = 0; p <= RUBRIC_BY_KEY[key].max; p++) expect(tierFor(key, p)).not.toBeNull();
    }
  });

  it("tierFor returns null for values the code can't award", () => {
    expect(tierFor("geo", 5)).toBeNull();
    expect(tierFor("comprehension", 19)).toBeNull();
    expect(tierFor("unknown", 0)).toBeNull();
  });
});

// ── Real scoring output always lands on a tier ────────────────────────────────

describe("real scoring functions land on rubric tiers", () => {
  const stocked = { Karnataka: 100, Delhi: 100, Maharashtra: 100, Telangana: 100 };
  const scenario = makeScenario("fuelup", stocked);

  const setupCases: SavedCampaign[][] = [
    [makeCampaign({ geography: "pan_india", keywords: [...fuelup.goodKeywords.slice(0, 2)] })],
    [makeCampaign({ objective: "reach", adFormat: "listing_spotlight", keywords: [], skuIds: ["a", "b", "c"] })],
    [makeCampaign({ objective: "performance", adFormat: "recommendation_ads", cities: ["Karnataka", "Delhi"], keywords: [fuelup.goodKeywords[0], "random"] })],
    [makeCampaign({ objective: "reach", adFormat: "product_booster", cities: ["Goa"], keywords: ["x", "y"], skuIds: ["a", "b"] })],
    [makeCampaign({ objective: "reach", adFormat: "stories", cities: ["Karnataka"], keywords: [] })],
    [makeCampaign({ objective: "performance", adFormat: "stories", cities: ["Karnataka", "Delhi", "Maharashtra"], keywords: [] })],
  ];

  it("scoreSetup", () => {
    for (const camps of setupCases) {
      const s = scoreSetup(scenario, camps);
      expect(s.lines).toHaveLength(4);
      s.lines.forEach(expectOnLadder);
    }
  });

  it("scoreDayparting", () => {
    const camps = [makeCampaign()];
    const schedules: [number[] | undefined, number | undefined][] = [
      [undefined, undefined], [[2, 3, 4, 5, 6, 7], 5], [[2, 3, 4, 5, 6, 7], 31],
      [[0, 1, 2, 3], 4], [[4, 5, 6, 7], 10], [[6], 2], [[0, 1, 2, 3, 4, 5, 6, 7], 3],
    ];
    for (const [blocks, day] of schedules) {
      const line = scoreDayparting({
        scenario, campaigns: camps,
        customDayparts: blocks ? { c1: blocks } : {},
        daypartingChangedOnDay: day !== undefined ? { c1: day } : {},
      });
      expectOnLadder(line);
    }
  });

  it("scoreNewCampaign", () => {
    const orig = [makeCampaign({ cities: ["Karnataka"], keywords: ["random"] })];
    const cases: [SavedCampaign[], number][] = [
      [[], 50_000], [[], 0],
      [[makeCampaign({ id: "n", launchDay: 10, geography: "pan_india", keywords: [] })], 0],
      [[makeCampaign({ id: "n", launchDay: 10, cities: ["Karnataka"], keywords: ["random"] })], 0],
    ];
    for (const [newCampaigns, remaining] of cases) {
      expectOnLadder(scoreNewCampaign({ scenario, originalCampaigns: orig, newCampaigns, remainingBudgetAtEnd: remaining }));
    }
  });

  it("scoreCrisisResponse for every option score out of 10 and legacy 15", () => {
    for (const num of [1, 2, 3] as const) {
      for (let s = 0; s <= 10; s++) expectOnLadder(scoreCrisisResponse(num, "a", s, 10));
      for (let s = 0; s <= 15; s++) expectOnLadder(scoreCrisisResponse(num, "a", s, 15));
      expectOnLadder(scoreCrisisResponse(num, "a", 0, 0));
    }
  });

  it("scoreResults", () => {
    const sc = makeScenario("henlo", stocked, [
      { label: "ROAS", target: 4, unit: "x" } as Scenario["clientGoals"]["metrics"][number],
      { label: "Units sold", target: 1000, unit: "units" } as Scenario["clientGoals"]["metrics"][number],
    ]);
    const runs: [Partial<RunTotals>, number][] = [
      [{ roas: 4, totalUnits: 1000 }, 200_000], [{ roas: 3, totalUnits: 800 }, 150_000],
      [{ roas: 2, totalUnits: 500 }, 120_000], [{ roas: 0.5, totalUnits: 10 }, 10_000],
    ];
    for (const [t, spend] of runs) {
      scoreResults(sc, totals(t), spend).lines.forEach(expectOnLadder);
    }
  });
});

// ── Lines and qualitative summary ─────────────────────────────────────────────

function buildFinal(crisisNums: (1 | 2 | 3)[]) {
  const scenario = makeScenario("henlo", { [henlo.primaryState]: 100 });
  const setup = scoreSetup(scenario, [makeCampaign({ objective: "reach", adFormat: "stories", keywords: ["x"], skuIds: ["a", "b", "c"] })]);
  const live = buildLiveOptScore(
    scoreDayparting({ scenario, campaigns: [], customDayparts: {}, daypartingChangedOnDay: {} }),
    scoreNewCampaign({ scenario, originalCampaigns: [], newCampaigns: [], remainingBudgetAtEnd: 0 }),
  );
  const crisis = buildCrisisScore(crisisNums.map((n) => scoreCrisisResponse(n, "a", 10, 10)));
  const results = scoreResults(scenario, totals(), 190_000);
  return assembleFinalScore(setup, live, crisis, results);
}

describe("linesFromFinalScore", () => {
  it("returns all 11 lines in rubric order, filling unanswered crises with 0", () => {
    const lines = linesFromFinalScore(buildFinal([1]));
    expect(lines.map((l) => l.key)).toEqual(RUBRICS.map((r) => r.key));
    const c2 = lines.find((l) => l.key === "crisis2")!;
    expect(c2.earned).toBe(0);
    expect(c2.max).toBe(9);
    expect(c2.note).toMatch(/no answer/i);
    expect(lines.find((l) => l.key === "crisis1")!.earned).toBe(8);
  });

  it("line totals equal the final score", () => {
    const fs = buildFinal([1, 2, 3]);
    expect(linesFromFinalScore(fs).reduce((s, l) => s + l.earned, 0)).toBe(fs.grandTotal);
  });
});

describe("qualitativeSummary", () => {
  it("writes one paragraph per category with lost points and fixes", () => {
    const summary = qualitativeSummary(buildFinal([1]));
    expect(summary.map((s) => s.category)).toEqual(CATEGORY_ORDER);
    const live = summary.find((s) => s.category === "liveOpt")!;
    expect(live.earned).toBe(3);
    expect(live.max).toBe(25);
    expect(live.paragraph).toMatch(/22 points/);
    expect(live.paragraph).toMatch(/Dayparting/i);
    expect(live.fixes.length).toBeGreaterThan(0);
    expect(live.lost[0].key).toBe("dayparting");
  });

  it("praises a perfect category and lists no fixes", () => {
    const lines: LineResult[] = RUBRICS.map((r) => ({ key: r.key, label: r.label, category: r.category, earned: r.max, max: r.max, note: "ok" }));
    const summary = qualitativeSummary(lines);
    for (const s of summary) {
      expect(s.lost).toHaveLength(0);
      expect(s.fixes).toHaveLength(0);
      expect(s.paragraph).toMatch(/full marks/i);
    }
  });

  it("accepts saved lines with unknown keys without crashing", () => {
    const summary = qualitativeSummary([{ key: "mystery", label: "Mystery", category: "setup", earned: 1, max: 2, note: "" }]);
    expect(summary).toHaveLength(4);
  });
});
