import { describe, it, expect } from "vitest";
import { stepDay } from "@/market/step";
import { initialMarketState } from "@/market/state";
import type { CampaignConfig, CellRow, DayResult, MarketContext, MarketState } from "@/market/engineTypes";
import { FUELUP } from "@/market/data/fuelup";
import { BRAND_PROFILES, BLINKIT_STATES, SEASONS, MARKET_CONDITIONS } from "@/data/scenarios";
import type { Scenario, CityStockMap } from "@/data/scenarios";
import { RESTOCK_INTERVAL_DAYS } from "@/market/stock";
import { MAX_DAILY_FLEX, trafficIndex } from "@/market/step";

const STOCK = { Karnataka: 80, Maharashtra: 70, Delhi: 60 };

function makeCtx(stock: Partial<CityStockMap> = STOCK): MarketContext {
  const profile = BRAND_PROFILES.find((b) => b.id === "fuelup")!;
  const cityStockMap = BLINKIT_STATES.reduce((m, s) => ({ ...m, [s]: 0 }), {} as CityStockMap);
  const scenario: Scenario = {
    seed: "test", profile, cityStockMap: { ...cityStockMap, ...stock },
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

function camp(overrides: Partial<CampaignConfig> = {}): CampaignConfig {
  return {
    id: "c1", skuIds: ["fuel-1"],
    keywords: [{ term: "whey protein", exactBid: 450 }, { term: "whey protein chocolate", exactBid: 450 }],
    geography: "pan_india", cities: [], budgetType: "daily", budget: 6000, launchDay: 1,
    ...overrides,
  };
}

const total = (rows: readonly CellRow[], key: keyof CellRow) =>
  rows.reduce((s, r) => s + (r[key] as number), 0);

function runDays(ctx: MarketContext, campaigns: CampaignConfig[], days: number): { state: MarketState; results: DayResult[] } {
  let state = initialMarketState(ctx);
  const results: DayResult[] = [];
  for (let d = 0; d < days; d++) {
    const out = stepDay(ctx, state, campaigns);
    state = out.state;
    results.push(out.result);
  }
  return { state, results };
}

describe("stepDay basics", () => {
  it("advances the day and is fully repeatable", () => {
    const ctx = makeCtx();
    const a = stepDay(ctx, initialMarketState(ctx), [camp()]);
    const b = stepDay(ctx, initialMarketState(ctx), [camp()]);
    expect(a.result.day).toBe(1);
    expect(a.state.day).toBe(1);
    expect(a.result).toEqual(b.result);
    expect(a.state).toEqual(b.state);
  });

  it("delivers impressions, clicks and revenue for a sensible campaign", () => {
    const ctx = makeCtx();
    const { result } = stepDay(ctx, initialMarketState(ctx), [camp()]);
    expect(total(result.cells, "viewableImpressions")).toBeGreaterThan(0);
    expect(total(result.cells, "spend")).toBeGreaterThan(0);
    expect(total(result.cells, "directRevenue")).toBeGreaterThan(0);
  });

  it("does nothing before a campaign's launch day or while paused", () => {
    const ctx = makeCtx();
    expect(stepDay(ctx, initialMarketState(ctx), [camp({ launchDay: 3 })]).result.cells).toHaveLength(0);
    expect(stepDay(ctx, initialMarketState(ctx), [camp({ paused: true })]).result.cells).toHaveLength(0);
  });
});

describe("budget (F5)", () => {
  it("never spends more than the daily budget × the traffic flex", () => {
    const ctx = makeCtx();
    const { results } = runDays(ctx, [camp({ budget: 1500 })], 5);
    for (const r of results) expect(total(r.cells, "spend")).toBeLessThanOrEqual(1500 * MAX_DAILY_FLEX + 1e-6);
  });

  it("paces an overall budget as remaining ÷ days left", () => {
    const ctx = makeCtx();
    const { results } = runDays(ctx, [camp({ budgetType: "overall", budget: 30000, endDay: 30 })], 3);
    for (const r of results) expect(total(r.cells, "spend")).toBeLessThanOrEqual((30000 / 28) * MAX_DAILY_FLEX + 1e-6);
  });

  it("never lets total spend pass the scenario budget", () => {
    const ctx = makeCtx();
    const huge = [camp({ id: "a", budget: 150000 }), camp({ id: "b", budget: 150000, keywords: [{ term: "protein powder", exactBid: 900 }] })];
    const { state } = runDays(ctx, huge, 3);
    expect(state.totalSpend).toBeLessThanOrEqual(200000 + 1e-6);
  });

  it("a tight 24/7 budget runs dry before the 6–9 PM peak; switching dead hours off moves money into it", () => {
    const ctx = makeCtx();
    const kws = [{ term: "protein powder", exactBid: 600 }, { term: "whey protein", exactBid: 600 }, { term: "protein supplement", exactBid: 600 }];
    // Budget = just under what 24/7 would spend before 6 PM, so 24/7 runs dry right before the peak
    const uncapped = stepDay(ctx, initialMarketState(ctx), [camp({ keywords: kws, budget: 1e9 })]).result;
    // (today's cap is the budget × today's traffic index)
    const budget = total(uncapped.cells.filter((c) => c.slot < 6), "spend") * 0.97 / Math.min(MAX_DAILY_FLEX, trafficIndex(ctx, 1));
    const allDay = stepDay(ctx, initialMarketState(ctx), [camp({ keywords: kws, budget })]).result;
    const deadOff = stepDay(ctx, initialMarketState(ctx), [camp({ keywords: kws, budget, schedule: [2, 3, 4, 5, 6, 7] })]).result;
    const peakSpend = (r: DayResult) => total(r.cells.filter((c) => c.slot === 6), "spend");
    expect(peakSpend(allDay)).toBeLessThan(peakSpend(deadOff));
    expect(total(deadOff.cells.filter((c) => c.slot < 2), "spend")).toBe(0);
  });
});

describe("daily budgets flex with traffic, normalised weekly (SPEC §3.3.2)", () => {
  // Day 1 is a Monday (startWeekday 1); day 7 is Sunday, the busiest weekday.
  const hungry = () => camp({ keywords: [{ term: "protein powder", exactBid: 900 }, { term: "whey protein", exactBid: 900 }, { term: "protein bar", exactBid: 900 }], budget: 1500 });
  const daySpend = (r: DayResult) => total(r.cells, "spend");

  it("spends more than the daily budget on a busy day, but never more than 1.5×", () => {
    const ctx = makeCtx();
    const { results } = runDays(ctx, [hungry()], 7);
    const sunday = results[6];
    expect(daySpend(sunday)).toBeGreaterThan(1500);
    for (const r of results) expect(daySpend(r)).toBeLessThanOrEqual(1500 * MAX_DAILY_FLEX + 1e-6);
  });

  it("spends less than the daily budget on a quiet day", () => {
    const ctx = makeCtx();
    const { results } = runDays(ctx, [hungry()], 2);
    expect(daySpend(results[1])).toBeLessThan(1500);
  });

  it("never spends more than 7 × the daily budget in a week, or days × budget over the run", () => {
    const ctx = makeCtx();
    const { results, state } = runDays(ctx, [hungry()], 30);
    for (let w = 0; w < 5; w++) {
      const week = results.slice(w * 7, w * 7 + 7);
      expect(week.reduce((s, r) => s + daySpend(r), 0)).toBeLessThanOrEqual(1500 * week.length + 1e-6);
    }
    expect(state.campaignSpend.c1).toBeLessThanOrEqual(1500 * 30 + 1e-6);
  });

  it("a ₹2 lakh daily budget on a new account is held back by what the market can deliver and the ₹2 lakh total", () => {
    const ctx = makeCtx();
    const { results, state } = runDays(ctx, [camp({ keywords: ctx.market.keywords.map((k) => ({ term: k.term, exactBid: 2000 })), budget: 200000 })], 30);
    expect(daySpend(results[0])).toBeLessThan(200000);
    expect(state.totalSpend).toBeLessThanOrEqual(200000 + 1e-6);
    const darkDays = results.filter((r) => daySpend(r) === 0).length;
    expect(darkDays).toBeGreaterThan(0);
  });
});

describe("visibility (F8)", () => {
  it("partitions every cell's searches into stock, budget, rank and won", () => {
    const ctx = makeCtx();
    const { result } = stepDay(ctx, initialMarketState(ctx), [camp({ budget: 1500 })]);
    for (const c of result.cells) {
      expect(c.lostToStock + c.lostToBudget + c.lostToRank + c.won).toBeCloseTo(c.searches, 6);
    }
  });

  it("keeps SOV at or below 54% on every keyword", () => {
    const ctx = makeCtx();
    const { result } = stepDay(ctx, initialMarketState(ctx), [camp({ keywords: [{ term: "whey protein", exactBid: 2000 }], budget: 100000 })]);
    const vi = total(result.cells, "viewableImpressions");
    const all = total(result.cells, "totalAdViewable");
    expect(vi / all).toBeLessThanOrEqual(1 / 1.85 + 1e-9);
  });

  it("a higher bid never lowers impression share", () => {
    const ctx = makeCtx();
    const share = (bid: number) => {
      const r = stepDay(ctx, initialMarketState(ctx), [camp({ keywords: [{ term: "whey protein", exactBid: bid }], budget: 100000 })]).result;
      return total(r.cells, "won") / total(r.cells, "searches");
    };
    let prev = -1;
    for (const bid of [250, 350, 450, 600, 900]) {
      const s = share(bid);
      expect(s).toBeGreaterThanOrEqual(prev - 1e-9);
      prev = s;
    }
  });
});

describe("stock and geography (F6, §3.4)", () => {
  it("zero stock in a state means zero spend and zero delivery there", () => {
    const ctx = makeCtx();
    const { result } = stepDay(ctx, initialMarketState(ctx), [camp({ geography: "select_cities", cities: ["Karnataka", "Rajasthan"] })]);
    const raj = result.cells.filter((c) => c.state === "Rajasthan");
    expect(total(raj, "spend")).toBe(0);
    expect(total(raj, "viewableImpressions")).toBe(0);
  });

  it("Pan India gives the same result as selecting exactly the stocked states", () => {
    const ctx = makeCtx();
    const pan = stepDay(ctx, initialMarketState(ctx), [camp()]).result;
    const exact = stepDay(ctx, initialMarketState(ctx), [camp({ geography: "select_cities", cities: ["Karnataka", "Maharashtra", "Delhi"] })]).result;
    expect(total(pan.cells, "spend")).toBeCloseTo(total(exact.cells, "spend"), 6);
    expect(total(pan.cells, "units")).toBeCloseTo(total(exact.cells, "units"), 6);
  });

  it("sales reduce stock, and stock is topped up on restock days", () => {
    const ctx = makeCtx();
    const { results } = runDays(ctx, [camp()], RESTOCK_INTERVAL_DAYS);
    const day1 = results[0].stock.find((s) => s.skuId === "fuel-1" && s.state === "Karnataka")!;
    expect(day1.closing).toBeCloseTo(day1.opening - day1.adUnits - day1.organicUnits, 6);
    const restockDay = results[RESTOCK_INTERVAL_DAYS - 1].stock.find((s) => s.skuId === "fuel-1" && s.state === "Karnataka")!;
    expect(restockDay.restocked).toBeGreaterThan(0);
  });

  it("never sells more units than are in stock", () => {
    const ctx = makeCtx({ Karnataka: 2 });
    const { results } = runDays(ctx, [camp({ budget: 50000 })], 3);
    for (const r of results) for (const s of r.stock) expect(s.closing).toBeGreaterThanOrEqual(-1e-9);
  });
});

describe("own campaigns and rivals", () => {
  it("two of your campaigns on the same keyword never raise each other's price", () => {
    const ctx = makeCtx();
    const kws = [{ term: "whey protein", exactBid: 450 }];
    const alone = stepDay(ctx, initialMarketState(ctx), [camp({ keywords: kws, budget: 100000 })]).result;
    const both = stepDay(ctx, initialMarketState(ctx), [
      camp({ id: "a", keywords: kws, budget: 100000 }),
      camp({ id: "b", keywords: [{ term: "whey protein", exactBid: 440 }], budget: 100000 }),
    ]).result;
    const cpm = (rows: readonly CellRow[]) => (total(rows, "spend") / total(rows, "viewableImpressions")) * 1000;
    expect(cpm(both.cells)).toBeCloseTo(cpm(alone.cells), 6);
  });

  it("WheyNation's day-9 burst pushes the student out of slot 1 on 'whey protein'", () => {
    const ctx = makeCtx();
    const kws = [{ term: "whey protein", exactBid: 450 }];
    const { results } = runDays(ctx, [camp({ keywords: kws, budget: 100000 })], 9);
    // Views per search: slot 1 is seen in every search, slots 2-3 in 55% / 30%
    const viewsPerSearch = (r: DayResult) => total(r.cells, "viewableImpressions") / (total(r.cells, "searches") - total(r.cells, "lostToStock"));
    expect(viewsPerSearch(results[8])).toBeLessThan(viewsPerSearch(results[7]) * 0.85);
  });

  it("records rival rows for auction insights, without any bids", () => {
    const ctx = makeCtx();
    const { result } = stepDay(ctx, initialMarketState(ctx), [camp()]);
    const iron = result.rivals.filter((r) => r.rivalId === "ironwhey");
    expect(iron.length).toBeGreaterThan(0);
    expect(Object.keys(iron[0])).not.toContain("bid");
  });
});

describe("smart match (F2e)", () => {
  it("reaches other keywords in the same cluster at the smart bid", () => {
    const ctx = makeCtx();
    const { result } = stepDay(ctx, initialMarketState(ctx), [camp({ keywords: [{ term: "whey protein", exactBid: 450, smartBid: 400 }], budget: 100000 })]);
    const smart = result.cells.filter((c) => c.matchType === "smart");
    expect(smart.length).toBeGreaterThan(0);
    expect(new Set(smart.map((c) => c.term))).toContain("whey protein chocolate");
    expect(smart.every((c) => c.term !== "whey protein")).toBe(true);
  });
});
