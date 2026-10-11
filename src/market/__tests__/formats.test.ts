import { describe, it, expect } from "vitest";
import { goodFormatsFor, formatHint, FORMAT_NAMES } from "@/market/formats";
import { scoreSetupV2 } from "@/market/scoringV2";
import { clientGoalsV2 } from "@/market/goals";
import { suggestPlacementRange } from "@/market/suggest";
import type { CampaignConfig, MarketContext } from "@/market/engineTypes";
import type { InventoryState } from "@/data/scenarios";
import { testContext } from "./testContext";

const tone = (ctx: MarketContext, t: InventoryState["tone"]): MarketContext => ({ ...ctx, scenario: { ...ctx.scenario, inventory: { ...ctx.scenario.inventory, tone: t } } });
const camp = (ctx: MarketContext, over: Partial<CampaignConfig>): CampaignConfig => ({
  id: "c1", skuIds: ctx.scenario.profile.skus.map((s) => s.id), keywords: [], geography: "pan_india", cities: [],
  budgetType: "daily", budget: 3000, launchDay: 1, ...over,
});
const lineOf = (lines: ReturnType<typeof scoreSetupV2>, key: string) => lines.find((l) => l.key === key)!;
const placementsOf = (ctx: MarketContext, kind: string, mult = 0.5) =>
  ctx.market.placements.filter((p) => p.kind === kind).map((p) => ({ id: p.id, bid: Math.max(200, Math.round(suggestPlacementRange(ctx, p.id).lo * mult)) }));

describe("good formats per brand (SPEC §13 #31)", () => {
  it("lists each brand's formats, best first", () => {
    expect(goodFormatsFor(testContext("pawlife").scenario)).toEqual(["recommendation_ads", "brand_booster"]);
    expect(goodFormatsFor(testContext("vitaboost").scenario)).toEqual(["listing_spotlight", "stories"]);
    expect(goodFormatsFor(testContext("henlo").scenario)).toEqual(["product_booster"]);
  });

  it("switches to selling formats when stock is overstocked", () => {
    expect(goodFormatsFor(tone(testContext("tinybuddy"), "overstocked").scenario)).toEqual(["product_booster", "recommendation_ads"]);
  });

  it("the brief's hint names the same formats the score rewards", () => {
    for (const id of ["glow", "vitaboost", "tinybuddy", "pawlife", "henlo"]) {
      const s = testContext(id).scenario;
      const hint = clientGoalsV2(s).campaignHint;
      expect(hint).toBe(formatHint(s));
      expect(hint).toContain(FORMAT_NAMES[goodFormatsFor(s)[0]]);
    }
  });
});

describe("format fit scores the format, not the objective", () => {
  it("PawLife on Rec Ads (wizard objective: performance) gets full marks", () => {
    const ctx = testContext("pawlife");
    const lines = scoreSetupV2({ ctx, launched: [camp(ctx, { placements: placementsOf(ctx, "recommendation") })], formats: { c1: { adFormat: "recommendation_ads", objective: "performance" } } });
    expect(lineOf(lines, "v2_format").earned).toBe(8);
  });

  it("VitaBoost on Stories (its second good format) gets 6", () => {
    const ctx = testContext("vitaboost");
    const lines = scoreSetupV2({ ctx, launched: [camp(ctx, { placements: placementsOf(ctx, "stories") })], formats: { c1: { adFormat: "stories", objective: "reach" } } });
    expect(lineOf(lines, "v2_format").earned).toBe(6);
  });

  it("an overstocked brand with only an awareness format gets at most 2", () => {
    const ctx = tone(testContext("tinybuddy"), "overstocked");
    const lines = scoreSetupV2({ ctx, launched: [camp(ctx, { placements: placementsOf(ctx, "category") })], formats: { c1: { adFormat: "brand_booster", objective: "reach" } } });
    expect(lineOf(lines, "v2_format").earned).toBeLessThanOrEqual(2);
  });
});

describe("keyword lines for accounts without keywords (SPEC §13 #30)", () => {
  it("keyword choice is 'not needed' for a reach brand whose good formats have no keywords", () => {
    const ctx = testContext("glow");
    const lines = scoreSetupV2({ ctx, launched: [camp(ctx, { placements: placementsOf(ctx, "spotlight") })], formats: { c1: { adFormat: "listing_spotlight", objective: "reach" } } });
    expect(lineOf(lines, "v2_keywords").earned).toBe(5);
  });

  it("a ROAS-first brand with no keyword campaign still scores 0 on keyword choice", () => {
    const ctx = testContext("henlo");
    const lines = scoreSetupV2({ ctx, launched: [camp(ctx, { placements: placementsOf(ctx, "spotlight") })], formats: { c1: { adFormat: "listing_spotlight", objective: "reach" } } });
    expect(lineOf(lines, "v2_keywords").earned).toBe(0);
  });

  it("bid discipline judges placement bids: low bids earn full marks, Spotlight auto-bids are left out", () => {
    const ctx = testContext("tinybuddy");
    const low = scoreSetupV2({ ctx, launched: [camp(ctx, { placements: placementsOf(ctx, "category", 0.3) })], formats: { c1: { adFormat: "brand_booster", objective: "reach" } } });
    expect(lineOf(low, "v2_bids").earned).toBe(6);
    const high = scoreSetupV2({ ctx, launched: [camp(ctx, { placements: placementsOf(ctx, "category", 5) })], formats: { c1: { adFormat: "brand_booster", objective: "reach" } } });
    expect(lineOf(high, "v2_bids").earned).toBeLessThan(6);
  });
});
