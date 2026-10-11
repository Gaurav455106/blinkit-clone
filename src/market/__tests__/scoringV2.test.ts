import { describe, it, expect } from "vitest";
import { scoreRunV2, scoreSetupV2, wastedSpendShare, SCORE_V2_MAX, type ScoreV2Input } from "@/market/scoringV2";
import { applyActions, recordAction, type LiveAction } from "@/market/actions";
import { initialMarketState } from "@/market/state";
import { stepDay } from "@/market/step";
import type { CampaignConfig, DayResult, MarketState } from "@/market/engineTypes";
import { suggestKeywordRange } from "@/market/suggest";
import { keywordMaxCPM } from "@/market/calibration/strategies";
import { testContext } from "./testContext";
import type { EventActivation, LeverId } from "@/market/events";
import type { CommitmentResult } from "@/market/rohit";

const ctx = testContext("fuelup");

function scored(launched: CampaignConfig[], actions: LiveAction[], formats: ScoreV2Input["formats"], extra: Partial<ScoreV2Input> = {}) {
  let state = initialMarketState(ctx);
  const statesByDay: MarketState[] = [state];
  const results: DayResult[] = [];
  const configsByDay: CampaignConfig[][] = [];
  for (let d = 1; d <= 30; d++) {
    const cfgs = applyActions(launched, actions, d);
    const out = stepDay(ctx, state, cfgs);
    state = out.state;
    statesByDay.push(state);
    results.push(out.result);
    configsByDay.push(cfgs);
  }
  return scoreRunV2({ ctx, launched, formats, actions, results, configsByDay, statesByDay, pitch: { score: 12, max: 15 }, insights: [], describeAction: (a) => recordAction(launched, a).what, ...extra });
}

const all = ctx.scenario.profile.skus.map((s) => s.id);
const naive: CampaignConfig[] = [{
  id: "n", skuIds: all, keywords: ctx.market.keywords.map((k) => ({ term: k.term, exactBid: suggestKeywordRange(ctx, k.term).hi })),
  geography: "pan_india", cities: [], budgetType: "daily", budget: 200000 / 30, launchDay: 1,
}];
const profitable = ctx.market.keywords.filter((k) => k.fit["fuel-1"] >= 1 && keywordMaxCPM(ctx, k) > suggestKeywordRange(ctx, k.term).lo);
const good: CampaignConfig[] = [
  { id: "hero", skuIds: ["fuel-1"], keywords: profitable.filter((k) => k.tier !== "long").map((k) => ({ term: k.term, exactBid: Math.min(suggestKeywordRange(ctx, k.term).hi, Math.round(keywordMaxCPM(ctx, k) * 0.9)) })), geography: "pan_india", cities: [], budgetType: "daily", budget: 4500, launchDay: 1, schedule: [2, 5, 6, 7] },
  { id: "long", skuIds: ["fuel-1", "fuel-2"], keywords: ctx.market.keywords.filter((k) => k.tier === "long" && !k.term.includes("bar")).map((k) => ({ term: k.term, exactBid: suggestKeywordRange(ctx, k.term).hi })), geography: "pan_india", cities: [], budgetType: "daily", budget: 1300, launchDay: 1 },
  { id: "ka", skuIds: ["fuel-1"], keywords: [{ term: "whey protein", exactBid: 520 }], geography: "select_cities", cities: ["Karnataka"], budgetType: "daily", budget: 800, launchDay: 1 },
];
const perf = { adFormat: "product_booster", objective: "performance" };

