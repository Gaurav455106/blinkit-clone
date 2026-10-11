// Slice 1h: the wizard reads engine data, and saved campaigns convert to engine input.

import { describe, it, expect } from "vitest";
import { marketContextFor, seedFor } from "@/market/context";
import { keywordSearches, keywordRange, smartRange, categoryRange, categoryVisits, recSlotRange } from "@/market/wizardData";
import { savedCampaignToConfig } from "@/market/adapter";
import { suggestKeywordRange } from "@/market/suggest";
import type { SavedCampaign } from "@/context/SimContext";
import { testContext } from "./testContext";

const ctx = testContext("fuelup");
const scenario = ctx.scenario;

describe("marketContextFor", () => {
  it("builds a context seeded by batch + brand", () => {
    const c = marketContextFor(scenario, "KS-24")!;
    expect(c.seed).toBe(seedFor("KS-24", "fuelup"));
    expect(c.market.brandId).toBe("fuelup");
    expect(c.totalDays).toBe(30);
  });

  it("gives everyone in the same batch and brand the same seed, and other batches a different one", () => {
    expect(seedFor("KS-24", "fuelup")).toBe(seedFor("KS-24", "fuelup"));
    expect(seedFor("KS-24", "fuelup")).not.toBe(seedFor("KS-25", "fuelup"));
  });

  it("is cached so the wizard doesn't rebuild it on every render", () => {
    expect(marketContextFor(scenario, "KS-24")).toBe(marketContextFor(scenario, "KS-24"));
  });
});

describe("wizard data (frozen screens, data only)", () => {
  it("shows engine ranges and stable monthly volumes for known keywords", () => {
    const c = marketContextFor(scenario, "KS-24")!;
    expect(keywordRange(scenario, "KS-24", "whey protein")).toEqual(suggestKeywordRange(c, "whey protein"));
    expect(keywordSearches(scenario, "KS-24", "whey protein")).toBe(keywordSearches(scenario, "KS-24", "whey protein"));
    expect(keywordSearches(scenario, "KS-24", "whey protein")).toBeGreaterThan(0);
  });

  it("falls back sensibly for keywords a student types in that aren't in the market data", () => {
    const r = keywordRange(scenario, "KS-24", "creatine monohydrate");
    expect(r.lo).toBeGreaterThanOrEqual(200);
    expect(r.hi).toBeGreaterThanOrEqual(r.lo);
    expect(keywordSearches(scenario, "KS-24", "creatine monohydrate")).toBeGreaterThan(0);
  });

  it("never shows a smart-match range below the ₹200 minimum (v1 showed ₹115)", () => {
    for (const k of ctx.market.keywords) expect(smartRange(scenario, "KS-24", k.term).lo).toBeGreaterThanOrEqual(200);
  });

  it("gives category pages and Rec Ads slots their engine ranges", () => {
    const cat = scenario.profile.relevantCategories[0];
    expect(categoryRange(scenario, "KS-24", cat).lo).toBeGreaterThanOrEqual(200);
    expect(categoryVisits(scenario, "KS-24", cat)).toBeGreaterThan(0);
    for (const slot of ["retargeting", "new_user", "cart", "next_product", "similar"]) {
      expect(recSlotRange(scenario, "KS-24", slot).lo).toBeGreaterThanOrEqual(200);
    }
  });
});

describe("savedCampaignToConfig", () => {
  const snapshot = (entries: Record<string, unknown>) =>
    Object.fromEntries(Object.entries(entries).map(([k, v]) => [k, JSON.stringify(v)]));

  const base: SavedCampaign = {
    id: "c1", name: "Whey push", objective: "performance", adFormat: "product_booster",
    cities: ["Karnataka"], skuIds: ["fuel-1"], keywords: ["whey protein", "plant protein"],
    budget: 5000, budgetType: "daily", geography: "select_cities", launchDay: 1,
    dayparting: [2, 3, 4, 5, 6, 7],
  };

  it("maps keywords with their saved exact and smart bids, boost, categories and schedule", () => {
    const c = savedCampaignToConfig({
      ...base,
      categories: ["Sports Nutrition"],
      wizardSnapshot: snapshot({
        sim_keyword_exact_bids: { "whey protein": "520", "plant protein": "300" },
        sim_keyword_smart_bids: { "whey protein": "400" },
        sim_keyword_smart_enabled: { "whey protein": true },
        sim_keyword_boost: { "whey protein": true },
        sim_keyword_boost_pct: { "whey protein": "20" },
        sim_cat_bids: { "Sports Nutrition": "450" },
      }),
    }, scenario, "KS-24");
    expect(c.keywords).toEqual([{ term: "whey protein", exactBid: 520, smartBid: 400 }, { term: "plant protein", exactBid: 300 }]);
    expect(c.boostPct).toBeCloseTo(0.2, 6);
    expect(c.placements).toEqual([{ id: "category:Sports Nutrition", bid: 450 }]);
    expect(c.schedule).toEqual([2, 3, 4, 5, 6, 7]);
    expect(c.geography).toBe("select_cities");
    expect(c.cities).toEqual(["Karnataka"]);
  });

  it("uses the suggested low bid when a campaign has no saved bids (older saves)", () => {
    const c = savedCampaignToConfig(base, scenario, "KS-24");
    expect(c.keywords[0].exactBid).toBe(keywordRange(scenario, "KS-24", "whey protein").lo);
  });

  it("maps Stories feeds, Rec Ads slots and gives Spotlight an automatic bid", () => {
    const stories = savedCampaignToConfig({ ...base, adFormat: "stories", keywords: [], feeds: ["main-feed"], wizardSnapshot: snapshot({ sim_cpm_overrides: {} }) }, scenario, "KS-24");
    expect(stories.placements?.[0]).toEqual({ id: "stories:main-feed", bid: 500 });
    const rec = savedCampaignToConfig({ ...base, adFormat: "recommendation_ads", keywords: [], wizardSnapshot: snapshot({ sim_rec_checked: { cart: true, similar: false }, sim_rec_bids: { cart: "380" } }) }, scenario, "KS-24");
    expect(rec.placements).toEqual([{ id: "rec:cart", bid: 380 }]);
    const spot = savedCampaignToConfig({ ...base, adFormat: "listing_spotlight", keywords: [] }, scenario, "KS-24");
    expect(spot.placements?.map((p) => p.id).sort()).toEqual(["spotlight:category", "spotlight:home", "spotlight:search"]);
    expect(spot.placements!.every((p) => p.bid >= 200)).toBe(true);
  });

  it("maps an overall budget with its end day", () => {
    const c = savedCampaignToConfig({ ...base, budgetType: "overall", budget: 60000, endDay: 20 }, scenario, "KS-24");
    expect(c.budgetType).toBe("overall");
    expect(c.endDay).toBe(20);
  });
});
