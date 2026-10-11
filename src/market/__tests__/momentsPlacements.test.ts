import { describe, it, expect } from "vitest";
import { detectMoments } from "@/market/moments";
import { noMomentPoints } from "@/market/scoringV2";
import { initialMarketState } from "@/market/state";
import { stepDay } from "@/market/step";
import { suggestPlacementRange } from "@/market/suggest";
import type { CampaignConfig, DayResult } from "@/market/engineTypes";
import { testContext } from "./testContext";

function passive(ctx: ReturnType<typeof testContext>, launched: CampaignConfig[], days = 30) {
  let state = initialMarketState(ctx);
  const results: DayResult[] = [];
  const configsByDay: CampaignConfig[][] = [];
  for (let d = 1; d <= days; d++) {
    const out = stepDay(ctx, state, launched);
    state = out.state;
    results.push(out.result);
    configsByDay.push(launched);
  }
  return detectMoments({ ctx, results, configsByDay });
}

describe("decision moments on placements (SPEC §13 #29)", () => {
  it("a Stories campaign losing money raises a moment with placement levers", () => {
    const ctx = testContext("vitaboost");
    const placements = ctx.market.placements.filter((p) => p.kind === "stories").map((p) => ({ id: p.id, bid: suggestPlacementRange(ctx, p.id).hi * 2 }));
    const stories: CampaignConfig = { id: "s1", skuIds: ctx.scenario.profile.skus.map((s) => s.id), keywords: [], placements, geography: "pan_india", cities: [], budgetType: "daily", budget: 200000 / 30, launchDay: 1 };
    const moments = passive(ctx, [stories]);
    const losing = moments.find((m) => m.type === "belowBreakEven");
    expect(losing).toBeDefined();
    expect(losing!.subject.startsWith("stories:")).toBe(true);
    expect(losing!.levers.some((l) => l.change.kind === "placementBid")).toBe(true);
  });
});

describe("no moment detected (SPEC §13 #29b)", () => {
  it("scales the moment points by the share of spend that wasn't wasted", () => {
    expect(noMomentPoints(0, 30)).toBe(30);
    expect(noMomentPoints(1, 30)).toBe(0);
    expect(noMomentPoints(0.25, 30)).toBeCloseTo(22.5, 6);
  });
});
