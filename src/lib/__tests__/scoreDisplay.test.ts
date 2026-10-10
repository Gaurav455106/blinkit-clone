import { describe, it, expect } from "vitest";
import { SCORE_MAX, CRISIS_MAX, crisisCardScore } from "@/lib/newScoring";

describe("SCORE_MAX", () => {
  it("matches the 35/25/25/15 split and sums to 100", () => {
    expect(SCORE_MAX).toEqual({ setup: 35, liveOpt: 25, crisis: 25, results: 15 });
    const total = SCORE_MAX.setup + SCORE_MAX.liveOpt + SCORE_MAX.crisis + SCORE_MAX.results;
    expect(total).toBe(100);
  });

  it("crisis maxes sum to the crisis category max", () => {
    expect(CRISIS_MAX[1] + CRISIS_MAX[2] + CRISIS_MAX[3]).toBe(SCORE_MAX.crisis);
  });
});

describe("crisisCardScore", () => {
  it("scales a perfect option score to that crisis's share of 25", () => {
    expect(crisisCardScore({ crisisNum: 1, score: 15, maxScore: 15 })).toEqual({ earned: 8, max: 8 });
    expect(crisisCardScore({ crisisNum: 2, score: 15, maxScore: 15 })).toEqual({ earned: 9, max: 9 });
    expect(crisisCardScore({ crisisNum: 3, score: 15, maxScore: 15 })).toEqual({ earned: 8, max: 8 });
  });

  it("scales partial scores the same way the results page does", () => {
    expect(crisisCardScore({ crisisNum: 2, score: 5, maxScore: 15 })).toEqual({ earned: 3, max: 9 });
  });

  it("falls back to the raw option score when the crisis number is unknown", () => {
    expect(crisisCardScore({ score: 10, maxScore: 15 })).toEqual({ earned: 10, max: 15 });
  });

  it("defaults missing scores to 0 out of 15", () => {
    expect(crisisCardScore({ crisisNum: 1 })).toEqual({ earned: 0, max: 8 });
  });
});
