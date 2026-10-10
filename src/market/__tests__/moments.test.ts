import { describe, it, expect } from "vitest";
import { detectMoments, scoreMoment, objectiveFor, type Moment } from "@/market/moments";
import { applyActions, recordAction, type LiveAction } from "@/market/actions";
import { initialMarketState } from "@/market/state";
import { stepDay } from "@/market/step";
import type { CampaignConfig, DayResult, MarketState } from "@/market/engineTypes";
import { sumMetrics } from "@/market/aggregate";
import { suggestKeywordRange } from "@/market/suggest";
import { testContext } from "./testContext";

const ctx = testContext("fuelup");

function play(launched: CampaignConfig[], actions: LiveAction[], days = 30) {
  let state = initialMarketState(ctx);
  const statesByDay: MarketState[] = [state];
  const results: DayResult[] = [];
  const configsByDay: CampaignConfig[][] = [];
  for (let d = 1; d <= days; d++) {
    const cfgs = applyActions(launched, actions, d);
    const out = stepDay(ctx, state, cfgs);
    state = out.state;
    statesByDay.push(state);
    results.push(out.result);
    configsByDay.push(cfgs);
  }
  return { statesByDay, results, configsByDay };
}

// Naive: every keyword at the top of its range, one shared budget, 24/7
const naive: CampaignConfig[] = [{
  id: "c1", skuIds: ctx.scenario.profile.skus.map((s) => s.id),
  keywords: ctx.market.keywords.map((k) => ({ term: k.term, exactBid: suggestKeywordRange(ctx, k.term).hi })),
  geography: "pan_india", cities: [], budgetType: "daily", budget: 200000 / 30, launchDay: 1,
}];
const passive = play(naive, []);
const moments = detectMoments({ ctx, results: passive.results, configsByDay: passive.configsByDay });

describe("decision moments", () => {
  it("finds the traps built into FuelUp's market in a passive run", () => {
    const types = new Set(moments.map((m) => m.type));
    expect(types.has("belowBreakEven")).toBe(true);
    expect(types.has("budgetCapPeak")).toBe(true);
    expect(moments.every((m) => m.levers.length > 0 && m.evidence.length > 10)).toBe(true);
  });

  it("doesn't repeat the same moment within a week, and leaves room to respond", () => {
    const keys = moments.map((m) => `${m.type}|${m.campaignId}|${m.subject}`);
    for (const k of new Set(keys)) {
      const days = moments.filter((m) => `${m.type}|${m.campaignId}|${m.subject}` === k).map((m) => m.day);
      for (let i = 1; i < days.length; i++) expect(days[i] - days[i - 1]).toBeGreaterThanOrEqual(7);
    }
    expect(moments.every((m) => m.day <= ctx.totalDays - m.window)).toBe(true);
  });
});

describe("counterfactual scoring (F13)", () => {
  const describe_ = (a: LiveAction) => recordAction(naive, a).what;
  const loser = moments.find((m) => m.type === "belowBreakEven") as Moment;

  it("ignoring a moment where a lever helps scores 0", () => {
    const s = scoreMoment({ ctx, launched: naive, actions: [], statesByDay: passive.statesByDay }, loser, 5, describe_);
    expect(["ignored", "nothingNeeded"]).toContain(s.verdict);
    if (s.verdict === "ignored") expect(s.points).toBe(0);
  });

  it("pulling the best lever in time scores full points", () => {
    const lever = loser.levers[0];
    const actions: LiveAction[] = [{ campaignId: loser.campaignId, dayMade: loser.day, change: lever.change }];
    const run = play(naive, actions);
    const s = scoreMoment({ ctx, launched: naive, actions, statesByDay: run.statesByDay }, loser, 5, describe_);
    expect(s.points).toBe(5);
    expect(s.studentAction).not.toBeNull();
  });

  it("a money-losing response scores 0 (raising the bid on a keyword already below break-even)", () => {
    const actions: LiveAction[] = [{ campaignId: loser.campaignId, dayMade: loser.day, change: { kind: "keywordBid", term: loser.subject, bid: 3000 } }];
    const run = play(naive, actions);
    const s = scoreMoment({ ctx, launched: naive, actions, statesByDay: run.statesByDay }, loser, 5, describe_);
    expect(s.points).toBe(0);
    expect(s.verdict).toBe("wrong");
  });
});

describe("objective by goal type", () => {
  it("profit for ROAS-first, units for volume-first, views for awareness", () => {
    const m = sumMetrics(passive.results.flatMap((r) => r.cells));
    expect(objectiveFor("ROAS-First")(m)).toBeCloseTo(m.profit, 6);
    expect(objectiveFor("Volume-First")(m)).toBeLessThanOrEqual(m.units);
    expect(objectiveFor("Awareness-First")(m)).toBeLessThanOrEqual(m.viewableImpressions);
  });
});
