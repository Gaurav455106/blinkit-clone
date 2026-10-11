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

describe("wasted spend follows the brand's goal floor (F13)", () => {
  it("spend at 0.8x break-even is waste for a ROAS brand but not for an awareness brand", async () => {
    const { wastedSpendShare, wasteFloorFor } = await import("@/market/scoringV2");
    const { cell, dayResult } = await import("./liveFixtures");
    const results = [dayResult(1, { cells: [cell({ spend: 1000, contribution: 800 })] })];
    expect(wastedSpendShare(results, wasteFloorFor("ROAS-First"))).toBe(1);
    expect(wastedSpendShare(results, wasteFloorFor("Awareness-First"))).toBe(0);
    expect(wastedSpendShare(results, wasteFloorFor("Category-Creation"))).toBe(0);
    expect(wastedSpendShare(results)).toBe(1);
  });
});

describe("losing-money moments follow the goal's floor (F13, found in the Glow playthrough)", async () => {
  const { cell, dayResult } = await import("./liveFixtures");
  const { matchInsights } = await import("@/market/insights");
  const camp: CampaignConfig = { id: "c1", skuIds: ["x"], keywords: [], placements: [{ id: "spotlight:home", bid: 450 }, { id: "spotlight:search", bid: 500 }], geography: "pan_india", cities: [], budgetType: "daily", budget: 5000, launchDay: 1 };
  const results = [1, 2, 3, 4, 5, 6].map((d) => dayResult(d, { cells: [
    cell({ inventory: "spotlight", term: "spotlight:home", spend: 1000, contribution: 600 }),
    cell({ inventory: "spotlight", term: "spotlight:search", spend: 1000, contribution: 2000 }),
  ] }));
  const configsByDay = results.map(() => [camp]);

  it("an awareness campaign above its 0.7x floor raises no losing-money moment for a weak placement", () => {
    const moments = detectMoments({ ctx: testContext("glow"), results, configsByDay });
    expect(moments.some((m) => m.type === "belowBreakEven")).toBe(false);
  });

  it("a ROAS-first brand still gets the moment for the same placement", () => {
    const moments = detectMoments({ ctx: testContext("henlo"), results, configsByDay });
    expect(moments.some((m) => m.type === "belowBreakEven" && m.subject === "spotlight:home")).toBe(true);
  });

  it("an insight naming a placement by its readable name matches the moment", () => {
    const moments = detectMoments({ ctx: testContext("henlo"), results, configsByDay });
    const m = moments.find((x) => x.subject === "spotlight:home")!;
    const [match] = matchInsights([{ day: m.day, type: "belowBreakEven", subject: "Spotlight home", evidence: "R6", plannedAction: "lower bid" }], moments, []);
    expect(match.moment?.id).toBe(m.id);
  });
});