describe("scoring v2", () => {
  const naiveScore = scored(naive, [], { n: perf });
  const goodScore = scored(good, [], { hero: perf, long: perf, ka: perf });

  it("has the decided maxes: 25 / 35 / 20 / 20 = 100", () => {
    expect(Object.values(SCORE_V2_MAX).reduce((s, x) => s + x, 0)).toBe(100);
    for (const s of [naiveScore, goodScore]) {
      const maxBy = (cat: string) => s.lines.filter((l) => l.category === cat).reduce((a, l) => a + l.max, 0);
      expect(maxBy("setup")).toBeCloseTo(25, 6);
      expect(maxBy("live")).toBeCloseTo(35, 6);
      expect(maxBy("eventsRohit")).toBeCloseTo(20, 6);
      expect(maxBy("results")).toBeCloseTo(20, 6);
    }
  });

  it("totals add up from the lines and every line explains itself", () => {
    const sum = naiveScore.lines.reduce((s, l) => s + l.earned, 0);
    expect(naiveScore.grandTotal).toBeCloseTo(sum, 0);
    for (const l of naiveScore.lines) {
      expect(l.earned).toBeGreaterThanOrEqual(0);
      expect(l.earned).toBeLessThanOrEqual(l.max + 1e-9);
      expect(l.note.length).toBeGreaterThan(5);
      expect(l.judgedOn.length).toBeGreaterThan(5);
      expect(l.tiers.length).toBeGreaterThan(0);
    }
  });

  it("a well-structured, disciplined setup scores more than naive play", () => {
    expect(goodScore.totals.setup).toBeGreaterThan(naiveScore.totals.setup);
    expect(goodScore.totals.results).toBeGreaterThanOrEqual(naiveScore.totals.results);
    expect(goodScore.grandTotal).toBeGreaterThan(naiveScore.grandTotal);
  });

  it("a passive naive run lists its costliest mistakes", () => {
    expect(naiveScore.moments.length).toBeGreaterThan(0);
    expect(naiveScore.costliestMistakes.length).toBeGreaterThan(0);
  });

  it("wasted spend is a share between 0 and 1", () => {
    expect(naiveScore.run.spend).toBeGreaterThan(0);
    const results: DayResult[] = [];
    expect(wastedSpendShare(results)).toBe(0);
  });
});

function alertAfter(day: number, levers: LeverId[]): EventActivation {
  return {
    eventId: "newcomer_launch", key: `a${day}`, title: "A newcomer launched", raisedAfterDay: day, startDay: day + 1, endDay: day + 5,
    decisionWindowDays: 2, effect: {}, pauses: true, rightLevers: levers, stake: 5000, data: {},
    alert: { headline: "h", detail: "d", report: { id: "R2", label: "" } },
  };
}

describe("scoring v2: events and Rohit (20)", () => {
  const line = (s: ReturnType<typeof scored>, key: string) => s.lines.find((l) => l.key === key)!;
  const lowerBid: LiveAction = { campaignId: "hero", dayMade: 9, change: { kind: "budget", budget: 3000 } };

  it("splits into pacing, pitch, alerts and check-ins, 5 points each", () => {
    const s = scored(good, [], { hero: perf, long: perf, ka: perf });
    for (const k of ["v2_pacing", "v2_rohit", "v2_events", "v2_checkins"]) expect(line(s, k).max).toBe(5);
  });

  it("pulling a right lever after an alert scores full; ignoring it scores 0", () => {
    const alerts = [alertAfter(9, ["lower_budget"])];
    const acted = scored(good, [lowerBid], { hero: perf, long: perf, ka: perf }, { alerts });
    const ignored = scored(good, [], { hero: perf, long: perf, ka: perf }, { alerts });
    expect(line(acted, "v2_events").earned).toBe(5);
    expect(line(ignored, "v2_events").earned).toBe(0);
    expect(line(ignored, "v2_events").note).toContain("A newcomer launched");
  });

  it("strong replies and kept promises score full check-in points; weak and broken score little", () => {
    const kept = { status: "kept", actual: 1, commitment: { text: "Keep OSA above 60%", keptDelta: 8, brokenDelta: -12 } } as unknown as CommitmentResult;
    const broken = { ...kept, status: "broken" } as CommitmentResult;
    const good5 = scored(good, [], { hero: perf, long: perf, ka: perf }, { rohit: { replies: [{ quality: "strong" }], commitments: [kept] } });
    const poor = scored(good, [], { hero: perf, long: perf, ka: perf }, { rohit: { replies: [{ quality: "weak" }], commitments: [broken] } });
    expect(line(good5, "v2_checkins").earned).toBe(5);
    expect(line(poor, "v2_checkins").earned).toBeLessThan(2);
  });
});

describe("scoreSetupV2", () => {
  it("gives the same setup lines as the full score, with no days run", () => {
    const setup = scoreSetupV2({ ctx, launched: good, formats: { hero: perf, long: perf, ka: perf } });
    const full = scored(good, [], { hero: perf, long: perf, ka: perf }).lines.filter((l) => l.category === "setup");
    expect(setup).toEqual(full);
    expect(setup.reduce((s, l) => s + l.max, 0)).toBeCloseTo(25, 6);
  });
});
