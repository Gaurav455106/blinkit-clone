import { describe, it, expect } from "vitest";
import { matchInsights, scoreInsights, type Insight } from "@/market/insights";
import type { Moment } from "@/market/moments";
import type { LiveAction } from "@/market/actions";

const moment = (over: Partial<Moment>): Moment => ({
  id: "m1", type: "belowBreakEven", day: 8, campaignId: "c1", subject: "protein bar",
  title: "", evidence: "", window: 3, levers: [{ label: "Pause", change: { kind: "pauseKeyword", term: "protein bar", paused: true } }], ...over,
});
const insight = (over: Partial<Insight>): Insight => ({ day: 7, type: "belowBreakEven", subject: "protein bar", evidence: "R2: ROAS 0.7 vs 6.6", plannedAction: "Pause it", ...over });
const pause: LiveAction = { campaignId: "c1", dayMade: 7, change: { kind: "pauseKeyword", term: "protein bar", paused: true } };

describe("insight log scoring", () => {
  it("matches an insight to a real moment of the same kind and subject within a few days", () => {
    const [m] = matchInsights([insight({})], [moment({})], []);
    expect(m.moment?.id).toBe("m1");
    expect(m.acted).toBe(false);
  });

  it("doesn't match the wrong problem, subject or week", () => {
    expect(matchInsights([insight({ type: "sovDrop" })], [moment({})], [])[0].moment).toBeNull();
    expect(matchInsights([insight({ subject: "whey protein" })], [moment({})], [])[0].moment).toBeNull();
    expect(matchInsights([insight({ day: 20 })], [moment({})], [])[0].moment).toBeNull();
  });

  it("gives more credit when an action follows the insight", () => {
    const moments = [moment({})];
    const noAction = scoreInsights([insight({})], moments, [], 5);
    const withAction = scoreInsights([insight({})], moments, [pause], 5);
    expect(withAction.earned).toBe(5);
    expect(noAction.earned).toBeLessThan(withAction.earned);
    expect(noAction.earned).toBeGreaterThan(0);
  });

  it("logging nothing scores 0 when there were problems to find", () => {
    expect(scoreInsights([], [moment({})], [pause], 5).earned).toBe(0);
  });

  it("one moment can only be claimed once", () => {
    const matches = matchInsights([insight({}), insight({})], [moment({})], []);
    expect(matches.filter((m) => m.moment).length).toBe(1);
  });
});
